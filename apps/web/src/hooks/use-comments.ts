"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  type CreateCommentInput,
  type UpdateCommentInput,
} from "@/actions/comments";

// Query keys
export const commentKeys = {
  all: ["comments"] as const,
  lists: () => [...commentKeys.all, "list"] as const,
  list: (ticketId: string) => [...commentKeys.lists(), ticketId] as const,
};

// Queries
export function useComments(ticketId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: commentKeys.list(ticketId),
    queryFn: async () => {
      const result = await getComments(ticketId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch comments";
        throw new Error(errorMessage);
      }
      return result.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!ticketId,
  });
}

// Mutations
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      const result = await createComment(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to create comment";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to create comment");
    },
    onSuccess: (data, variables) => {
      // Invalidate comments list for the ticket
      queryClient.invalidateQueries({ queryKey: commentKeys.list(variables.ticketId) });
      toast.success("Comment added!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create comment");
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCommentInput) => {
      const result = await updateComment(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to update comment";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to update comment");
    },
    onSuccess: (data) => {
      // Find ticketId from the comment data
      // We need to refetch to get the ticketId, or pass it in the mutation
      // For now, invalidate all comment lists (could be optimized)
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
      toast.success("Comment updated!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update comment");
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const result = await deleteComment(commentId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to delete comment";
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      // Invalidate all comment lists (could be optimized by passing ticketId)
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
      toast.success("Comment deleted!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete comment");
    },
  });
}





