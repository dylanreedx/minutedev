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
    // Note: Optimistic update is done synchronously in the board component
    // before calling mutate() to avoid timing issues with dnd-kit transforms
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reorder ticket");
    },
    onSettled: (_, error, variables) => {
      // Only refetch on error to sync with server state
      if (error) {
        queryClient.invalidateQueries({
          queryKey: ticketKeys.list(variables.projectId),
        });
      }
    },
  });
}

