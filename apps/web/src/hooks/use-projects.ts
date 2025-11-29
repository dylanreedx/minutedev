"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createProject,
  getProjects,
  getProjectsByTeam,
  getProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  inviteProjectMember,
  listProjectInvitations,
  cancelProjectInvitation,
  getProjectInvitation,
  type CreateProjectInput,
  type UpdateProjectInput,
  type InviteMemberInput,
} from "@/actions/projects";
import type { Project } from "@minute/db";

// Query keys
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (teamId?: string) => [...projectKeys.lists(), teamId || "all"] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (slug: string) => [...projectKeys.details(), slug] as const,
  members: (projectId: string) => [...projectKeys.all, "members", projectId] as const,
  invitations: (projectId: string) => [...projectKeys.all, "invitations", projectId] as const,
  invitation: (invitationId: string) => [...projectKeys.all, "invitation", invitationId] as const,
};

// Queries
export function useProjects(teamId?: string) {
  return useQuery({
    queryKey: projectKeys.list(teamId),
    queryFn: async () => {
      const result = await getProjects(teamId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch projects";
        throw new Error(errorMessage);
      }
      return result.data;
    },
  });
}

export function useProjectsByTeam(teamId: string) {
  return useQuery({
    queryKey: projectKeys.list(teamId),
    queryFn: async () => {
      const result = await getProjectsByTeam(teamId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch projects";
        throw new Error(errorMessage);
      }
      return result.data;
    },
    enabled: !!teamId,
  });
}

export function useProject(slug: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: projectKeys.detail(slug),
    queryFn: async () => {
      const result = await getProject(slug);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch project";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to fetch project");
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!slug,
  });
}

export function useProjectMembers(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: async () => {
      const result = await getProjectMembers(projectId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch project members";
        throw new Error(errorMessage);
      }
      return result.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!projectId,
  });
}

// Mutations
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const result = await createProject(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to create project";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to create project");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project created successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create project");
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProjectInput) => {
      const result = await updateProject(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to update project";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to update project");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      if (data?.slug) {
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(data.slug) });
      }
      toast.success("Project updated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update project");
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const result = await deleteProject(projectId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to delete project";
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project deleted successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete project");
    },
  });
}

// Invite queries
export function useProjectInvitations(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: projectKeys.invitations(projectId),
    queryFn: async () => {
      const result = await listProjectInvitations(projectId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch invitations";
        throw new Error(errorMessage);
      }
      return result.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!projectId,
  });
}

export function useProjectInvitation(invitationId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: projectKeys.invitation(invitationId),
    queryFn: async () => {
      const result = await getProjectInvitation(invitationId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch invitation";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to fetch invitation");
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!invitationId,
  });
}

// Invite mutations
export function useInviteProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteMemberInput) => {
      const result = await inviteProjectMember(input);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to invite member";
        throw new Error(errorMessage);
      }
      if ('data' in result) {
        return result.data;
      }
      throw new Error("Failed to invite member");
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.invitations(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.members(variables.projectId) });
      toast.success("Invitation sent successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to invite member");
    },
  });
}

export function useCancelProjectInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invitationId, projectId }: { invitationId: string; projectId: string }) => {
      const result = await cancelProjectInvitation(invitationId);
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to cancel invitation";
        throw new Error(errorMessage);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.invitations(variables.projectId) });
      toast.success("Invitation cancelled successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel invitation");
    },
  });
}
