import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from "@/actions/templates";

// Query keys
export const templateKeys = {
  all: ["templates"] as const,
  byProject: (projectId: string) => [...templateKeys.all, "project", projectId] as const,
  byId: (templateId: string) => [...templateKeys.all, "id", templateId] as const,
};

// Query hook: Get templates for a project
export function useTemplates(projectId: string) {
  return useQuery({
    queryKey: templateKeys.byProject(projectId),
    queryFn: () => getTemplates(projectId),
    enabled: !!projectId,
  });
}

// Query hook: Get a single template
export function useTemplate(templateId: string) {
  return useQuery({
    queryKey: templateKeys.byId(templateId),
    queryFn: () => getTemplate(templateId),
    enabled: !!templateId,
  });
}

// Mutation hook: Create template
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTemplateInput) => createTemplate(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: templateKeys.byProject(variables.projectId),
      });
      toast.success("Template created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create template");
    },
  });
}

// Mutation hook: Update template
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTemplateInput) => updateTemplate(data),
    onSuccess: (template) => {
      if (!template) return;
      // Invalidate both the specific template and the project list
      queryClient.invalidateQueries({
        queryKey: templateKeys.byId(template.id),
      });
      queryClient.invalidateQueries({
        queryKey: templateKeys.byProject(template.projectId),
      });
      toast.success("Template updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update template");
    },
  });
}

// Mutation hook: Delete template
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => deleteTemplate(templateId),
    onSuccess: () => {
      // Invalidate all template queries
      queryClient.invalidateQueries({
        queryKey: templateKeys.all,
      });
      toast.success("Template deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete template");
    },
  });
}

