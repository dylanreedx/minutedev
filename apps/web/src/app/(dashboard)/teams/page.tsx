'use client';

import { Users } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionButton } from '@/components/ui/action-button';
import { CreateTeamDialog, TeamList } from '@/components/teams';
import { useTeams } from '@/hooks/use-teams';

function CreateTeamButton() {
  return (
    <ActionButton
      action="create"
      entity="team"
      size="sm"
      dialog={({ open, onOpenChange }) => (
        <CreateTeamDialog open={open} onOpenChange={onOpenChange} />
      )}
    />
  );
}

function TeamsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="p-6 text-center">
      <p className="text-destructive mb-2">Error loading teams</p>
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  );
}

export default function TeamsPage() {
  const { data: teams = [], isLoading, error } = useTeams();

  return (
    <>
      <Header title="Teams">
        <CreateTeamButton />
      </Header>

      <div className="p-6">
        {isLoading ? (
          <TeamsGridSkeleton />
        ) : error ? (
          <ErrorState error={error} />
        ) : teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No teams yet"
            description="Create your first team to organize projects and collaborate with others."
            action={<CreateTeamButton />}
          />
        ) : (
          <TeamList />
        )}
      </div>
    </>
  );
}
