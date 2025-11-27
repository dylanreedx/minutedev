'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateProjectButton } from './create-project-button';
import { useProjects } from '@/hooks/use-projects';

export default function ProjectsPage() {
  const { data: projects = [], isLoading, error } = useProjects();

  return (
    <>
      <Header title="Projects">
        <CreateProjectButton />
      </Header>

      <div className="p-6">
        {isLoading ? (
          <ProjectsGridSkeleton />
        ) : error ? (
          <ErrorState error={error} />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ProjectsGrid projects={projects} />
        )}
      </div>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
      <div className="mb-4 text-4xl">📋</div>
      <h3 className="mb-2 text-lg font-medium">No projects yet</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Create your first project to get started
      </p>
      <CreateProjectButton />
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
  }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Link key={project.id} href={`/projects/${project.slug}`}>
          <Card className="transition-colors hover:bg-accent/50 cursor-pointer h-full">
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
                {/* Ticket count will be added in Phase 3 */}
                <span>0 tickets</span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
