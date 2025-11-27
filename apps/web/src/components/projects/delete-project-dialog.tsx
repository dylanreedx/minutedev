"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteProject } from "@/hooks/use-projects";

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  ticketCount?: number;
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  ticketCount = 0,
}: DeleteProjectDialogProps) {
  const deleteProject = useDeleteProject();
  const isLoading = deleteProject.isPending;

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync(projectId);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Error deleting project:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Project
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete <strong>"{projectName}"</strong>?
            </p>
            {ticketCount > 0 && (
              <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm font-medium text-destructive">
                  ⚠️ Warning: This will permanently delete all {ticketCount}{" "}
                  {ticketCount === 1 ? "ticket" : "tickets"} in this project.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This action cannot be undone.
                </p>
              </div>
            )}
            {ticketCount === 0 && (
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Project"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

