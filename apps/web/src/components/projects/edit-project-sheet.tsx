"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProject, useUpdateProject, useDeleteProject, useProjectMembers } from "@/hooks/use-projects";
import { Separator } from "@/components/ui/separator";
import { InviteMemberDialog } from "./invite-member-dialog";
import { ProjectInvitesList } from "./project-invites-list";
import { UserPlus, Users, Shield, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface EditProjectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string | null;
}

export function EditProjectSheet({
  open,
  onOpenChange,
  projectSlug,
}: EditProjectSheetProps) {
  const { data: project, isLoading: isLoadingProject } = useProject(
    projectSlug || ""
  );
  const { data: members = [], isLoading: isLoadingMembers } = useProjectMembers(
    project?.id || "",
    { enabled: !!project?.id }
  );
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize form when project data loads
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
    }
  }, [project]);

  const isLoading = updateProject.isPending || deleteProject.isPending;
  const isFormLoading = isLoadingProject || isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!project?.id || !name.trim()) {
      return;
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        name: name.trim(),
        description: description.trim() || undefined,
      });

      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Error updating project:", error);
    }
  };

  const handleDelete = async () => {
    if (!project?.id) return;

    try {
      await deleteProject.mutateAsync(project.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Error deleting project:", error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setShowDeleteConfirm(false);
      }
    }
  };

  return (
    <>
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col h-full p-0">
        <SheetHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <SheetTitle>Edit Project</SheetTitle>
          <SheetDescription>
            Update project details and information.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {isLoadingProject ? (
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-24 w-full bg-muted animate-pulse rounded" />
              </div>
            </div>
          ) : project ? (
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    placeholder="Enter project name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isFormLoading}
                    maxLength={100}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description (optional)</Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Describe the project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isFormLoading}
                    maxLength={500}
                    rows={4}
                  />
                  <p className="text-muted-foreground text-xs">
                    {description.length}/500 characters
                  </p>
                </div>

                <Separator />

                {/* Permissions & Access Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-base font-semibold">Permissions & Access</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Manage who can view and edit this project
                      </p>
                    </div>
                  </div>

                  {/* Visibility Info */}
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Visibility</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Team Only</Badge>
                      <span className="text-xs text-muted-foreground">
                        Only team members can access this project
                      </span>
                    </div>
                    {project?.organizationId && (
                      <p className="text-xs text-muted-foreground">
                        All members of the team have access based on their role.
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Team Members Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-base font-semibold">Team Members</Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Manage who has access to this project
                        </p>
                      </div>
                    {project?.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setInviteDialogOpen(true)}
                        disabled={isFormLoading}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite
                      </Button>
                    )}
                  </div>

                  {/* Members List */}
                  {isLoadingMembers ? (
                    <div className="space-y-2">
                      <div className="h-12 w-full bg-muted animate-pulse rounded" />
                      <div className="h-12 w-full bg-muted animate-pulse rounded" />
                    </div>
                  ) : members.length > 0 ? (
                    <div className="space-y-2 rounded-lg border p-3">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 py-2"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.image || undefined} />
                            <AvatarFallback>
                              {member.name
                                ? member.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)
                                : member.email?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {member.name || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        No members yet. Invite team members to collaborate.
                      </p>
                    </div>
                  )}

                  {/* Pending Invitations */}
                  {project?.id && (
                    <div className="mt-4">
                      <ProjectInvitesList projectId={project.id} />
                    </div>
                  )}
                </div>
              </div>

              <SheetFooter className="flex-col sm:flex-row gap-2 pt-4 pb-6 px-6 border-t bg-muted/50 flex-shrink-0">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isFormLoading}
                  className="sm:mr-auto w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={isFormLoading}
                    className="flex-1 sm:flex-initial"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isFormLoading || !name.trim()} className="flex-1 sm:flex-initial">
                    {isFormLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </SheetFooter>
            </form>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="py-4 text-center text-muted-foreground">
                Project not found
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the project
            "{project?.name}" and all associated tickets.
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
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Invite Dialog */}
    {project?.id && (
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        projectId={project.id}
      />
    )}
    </>
  );
}

