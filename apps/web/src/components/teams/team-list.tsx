"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, Users, FolderKanban, UserPlus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTeams } from "@/hooks/use-teams";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateTeamDialog } from "./create-team-dialog";
import { useState } from "react";

function TeamCard({ team }: { team: any }) {
  const router = useRouter();
  // Use optimized counts from getTeams query instead of separate queries
  const projectCount = team.projectCount ?? 0;
  const memberCount = team.memberCount ?? 0;

  return (
    <Card className="transition-colors hover:bg-accent/50 h-full flex flex-col relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 z-10"
        asChild
      >
        <Link href={`/teams/${team.id}/settings`}>
          <Settings className="h-4 w-4" />
        </Link>
      </Button>
      <Link href={`/teams/${team.id}`} className="flex-1">
        <CardHeader>
          <CardTitle>{team.name}</CardTitle>
          {team.slug && (
            <CardDescription className="line-clamp-2">
              {team.slug}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FolderKanban className="h-4 w-4" />
                <span>{projectCount} project{projectCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={(e) => {
                e.preventDefault();
                router.push(`/teams/${team.id}`);
              }}
            >
              View Projects
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

export function TeamList() {
  const { data: teams = [], isLoading } = useTeams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <>
        <EmptyState
          icon={Users}
          title="No teams yet"
          description="Create your first team to organize projects and collaborate with others."
          action={
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          }
        />
        <CreateTeamDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team: any) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}


