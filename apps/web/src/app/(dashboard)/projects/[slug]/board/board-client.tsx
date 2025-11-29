"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { flushSync } from "react-dom";
import Link from "next/link";
import { List, GripVertical, Ticket, SearchX } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
  type Collision,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateTicketButton } from "@/components/tickets/create-ticket-button";
import { EditTicketSheet } from "@/components/tickets/edit-ticket-sheet";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { InviteProjectButton } from "@/components/projects/invite-project-button";
import { EmptyState } from "@/components/ui/empty-state";
import { useTickets, useReorderTicket, ticketKeys } from "@/hooks/use-tickets";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TicketStatus } from "@minute/db";

// Order gap for calculating new order values
const ORDER_GAP = 1000;

// Column configuration
const columns: { id: TicketStatus; name: string; color: string }[] = [
  { id: "backlog", name: "Backlog", color: "bg-muted" },
  { id: "todo", name: "Todo", color: "bg-blue-500/10" },
  { id: "in_progress", name: "In Progress", color: "bg-yellow-500/10" },
  { id: "done", name: "Done", color: "bg-green-500/10" },
];

// Type for a ticket
type Ticket = {
  id: string;
  title: string;
  priority: string | null;
  points: number | null;
  order: number;
  status: TicketStatus;
  assignee: {
    id: string | null;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

// Sortable ticket card component
function SortableTicketCard({
  ticket,
  onEdit,
  isDragOverlay = false,
}: {
  ticket: Ticket;
  onEdit: () => void;
  isDragOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    data: {
      type: "ticket",
      ticket,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Hide the original card when dragging (DragOverlay shows the visual)
  // Keep the ref attached but make it invisible
  if (isDragging && !isDragOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, opacity: 0, height: 0, margin: 0, padding: 0, overflow: 'hidden' }}
      />
    );
  }

  const getUserDisplayName = (assignee: { name: string | null; email: string | null }) => {
    return assignee.name || assignee.email || "Unassigned";
  };

  const getUserInitials = (assignee: { name: string | null; email: string | null }) => {
    if (assignee.name) {
      return assignee.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (assignee.email) {
      return assignee.email[0].toUpperCase();
    }
    return "?";
  };

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={`w-full rounded-md border bg-background p-3 transition-shadow ${
        isDragOverlay 
          ? "shadow-lg ring-2 ring-primary/20 cursor-grabbing border-border" 
          : "border-border hover:shadow-sm cursor-pointer"
      }`}
      onClick={isDragOverlay ? undefined : onEdit}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm mb-1 line-clamp-3">{ticket.title}</h4>
          <div className="flex items-center gap-2 flex-wrap">
            {ticket.priority && (
              <Badge variant="outline" className="text-xs">
                {ticket.priority}
              </Badge>
            )}
            {ticket.points !== null && ticket.points !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {ticket.points} {ticket.points === 1 ? 'pt' : 'pts'}
              </Badge>
            )}
          </div>
          {ticket.assignee && (
            <div className="flex items-center gap-1.5 mt-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={ticket.assignee.image || undefined} alt={getUserDisplayName(ticket.assignee)} />
                <AvatarFallback className="text-xs">
                  {getUserInitials(ticket.assignee)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {getUserDisplayName(ticket.assignee)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Placeholder component for drop indicator with animation
function DropPlaceholder() {
  return (
    <div 
      className="rounded-md border-2 border-dashed border-primary/50 bg-primary/5 h-14 my-1 
                 animate-in fade-in slide-in-from-top-2 duration-150"
    />
  );
}

// Custom collision detection - more forgiving than closestCorners
// Uses rectIntersection for wide detection area, then prioritizes tickets
const customCollisionDetection: CollisionDetection = (args) => {
  // Use rect intersection first - it's more forgiving with larger hit areas
  const rectCollisions = rectIntersection(args);
  
  if (rectCollisions.length > 0) {
    // Prioritize tickets over columns for precise positioning
    const ticketCollisions = rectCollisions.filter(
      (c) => c.data?.droppableContainer?.data?.current?.type === "ticket"
    );
    
    if (ticketCollisions.length > 0) {
      // Return the ticket collision (if multiple, return first - closest)
      return [ticketCollisions[0] as Collision];
    }
    
    // No tickets found, return column collisions
    return rectCollisions;
  }
  
  // Fall back to pointer within for edge cases
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions;
};

// Droppable column component (for empty columns)
function DroppableColumn({
  id,
  children,
  className,
  overId,
  ticketsGrouped,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  overId: string | null;
  ticketsGrouped?: Record<TicketStatus, Ticket[]>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: "column",
      status: id,
    },
  });

  // Check if this column is being dragged over
  // Either directly (isOver or overId === id) or via a ticket in this column
  let isColumnOver = isOver || (overId === id);
  
  // Also check if overId is a ticket in this column
  if (!isColumnOver && overId && ticketsGrouped) {
    const columnTickets = ticketsGrouped[id as TicketStatus] || [];
    if (columnTickets.some((t) => t.id === overId)) {
      // overId is a ticket in this column, so this column is being dragged over
      isColumnOver = true;
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isColumnOver ? "ring-2 ring-primary/30" : ""}`}
    >
      {children}
    </div>
  );
}

export function BoardPageClient({
  slug,
  projectId,
  projectName,
}: {
  slug: string;
  projectId: string;
  projectName: string;
}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: ticketsGrouped, isLoading, error } = useTickets(projectId);
  const reorderMutation = useReorderTicket();

  const filteredTicketsGrouped = useMemo(() => {
    if (!ticketsGrouped) return null;

    const searchQuery = searchParams.get("search")?.toLowerCase() || "";
    const statusFilter = searchParams.get("status")?.split(",").filter(Boolean) || [];
    const priorityFilter = searchParams.get("priority")?.split(",").filter(Boolean) || [];

    const filtered: Record<TicketStatus, Ticket[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      done: [],
    };

    Object.entries(ticketsGrouped).forEach(([status, tickets]) => {
      filtered[status as TicketStatus] = tickets.filter((ticket) => {
        const matchesSearch = ticket.title.toLowerCase().includes(searchQuery);
        const matchesStatus = statusFilter.length === 0 || statusFilter.includes(ticket.status);
        const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(ticket.priority);
        return matchesSearch && matchesStatus && matchesPriority;
      });
    });

    return filtered;
  }, [ticketsGrouped, searchParams]);
  
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPosition, setOverPosition] = useState<"above" | "below" | null>(null);

  // Get the active ticket for drag overlay
  const activeTicket = useMemo(() => {
    if (!activeId || !ticketsGrouped) return null;
    for (const status of Object.keys(ticketsGrouped) as TicketStatus[]) {
      const tickets = ticketsGrouped[status];
      if (tickets) {
        const ticket = tickets.find((t) => t.id === activeId);
        if (ticket) return ticket;
      }
    }
    return null;
  }, [activeId, ticketsGrouped]);

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag over - track which column/ticket is being dragged over and position
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active, collisions } = event;
    
    if (!over || !active) {
      setOverId(null);
      setOverPosition(null);
      return;
    }

    const overIdStr = over.id as string;
    setOverId(overIdStr);

    // Determine if we're dragging above or below a ticket
    // Check if over is a ticket (not a column)
    if (over.data.current?.type === "ticket" && ticketsGrouped) {
      // Find which column this ticket is in
      let targetColumn: TicketStatus | null = null;
      let targetTickets: Ticket[] = [];
      
      for (const status of Object.keys(ticketsGrouped) as TicketStatus[]) {
        const tickets = ticketsGrouped[status] || [];
        const ticket = tickets.find((t) => t.id === overIdStr);
        if (ticket) {
          targetColumn = status;
          targetTickets = tickets;
          break;
        }
      }

      if (targetColumn && targetTickets.length > 0) {
        const overIndex = targetTickets.findIndex((t) => t.id === overIdStr);
        const activeIndex = targetTickets.findIndex((t) => t.id === active.id);
        
        // For same column - use index comparison
        if (activeIndex !== -1) {
          setOverPosition(activeIndex < overIndex ? "below" : "above");
          return;
        }
        
        // For cross-column drags - use the dragged element's center vs target's center
        const overRect = over.rect;
        const activeTranslated = active.rect.current?.translated;
        
        if (overRect && activeTranslated) {
          const overMiddleY = overRect.top + overRect.height / 2;
          const activeMiddleY = activeTranslated.top + activeTranslated.height / 2;
          setOverPosition(activeMiddleY < overMiddleY ? "above" : "below");
        } else {
          // Fallback: use collision data or default to above
          // This ensures first ticket can receive "above" position
          setOverPosition("above");
        }
      } else {
        setOverPosition(null);
      }
    } else {
      // Dragging over column (empty area)
      setOverPosition(null);
    }
  }, [ticketsGrouped]);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setOverId(null);
      setOverPosition(null);

      if (!over || !ticketsGrouped) {
        setActiveId(null);
        return;
      }

      const activeTicketId = active.id as string;
      const overId = over.id as string;
      const overData = over.data.current;

      // Find the source ticket
      let sourceStatus: TicketStatus | null = null;
      let sourceTicket: Ticket | null = null;
      
      for (const status of Object.keys(ticketsGrouped) as TicketStatus[]) {
        const ticket = ticketsGrouped[status]?.find((t) => t.id === activeTicketId);
        if (ticket) {
          sourceStatus = status;
          sourceTicket = ticket;
          break;
        }
      }

      if (!sourceStatus || !sourceTicket) return;

      // Determine target status and position
      let targetStatus: TicketStatus;
      let targetOrder: number | undefined;
      let newOrder: number;

      if (overData?.type === "column") {
        targetStatus = overId as TicketStatus;
        const targetTickets = ticketsGrouped[targetStatus] || [];
        newOrder = targetTickets.length > 0 
          ? Math.max(...targetTickets.map((t) => t.order)) + ORDER_GAP 
          : ORDER_GAP;
      } else if (overData?.type === "ticket") {
        const overTicket = overData.ticket as Ticket;
        targetStatus = overTicket.status;
        
        const targetTickets = ticketsGrouped[targetStatus] || [];
        const overIndex = targetTickets.findIndex((t) => t.id === overId);
        
        if (overIndex === -1) {
          newOrder = targetTickets.length > 0 
            ? Math.max(...targetTickets.map((t) => t.order)) + ORDER_GAP 
            : ORDER_GAP;
        } else if (sourceStatus === targetStatus) {
          const sourceIndex = targetTickets.findIndex((t) => t.id === activeTicketId);
          
          if (sourceIndex === overIndex) return;
          
          if (sourceIndex < overIndex) {
            targetOrder = overTicket.order;
            const nextTicket = targetTickets[overIndex + 1];
            if (nextTicket && nextTicket.id !== activeTicketId) {
              newOrder = Math.floor((overTicket.order + nextTicket.order) / 2);
            } else {
              newOrder = overTicket.order + ORDER_GAP;
            }
          } else {
            const prevTicket = targetTickets[overIndex - 1];
            if (prevTicket && prevTicket.id !== activeTicketId) {
              targetOrder = prevTicket.order;
              newOrder = Math.floor((prevTicket.order + overTicket.order) / 2);
            } else {
              newOrder = Math.floor(overTicket.order / 2);
            }
          }
        } else {
          const prevTicket = targetTickets[overIndex - 1];
          if (prevTicket) {
            targetOrder = prevTicket.order;
            newOrder = Math.floor((prevTicket.order + overTicket.order) / 2);
          } else {
            newOrder = Math.floor(overTicket.order / 2);
          }
        }
      } else {
        targetStatus = overId as TicketStatus;
        const targetTickets = ticketsGrouped[targetStatus] || [];
        newOrder = targetTickets.length > 0 
          ? Math.max(...targetTickets.map((t) => t.order)) + ORDER_GAP 
          : ORDER_GAP;
      }

      if (sourceStatus === targetStatus && sourceTicket.order === newOrder) {
        setActiveId(null);
        return;
      }

      // SYNCHRONOUSLY update cache BEFORE clearing activeId (key to avoiding flicker)
      // flushSync ensures React re-renders DOM before dnd-kit transforms reset
      const previousData = queryClient.getQueryData<Record<TicketStatus, Ticket[]>>(
        ticketKeys.list(projectId)
      );
      
      // Also capture previous detail cache for rollback
      const previousDetail = queryClient.getQueryData(
        ticketKeys.detail(activeTicketId)
      );
      
      if (previousData) {
        const newData: Record<TicketStatus, Ticket[]> = {
          backlog: [...(previousData.backlog || [])],
          todo: [...(previousData.todo || [])],
          in_progress: [...(previousData.in_progress || [])],
          done: [...(previousData.done || [])],
        };

        // Remove from source column
        newData[sourceStatus] = newData[sourceStatus].filter(
          (t) => t.id !== activeTicketId
        );

        // Add to target column with updated status and order
        // Status is updated here for cross-column drags (sourceStatus !== targetStatus)
        // and preserved for within-column reorders (sourceStatus === targetStatus)
        const updatedTicket: Ticket = {
          ...sourceTicket,
          status: targetStatus, // Always update status - handles both cross-column and same-column
          order: newOrder,
        };
        newData[targetStatus] = [...newData[targetStatus], updatedTicket].sort(
          (a, b) => a.order - b.order
        );

        // Use flushSync to force synchronous DOM update before clearing overlay
        // This prevents the "snap back then jump" flicker
        flushSync(() => {
          queryClient.setQueryData(ticketKeys.list(projectId), newData);
          
          // Also update the ticket detail cache if it exists (for edit dialog)
          // This ensures the edit dialog shows the updated status immediately
          const existingDetail = queryClient.getQueryData(
            ticketKeys.detail(activeTicketId)
          );
          if (existingDetail) {
            queryClient.setQueryData(ticketKeys.detail(activeTicketId), updatedTicket);
          }
        });

        // NOW safe to clear activeId - DOM is already in the new position
        setActiveId(null);

        // Fire mutation to sync with server (cache already updated)
        reorderMutation.mutate(
          {
            ticketId: activeTicketId,
            projectId,
            newStatus: targetStatus,
            newOrder,
            targetOrder,
          },
          {
            // Rollback on error
            onError: () => {
              queryClient.setQueryData(ticketKeys.list(projectId), previousData);
              // Also rollback detail cache if it existed
              if (previousDetail) {
                queryClient.setQueryData(ticketKeys.detail(activeTicketId), previousDetail);
              }
            },
          }
        );
      } else {
        setActiveId(null);
      }
    },
    [ticketsGrouped, projectId, reorderMutation, queryClient]
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setOverPosition(null);
  }, []);

  return (
    <>
      <Header title={projectName}>
        <Link href={`/projects/${slug}/list`}>
          <Button variant="outline" size="sm">
            <List className="mr-2 h-4 w-4" />
            List View
          </Button>
        </Link>
        <InviteProjectButton projectId={projectId} />
        <CreateTicketButton projectId={projectId} />
      </Header>

      <div className="px-6 py-4">
        <TicketFilters />
      </div>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {isLoading ? (
          <div className="flex gap-4 h-full">
            {columns.map((column) => (
              <div
                key={column.id}
                className={`w-[300px] flex-shrink-0 rounded-lg ${column.color} p-4`}
              >
                <Skeleton className="h-6 w-24 mb-4" />
                <Skeleton className="h-20 w-full mb-2" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>

        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-destructive">
              Error loading tickets: {error.message}
            </p>
          </div>
        ) : ticketsGrouped && Object.values(ticketsGrouped).flat().length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No tickets yet"
            description="Create your first ticket to start tracking tasks."
            action={<CreateTicketButton projectId={projectId} />}
            className="border-none min-h-[400px]"
          />
        ) : filteredTicketsGrouped && Object.values(filteredTicketsGrouped).flat().length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No tickets found"
            description="Try adjusting your filters or search query."
            action={
              <Button variant="outline" onClick={() => {}}>
                Clear filters
              </Button>
            }
            className="border-none min-h-[400px]"
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-4 h-full">
              {columns.map((column) => {
                const tickets = filteredTicketsGrouped?.[column.id] || [];
                const ticketIds = tickets.map((t) => t.id);

                return (
                  <DroppableColumn
                    key={column.id}
                    id={column.id}
                    className={`w-[300px] flex-shrink-0 rounded-lg ${column.color} p-4 transition-all`}
                    overId={overId}
                    ticketsGrouped={filteredTicketsGrouped || undefined}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-medium">{column.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {tickets.length}
                      </Badge>
                    </div>
                    <SortableContext
                      items={ticketIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-col gap-2 min-h-[100px]">
                        {tickets.length === 0 ? (
                          activeId && overId === column.id ? (
                            // Show full-width placeholder when dragging over empty column
                            <div className="rounded-md border-2 border-dashed border-primary/50 bg-primary/5 h-20 
                                          animate-in fade-in duration-150 flex items-center justify-center">
                              <span className="text-xs text-primary/50">Drop here</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-background/50 p-8 text-center">
                              <p className="text-sm text-muted-foreground">
                                No tickets
                              </p>
                            </div>
                          )
                        ) : (
                          tickets.map((ticket, index) => {
                            // Simplified check: are we dragging and hovering over this ticket?
                            const isDragging = activeId && activeId !== ticket.id;
                            const isHoveringThis = overId === ticket.id;
                            
                            const showPlaceholderAbove = isDragging && isHoveringThis && overPosition === "above";
                            const showPlaceholderBelow = isDragging && isHoveringThis && overPosition === "below";

                            return (
                              <div key={ticket.id} className="transition-all duration-150">
                                {showPlaceholderAbove && <DropPlaceholder />}
                                <SortableTicketCard
                                  ticket={ticket}
                                  onEdit={() => {
                                    setSelectedTicketId(ticket.id);
                                    setIsEditDialogOpen(true);
                                  }}
                                />
                                {showPlaceholderBelow && <DropPlaceholder />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </SortableContext>
                  </DroppableColumn>
                );
              })}
            </div>

            {/* Drag overlay with smooth animation */}
            <DragOverlay
              dropAnimation={{
                duration: 200,
                easing: "cubic-bezier(0.18, 1, 0.22, 1)",
              }}
            >
              {activeTicket ? (
                <SortableTicketCard
                  ticket={activeTicket}
                  onEdit={() => {}}
                  isDragOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <EditTicketSheet
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setSelectedTicketId(null);
          }
        }}
        ticketId={selectedTicketId}
      />
    </>
  );
}
