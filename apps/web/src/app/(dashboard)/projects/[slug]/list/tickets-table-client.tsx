"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown, Ticket, SearchX } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateTicketButton } from "@/components/tickets/create-ticket-button";
import { EditTicketSheet } from "@/components/tickets/edit-ticket-sheet";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { useTickets } from "@/hooks/use-tickets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TicketStatus, TicketPriority } from "@minute/db";

// Helper functions for badge colors
function getStatusBadgeVariant(status: TicketStatus): string {
  switch (status) {
    case "backlog":
      return "bg-muted text-muted-foreground";
    case "todo":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case "in_progress":
      return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20";
    case "done":
      return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
    default:
      return "";
  }
}

function getPriorityBadgeVariant(priority: TicketPriority): string {
  switch (priority) {
    case "low":
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
    case "medium":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case "high":
      return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
    case "urgent":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
    default:
      return "";
  }
}

type SortField = "title" | "status" | "priority" | "dueDate" | "createdAt" | null;
type SortDirection = "asc" | "desc";

export function TicketsTableClient({ slug, projectId, projectName }: { slug: string; projectId: string; projectName: string }) {
  const searchParams = useSearchParams();
  const { data: ticketsGrouped, isLoading, error } = useTickets(projectId);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Flatten grouped tickets into a single array for table display
  const allTickets = ticketsGrouped
    ? Object.values(ticketsGrouped).flat()
    : [];

  // Filter tickets based on search params
  const filteredTickets = useMemo(() => {
    const searchQuery = searchParams.get("search")?.toLowerCase() || "";
    const statusFilter = searchParams.get("status")?.split(",").filter(Boolean) || [];
    const priorityFilter = searchParams.get("priority")?.split(",").filter(Boolean) || [];

    return allTickets.filter((ticket) => {
      const matchesSearch = ticket.title.toLowerCase().includes(searchQuery);
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(ticket.status);
      const matchesPriority = priorityFilter.length === 0 || priorityFilter.includes(ticket.priority);
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [allTickets, searchParams]);

  // Handle column sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort tickets based on current sort field and direction
  const sortedTickets = useMemo(() => {
    if (!sortField) return filteredTickets;

    return [...filteredTickets].sort((a, b) => {
      let aValue: string | number | Date | null;
      let bValue: string | number | Date | null;

      switch (sortField) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "priority":
          // Priority order: low < medium < high < urgent
          const priorityOrder: Record<TicketPriority, number> = {
            low: 1,
            medium: 2,
            high: 3,
            urgent: 4,
          };
          aValue = priorityOrder[a.priority as TicketPriority] || 0;
          bValue = priorityOrder[b.priority as TicketPriority] || 0;
          break;
        case "dueDate":
          aValue = a.dueDate
            ? a.dueDate instanceof Date
              ? a.dueDate
              : new Date(a.dueDate)
            : null;
          bValue = b.dueDate
            ? b.dueDate instanceof Date
              ? b.dueDate
              : new Date(b.dueDate)
            : null;
          // Handle null values (put them at the end)
          if (aValue === null && bValue === null) return 0;
          if (aValue === null) return 1;
          if (bValue === null) return -1;
          break;
        case "createdAt":
          aValue = a.createdAt
            ? a.createdAt instanceof Date
              ? a.createdAt
              : new Date(a.createdAt)
            : new Date(0);
          bValue = b.createdAt
            ? b.createdAt instanceof Date
              ? b.createdAt
              : new Date(b.createdAt)
            : new Date(0);
          break;
        default:
          return 0;
      }

      // Compare values
      let comparison = 0;
      if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredTickets, sortField, sortDirection]);

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  return (
    <>
      <Header title={projectName}>
        <Link href={`/projects/${slug}/board`}>
          <Button variant="outline" size="sm">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Board View
          </Button>
        </Link>
        <CreateTicketButton projectId={projectId} />
      </Header>

      <div className="px-6 py-4">
        <TicketFilters />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-lg border border-border">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
              <Skeleton className="h-[300px] w-full rounded-xl" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-destructive">Error loading tickets: {error.message}</p>
            </div>
          ) : allTickets.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="No tickets yet"
              description="Create your first ticket to start tracking tasks."
              action={<CreateTicketButton projectId={projectId} />}
              className="border-none min-h-[400px]"
            />
          ) : sortedTickets.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No tickets found"
              description="Try adjusting your filters or search query."
              action={
                <Button variant="outline" onClick={() => {
                  // Reset filters logic is handled in TicketFilters, but we can provide a hint or just let them use the filter bar
                  // For now, let's just show the message since the filter bar is right above
                }}>
                  Clear filters
                </Button>
              }
              className="border-none min-h-[400px]"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => handleSort("title")}
                      className="flex items-center hover:text-foreground transition-colors cursor-pointer"
                    >
                      Title
                      <SortIcon field="title" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center hover:text-foreground transition-colors cursor-pointer"
                    >
                      Status
                      <SortIcon field="status" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("priority")}
                      className="flex items-center hover:text-foreground transition-colors cursor-pointer"
                    >
                      Priority
                      <SortIcon field="priority" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("dueDate")}
                      className="flex items-center hover:text-foreground transition-colors cursor-pointer"
                    >
                      Due Date
                      <SortIcon field="dueDate" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("createdAt")}
                      className="flex items-center hover:text-foreground transition-colors cursor-pointer"
                    >
                      Created
                      <SortIcon field="createdAt" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTickets.length === 0 ? (
                  // This case should be handled by the EmptyState above, but keeping as fallback
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No tickets found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      onClick={() => {
                        setSelectedTicketId(ticket.id);
                        setIsEditDialogOpen(true);
                      }}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{ticket.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs border",
                            getStatusBadgeVariant(ticket.status as TicketStatus)
                          )}
                        >
                          {ticket.status === "in_progress" ? "In Progress" : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs border",
                            getPriorityBadgeVariant(ticket.priority as TicketPriority)
                          )}
                        >
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ticket.dueDate ? (
                          format(
                            ticket.dueDate instanceof Date
                              ? ticket.dueDate
                              : new Date(ticket.dueDate),
                            "MMM d, yyyy"
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {ticket.createdAt ? (
                          format(
                            ticket.createdAt instanceof Date
                              ? ticket.createdAt
                              : new Date(ticket.createdAt),
                            "MMM d, yyyy"
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
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

