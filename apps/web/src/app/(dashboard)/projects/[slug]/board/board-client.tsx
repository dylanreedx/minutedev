"use client";

import { useState, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { List, GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
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
import { EditTicketDialog } from "@/components/tickets/edit-ticket-dialog";
import { useTickets, useReorderTicket, ticketKeys } from "@/hooks/use-tickets";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
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
  order: number;
  status: TicketStatus;
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

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={`rounded-md border bg-background p-3 transition-shadow ${
        isDragOverlay 
          ? "shadow-lg ring-2 ring-primary/20 cursor-grabbing border-border" 
          : isDragging
            ? "opacity-30 border-border"
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
          <h4 className="font-medium text-sm mb-1 truncate">{ticket.title}</h4>
          {ticket.priority && (
            <Badge variant="outline" className="text-xs">
              {ticket.priority}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Droppable column component (for empty columns)
function DroppableColumn({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: "column",
      status: id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? "ring-2 ring-primary/30" : ""}`}
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
  const queryClient = useQueryClient();
  const { data: ticketsGrouped, isLoading, error } = useTickets(projectId);
  const reorderMutation = useReorderTicket();
  
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

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
        <CreateTicketButton projectId={projectId} />
      </Header>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {isLoading ? (
          <div className="flex gap-4 h-full">
            {columns.map((column) => (
              <div
                key={column.id}
                className={`min-w-[300px] flex-shrink-0 rounded-lg ${column.color} p-4`}
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
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-4 h-full">
              {columns.map((column) => {
                const tickets = ticketsGrouped?.[column.id] || [];
                const ticketIds = tickets.map((t) => t.id);

                return (
                  <DroppableColumn
                    key={column.id}
                    id={column.id}
                    className={`min-w-[300px] flex-shrink-0 rounded-lg ${column.color} p-4 transition-all`}
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
                      <div className="space-y-2 min-h-[100px]">
                        {tickets.length === 0 ? (
                          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-background/50 p-8 text-center">
                            <p className="text-sm text-muted-foreground">
                              No tickets
                            </p>
                          </div>
                        ) : (
                          tickets.map((ticket) => (
                            <SortableTicketCard
                              key={ticket.id}
                              ticket={ticket}
                              onEdit={() => {
                                setSelectedTicketId(ticket.id);
                                setIsEditDialogOpen(true);
                              }}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </DroppableColumn>
                );
              })}
            </div>

            {/* Drag overlay - no drop animation for instant feel */}
            <DragOverlay dropAnimation={null}>
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

      <EditTicketDialog
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
