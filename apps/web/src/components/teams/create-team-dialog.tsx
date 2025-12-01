"use client";

import { useState } from "react";
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
import { useCreateTeam } from "@/hooks/use-teams";

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function CreateTeamDialog({
  open,
  onOpenChange,
}: CreateTeamDialogProps) {
  const [name, setName] = useState("");
  const createTeam = useCreateTeam();

  const slugPreview = name ? generateSlug(name) : "";
  const isLoading = createTeam.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      return;
    }

    try {
      await createTeam.mutateAsync({
        name: name.trim(),
      });
      
      // Reset form and close dialog
      setName("");
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the hook (toast)
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Create a new team to organize your projects and collaborate with others.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">
              Team Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="team-name"
              placeholder="My Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
              maxLength={100}
              autoFocus
            />
            {slugPreview && (
              <p className="text-xs text-muted-foreground">
                Slug: <span className="font-mono">{slugPreview}</span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



