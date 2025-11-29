'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Settings, ClipboardList, Users } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { InviteTeamMemberDialog } from '@/components/teams/invite-team-member-dialog';
import { TeamActivityFeed } from '@/components/teams/team-activity-feed';
import { useTeam, useTeamMembers, useTeamInvitations } from '@/hooks/use-teams';
import { useProjectsByTeam } from '@/hooks/use-projects';
import { UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params.id as string;
  const { data: team, isLoading: teamLoading, error: teamError } = useTeam(teamId);
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjectsByTeam(teamId);
  const { data: members = [], isLoading: membersLoading } = useTeamMembers(teamId);
  const { data: invitations = [] } = useTeamInvitations(teamId);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  if (teamLoading) {
    return (
      <>
        <Header title="Team Details">
          <Skeleton className="h-10 w-32" />
        </Header>
        <div className="p-6 space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (teamError || !team) {
    return (
      <>
        <Header title="Team Details">
          <Button variant="outline" asChild>
            <Link href="/teams">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teams
            </Link>
          </Button>
        </Header>
        <div className="p-6">
          <EmptyState
            icon={Users}
            title="Team not found"
            description="The team you're looking for doesn't exist or you don't have access to it."
            action={
              <Button variant="outline" asChild>
                <Link href="/teams">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Teams
                </Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={team.name}>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/teams">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teams
            </Link>
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            Create Project
          </Button>
        </div>
      </Header>

      <div className="p-6 space-y-6">
        {/* Team Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Team Information</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/teams/${teamId}/settings`}>
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-base">{team.name}</p>
            </div>
            {team.slug && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Slug</p>
                <p className="text-base font-mono text-sm">{team.slug}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Team Members</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-2">
                <div className="h-12 w-full bg-muted animate-pulse rounded" />
                <div className="h-12 w-full bg-muted animate-pulse rounded" />
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-2">
                {members.map((member: any) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-2"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.user?.image || undefined} />
                      <AvatarFallback>
                        {member.user?.name
                          ? member.user.name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)
                          : member.user?.email?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.user?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.user?.email}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {member.role || "member"}
                    </Badge>
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
            {invitations.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Pending Invitations</p>
                <div className="space-y-2">
                  {invitations
                    .filter((inv: any) => inv.status === "pending")
                    .map((inv: any) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{inv.email}</span>
                        <Badge variant="outline" className="capitalize">
                          {inv.role}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projects Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Projects</h2>
            <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
              Create Project
            </Button>
          </div>

          {projectsLoading ? (
            <ProjectsGridSkeleton />
          ) : projectsError ? (
            <ErrorState error={projectsError} />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No projects yet"
              description={`Create your first project in ${team.name} to get started.`}
              action={
                <Button onClick={() => setCreateDialogOpen(true)}>
                  Create Project
                </Button>
              }
            />
          ) : (
            <ProjectsGrid projects={projects} />
          )}
        </div>

        {/* Team Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Team activity and member actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamActivityFeed teamId={teamId} />
          </CardContent>
        </Card>
      </div>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultTeamId={teamId}
      />

      <InviteTeamMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        teamId={teamId}
      />
    </>
  );
}

function ProjectsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="h-full">
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/10 p-12 text-center">
      <div className="mb-4 text-4xl">⚠️</div>
      <h3 className="mb-2 text-lg font-medium text-destructive">
        Error loading projects
      </h3>
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  );
}

function ProjectsGrid({
  projects,
}: {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    slug: string;
    ticketCount?: number;
  }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card
          key={project.id}
          className="transition-colors hover:bg-accent/50 h-full"
        >
          <Link href={`/projects/${project.slug}`} className="block h-full">
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              {project.description && (
                <CardDescription className="line-clamp-2">
                  {project.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground text-sm">
                <span>
                  {project.ticketCount ?? 0}{' '}
                  {project.ticketCount === 1 ? 'ticket' : 'tickets'}
                </span>
              </div>
            </CardContent>
          </Link>
        </Card>
      ))}
    </div>
  );
}

