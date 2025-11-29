"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createTeam,
  getTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  inviteTeamMember,
  listTeamInvitations,
  getTeamMembers,
  updateTeamMemberRole,
  removeTeamMember,
  cancelTeamInvitation,
  resendTeamInvitation,
  type CreateTeamInput,
  type UpdateTeamInput,
  type InviteTeamMemberInput,
  type UpdateTeamMemberRoleInput,
  type RemoveTeamMemberInput,
  type ResendInvitationInput,
} from "@/actions/teams";

// Query keys
export const teamKeys = {
  all: ["teams"] as const,
  lists: () => [...teamKeys.all, "list"] as const,
  details: () => [...teamKeys.all, "detail"] as const,
  detail: (teamId: string) => [...teamKeys.details(), teamId] as const,
};

// Queries
export function useTeams() {
  return useQuery({
    queryKey: teamKeys.lists(),
    queryFn: async () => {
      const result = await getTeams();
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch teams";
        throw new Error(errorMessage);
      }
      return result.data;
    },
  });
}

export function useTeam(teamId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: teamKeys.detail(teamId),
    queryFn: async () => {
      const result = await getTeam(teamId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch team";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to fetch team");
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!teamId,
  });
}

// Mutations
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTeamInput) => {
      const result = await createTeam(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to create team";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to create team");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
      toast.success("Team created successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create team");
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTeamInput) => {
      const result = await updateTeam(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to update team";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to update team");
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(variables.teamId) });
      toast.success("Team updated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update team");
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teamId: string) => {
      const result = await deleteTeam(teamId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to delete team";
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
      toast.success("Team deleted successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete team");
    },
  });
}

export function useTeamMembers(teamId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...teamKeys.detail(teamId), "members"],
    queryFn: async () => {
      const result = await getTeamMembers(teamId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch team members";
        throw new Error(errorMessage);
      }
      return result.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!teamId,
  });
}

export function useTeamInvitations(teamId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...teamKeys.detail(teamId), "invitations"],
    queryFn: async () => {
      const result = await listTeamInvitations(teamId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch invitations";
        throw new Error(errorMessage);
      }
      return result.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!teamId,
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteTeamMemberInput) => {
      const result = await inviteTeamMember(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to invite team member";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to invite team member");
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...teamKeys.detail(variables.teamId), "members"] });
      queryClient.invalidateQueries({ queryKey: [...teamKeys.detail(variables.teamId), "invitations"] });
      toast.success("Invitation sent successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to invite team member");
    },
  });
}

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTeamMemberRoleInput) => {
      const result = await updateTeamMemberRole(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to update member role";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to update member role");
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...teamKeys.detail(variables.teamId), "members"] });
      toast.success("Member role updated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update member role");
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RemoveTeamMemberInput) => {
      const result = await removeTeamMember(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to remove member";
        throw new Error(errorMessage);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...teamKeys.detail(variables.teamId), "members"] });
      toast.success("Member removed successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });
}

export function useCancelTeamInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invitationId, teamId }: { invitationId: string; teamId: string }) => {
      const result = await cancelTeamInvitation(invitationId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to cancel invitation";
        throw new Error(errorMessage);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...teamKeys.detail(variables.teamId), "invitations"] });
      toast.success("Invitation cancelled successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel invitation");
    },
  });
}

export function useResendTeamInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ResendInvitationInput) => {
      const result = await resendTeamInvitation(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to resend invitation";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to resend invitation");
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...teamKeys.detail(variables.teamId), "invitations"] });
      toast.success("Invitation resent successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });
}


