import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  semanticSearchTickets,
  findSimilarTickets,
  embedTicket,
  embedProjectTickets,
} from "@/actions/search";

// Query keys
export const searchKeys = {
  all: ["search"] as const,
  semantic: (projectId: string, query: string) =>
    [...searchKeys.all, "semantic", projectId, query] as const,
  similar: (ticketId: string) =>
    [...searchKeys.all, "similar", ticketId] as const,
};

// Hook for semantic search
export function useSemanticSearch(
  projectId: string | null,
  query: string,
  options: { enabled?: boolean; limit?: number; threshold?: number } = {}
) {
  const { enabled = true, limit, threshold } = options;

  return useQuery({
    queryKey: searchKeys.semantic(projectId || "", query),
    queryFn: () =>
      semanticSearchTickets(projectId!, query, { limit, threshold }),
    enabled: enabled && !!projectId && query.length > 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook for finding similar tickets
export function useSimilarTickets(
  ticketId: string | null,
  options: { enabled?: boolean; limit?: number; threshold?: number } = {}
) {
  const { enabled = true, limit, threshold } = options;

  return useQuery({
    queryKey: searchKeys.similar(ticketId || ""),
    queryFn: () => findSimilarTickets(ticketId!, { limit, threshold }),
    enabled: enabled && !!ticketId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Mutation hook for embedding a single ticket
export function useEmbedTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ticketId: string) => embedTicket(ticketId),
    onSuccess: (result, ticketId) => {
      if (result.success) {
        // Invalidate similar tickets query
        queryClient.invalidateQueries({
          queryKey: searchKeys.similar(ticketId),
        });
        if (!('cached' in result && result.cached)) {
          toast.success("Ticket embedded for semantic search");
        }
      } else {
        toast.error(result.error || "Failed to embed ticket");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to embed ticket");
    },
  });
}

// Mutation hook for embedding all project tickets
export function useEmbedProjectTickets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => embedProjectTickets(projectId),
    onSuccess: (result, projectId) => {
      if (result.success && 'data' in result && result.data) {
        // Invalidate all search queries
        queryClient.invalidateQueries({
          queryKey: searchKeys.all,
        });
        toast.success(
          `Embedded ${result.data.embedded} tickets (${result.data.cached} cached, ${result.data.errors} errors)`
        );
      } else if (!result.success && 'error' in result) {
        toast.error(result.error || "Failed to embed tickets");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to embed tickets");
    },
  });
}

