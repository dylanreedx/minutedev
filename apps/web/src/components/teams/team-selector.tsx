"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeams } from "@/hooks/use-teams";
import { CreateTeamDialog } from "./create-team-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { teamKeys } from "@/hooks/use-teams";

type Team = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: unknown;
  createdAt: Date | string;
  projectCount?: number;
  memberCount?: number;
};

interface TeamSelectorProps {
  value?: string;
  onValueChange: (teamId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TeamSelector({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select team...",
}: TeamSelectorProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: teams = [], isLoading } = useTeams();
  const queryClient = useQueryClient();

  // When a new team is created, select it automatically
  useEffect(() => {
    if (!createDialogOpen && teams.length > 0 && !value) {
      // If no team is selected but teams exist, select the first one
      const firstTeam = teams[0] as Team;
      if (firstTeam?.id) {
        onValueChange(firstTeam.id);
      }
    }
  }, [createDialogOpen, teams, value, onValueChange]);

  const selectedTeam = value && value !== 'all' ? teams.find((team) => (team as Team).id === value) as Team | undefined : null;

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <>
      <div className="space-y-2">
        <Select
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder}>
              {value === 'all' ? 'All teams' : selectedTeam?.name || placeholder}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {teams.length === 0 ? (
              <div className="py-6 text-center text-sm">
                <p className="text-muted-foreground mb-2">No teams found.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
              </div>
            ) : (
              <>
                {placeholder === "All teams" && (
                  <SelectItem value="all">All teams</SelectItem>
                )}
                {teams.map((team) => {
                  const typedTeam = team as Team;
                  return (
                    <SelectItem key={typedTeam.id} value={typedTeam.id}>
                      {typedTeam.name}
                    </SelectItem>
                  );
                })}
                <div className="border-t p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      setCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create new team
                  </Button>
                </div>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            // Refresh teams list when dialog closes
            queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
          }
        }}
      />
    </>
  );
}

