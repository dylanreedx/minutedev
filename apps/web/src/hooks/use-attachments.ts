import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAttachments,
  createAttachment,
  deleteAttachment,
  type CreateAttachmentInput,
} from "@/actions/attachments";

// Query keys
export const attachmentKeys = {
  all: ["attachments"] as const,
  byTicket: (ticketId: string) => [...attachmentKeys.all, "ticket", ticketId] as const,
};

// Query hook: Get attachments for a ticket
export function useAttachments(ticketId: string) {
  return useQuery({
    queryKey: attachmentKeys.byTicket(ticketId),
    queryFn: () => getAttachments(ticketId),
    enabled: !!ticketId,
  });
}

// Mutation hook: Create attachment
export function useCreateAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAttachmentInput) => createAttachment(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byTicket(variables.ticketId),
      });
      toast.success("File attached successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to attach file");
    },
  });
}

// Mutation hook: Delete attachment
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
    onSuccess: () => {
      // Invalidate all attachment queries since we don't know the ticketId
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.all,
      });
      toast.success("File deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete file");
    },
  });
}

