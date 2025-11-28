"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/actions/projects";
import type { Project } from "@minute/db";

// Query keys
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (slug: string) => [...projectKeys.details(), slug] as const,
  members: (projectId: string) => [...projectKeys.all, "members", projectId] as const,
};

// Queries
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: async () => {
      const result = await getProjects();
      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : "Failed to fetch projects";
        throw new Error(errorMessage);
      }
      return result.data;
    },
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
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(data.slug) });
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
