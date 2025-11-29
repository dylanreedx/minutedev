"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@/hooks/use-projects";
import { TeamSelector } from "@/components/teams/team-selector";
import { useTeams } from "@/hooks/use-teams";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTeamId?: string;
}

// Utility function to generate slug from name (matches server logic)
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  defaultTeamId,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState<string>(defaultTeamId || "");
  const createProject = useCreateProject();
  const { data: teams = [] } = useTeams();

  // Auto-select default team or first team if only one exists
  useEffect(() => {
    if (defaultTeamId) {
      setTeamId(defaultTeamId);
    } else if (teams.length === 1 && !teamId) {
      const firstTeam = teams[0] as any;
      if (firstTeam?.id) {
        setTeamId(firstTeam.id);
      }
    }
  }, [teams, teamId, defaultTeamId]);

  const slugPreview = name ? generateSlug(name) : "";
  const isLoading = createProject.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !teamId) {
      return;
    }

    try {
      await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        teamId,
      });

      // Reset form and close dialog on success
      setName("");
      setDescription("");
      setTeamId("");
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Error creating project:", error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      // Reset form when closing
      if (!newOpen) {
        setName("");
        setDescription("");
        setTeamId(defaultTeamId || "");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Create a new project to organize your tickets and tasks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team">
              Team <span className="text-destructive">*</span>
            </Label>
            <TeamSelector
              value={teamId}
              onValueChange={setTeamId}
              disabled={isLoading}
              placeholder="Select a team..."
            />
            <p className="text-xs text-muted-foreground">
              Projects must belong to a team. Create a team if you don't have one.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="My Awesome Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              maxLength={100}
              autoFocus
            />
          </div>

          {slugPreview && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">
                URL Slug (auto-generated)
              </Label>
              <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                /projects/{slugPreview}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What is this project about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              maxLength={500}
              rows={3}
            />
            <p className="text-muted-foreground text-xs">
              {description.length}/500 characters
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim() || !teamId}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

