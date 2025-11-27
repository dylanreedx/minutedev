"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createTicket,
  getTickets,
  getTicket,
  updateTicket,
  deleteTicket,
  reorderTicket,
  type CreateTicketInput,
  type UpdateTicketInput,
  type ReorderTicketInput,
} from "@/actions/tickets";
import type { Ticket, TicketStatus } from "@minute/db";

// Query keys
export const ticketKeys = {
  all: ["tickets"] as const,
  lists: () => [...ticketKeys.all, "list"] as const,
  list: (projectId: string) => [...ticketKeys.lists(), projectId] as const,
  details: () => [...ticketKeys.all, "detail"] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
};

// Queries
export function useTickets(projectId: string) {
  return useQuery({
    queryKey: ticketKeys.list(projectId),
    queryFn: async () => {
      const result = await getTickets(projectId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch tickets";
        throw new Error(errorMessage);
      }
      return result.data;
    },
    enabled: !!projectId,
  });
}

export function useTicket(ticketId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ticketKeys.detail(ticketId),
    queryFn: async () => {
      const result = await getTicket(ticketId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch ticket";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to fetch ticket");
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!ticketId,
  });
}

// Mutations
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const result = await createTicket(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to create ticket";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to create ticket");
    },
    onSuccess: (data, variables) => {
      // Invalidate tickets list for the project
      queryClient.invalidateQueries({ queryKey: ticketKeys.list(variables.projectId) });
      toast.success("Ticket created successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create ticket");
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTicketInput) => {
      const result = await updateTicket(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to update ticket";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to update ticket");
    },
    onSuccess: (data, variables) => {
      // Invalidate ticket detail
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(variables.id) });
      
      // Invalidate all ticket lists (since status might have changed)
      // We'll need to invalidate by project, but we don't have projectId here
      // So we invalidate all ticket lists and let the queries refetch
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      
      toast.success("Ticket updated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update ticket");
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketId: string) => {
      const result = await deleteTicket(ticketId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to delete ticket";
        throw new Error(errorMessage);
      }
      return result;
    },
    onSuccess: (_, ticketId) => {
      // Invalidate ticket detail
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) });
      
      // Invalidate all ticket lists
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
      
      toast.success("Ticket deleted successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete ticket");
    },
  });
}

export function useReorderTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReorderTicketInput) => {
      const result = await reorderTicket(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to reorder ticket";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to reorder ticket");
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ticketKeys.list(variables.projectId),
      });

      // Snapshot the previous value
      type TicketsGrouped = Record<TicketStatus, Ticket[]>;
      const previousData = queryClient.getQueryData<TicketsGrouped>(
        ticketKeys.list(variables.projectId)
      );

      // Optimistically update the cache
      if (previousData) {
        // Deep clone to avoid mutating cache directly
        const newData: TicketsGrouped = {
          backlog: [...(previousData.backlog || [])],
          todo: [...(previousData.todo || [])],
          in_progress: [...(previousData.in_progress || [])],
          done: [...(previousData.done || [])],
        };

        // Find and remove ticket from its current column
        let movedTicket: Ticket | undefined;
        for (const status of Object.keys(newData) as TicketStatus[]) {
          const index = newData[status].findIndex(
            (t) => t.id === variables.ticketId
          );
          if (index !== -1) {
            const ticket = newData[status][index];
            if (ticket) {
              // Clone the ticket before removing
              movedTicket = { ...ticket };
              newData[status] = newData[status].filter(
                (t) => t.id !== variables.ticketId
              );
              break;
            }
          }
        }

        // Add ticket to new column with updated order and status
        if (movedTicket) {
          // Create updated ticket with new status and order
          const updatedTicket: Ticket = {
            ...movedTicket,
            status: variables.newStatus,
            order: variables.newOrder,
          };

          newData[variables.newStatus] = [
            ...newData[variables.newStatus],
            updatedTicket,
          ].sort((a, b) => a.order - b.order);
        }

        queryClient.setQueryData(ticketKeys.list(variables.projectId), newData);
      }

      // Return context with snapshot
      return { previousData };
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          ticketKeys.list(variables.projectId),
          context.previousData
        );
      }
      toast.error(error.message || "Failed to reorder ticket");
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({
        queryKey: ticketKeys.list(variables.projectId),
      });
      queryClient.invalidateQueries({
        queryKey: ticketKeys.detail(variables.ticketId),
      });
    },
  });
}

