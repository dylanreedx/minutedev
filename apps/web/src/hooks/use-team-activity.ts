"use client";

import { useQuery } from "@tanstack/react-query";
import { getTeamActivity, type TeamActivityAction } from "@/actions/team-activity";

// Query keys
export const teamActivityKeys = {
  all: ["team-activity"] as const,
  lists: () => [...teamActivityKeys.all, "list"] as const,
  detail: (teamId: string) => [...teamActivityKeys.lists(), teamId] as const,
};

// Query hook
export function useTeamActivity(teamId: string, options?: { enabled?: boolean; limit?: number }) {
  return useQuery({
    queryKey: teamActivityKeys.detail(teamId),
    queryFn: async () => {
      const result = await getTeamActivity(teamId, options?.limit || 50);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch team activity";
        throw new Error(errorMessage);
      }
      return result.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!teamId,
  });
}

// Export types
export type { TeamActivityAction };


