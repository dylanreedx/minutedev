"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/actions/projects";
import type { Project } from "@minute/db";

// Query keys
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters?: string) => [...projectKeys.lists(), { filters }] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (slug: string) => [...projectKeys.details(), slug] as const,
};

// Queries
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: async () => {
      const result = await getProjects();
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch projects");
      }
      return result.data;
    },
  });
}

export function useProject(slug: string) {
  return useQuery({
    queryKey: projectKeys.detail(slug),
    queryFn: async () => {
      const result = await getProject(slug);
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch project");
      }
      return result.data;
    },
    enabled: !!slug,
  });
}

// Mutations
export function useCreateProject() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const result = await createProject(input);
      if (!result.success) {
        throw new Error(result.error || "Failed to create project");
      }
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project created successfully!");
      
      // Navigate to the new project
      if (data) {
        router.push(`/projects/${data.slug}`);
        router.refresh();
      }
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
        throw new Error(result.error || "Failed to update project");
      }
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      if (data) {
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
  const router = useRouter();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const result = await deleteProject(projectId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete project");
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      toast.success("Project deleted successfully!");
      
      // Navigate back to projects list
      router.push("/projects");
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete project");
    },
  });
}

