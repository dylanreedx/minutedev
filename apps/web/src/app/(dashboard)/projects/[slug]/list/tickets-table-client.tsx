"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateTicketButton } from "@/components/tickets/create-ticket-button";
import { EditTicketSheet } from "@/components/tickets/edit-ticket-sheet";
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
import type { TicketStatus } from "@minute/db";

export function TicketsTableClient({ slug, projectId, projectName }: { slug: string; projectId: string; projectName: string }) {
  const { data: ticketsGrouped, isLoading, error } = useTickets(projectId);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Flatten grouped tickets into a single array for table display
  const allTickets = ticketsGrouped
    ? Object.values(ticketsGrouped).flat()
    : [];

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

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-lg border border-border">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <p className="text-destructive">Error loading tickets: {error.message}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No tickets yet
                    </TableCell>
                  </TableRow>
                ) : (
                  allTickets.map((ticket) => (
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
                        <Badge variant="secondary" className="text-xs">
                          {ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ticket.priority}
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

