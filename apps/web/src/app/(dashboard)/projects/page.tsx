'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Settings, ClipboardList } from 'lucide-react';
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
import { CreateProjectButton } from './create-project-button';
import { EditProjectSheet } from '@/components/projects';
import { useProjects } from '@/hooks/use-projects';

export default function ProjectsPage() {
  const { data: projects = [], isLoading, error } = useProjects();
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{
    slug: string;
  } | null>(null);

  const handleEdit = (e: React.MouseEvent, project: { slug: string }) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProject(project);
    setEditSheetOpen(true);
  };

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
          <EmptyState
            icon={ClipboardList}
            title="No projects yet"
            description="Create your first project to get started tracking your work."
            action={<CreateProjectButton />}
          />
        ) : (
          <ProjectsGrid projects={projects} onEdit={handleEdit} />
        )}
      </div>

      {selectedProject && (
        <EditProjectSheet
          open={editSheetOpen}
          onOpenChange={setEditSheetOpen}
          projectSlug={selectedProject.slug}
        />
      )}
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
  onEdit,
}: {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    slug: string;
    ticketCount?: number;
  }>;
  onEdit: (e: React.MouseEvent, project: { slug: string }) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card
          key={project.id}
          className="transition-colors hover:bg-accent/50 h-full flex flex-col relative"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 z-10"
            onClick={(e) => onEdit(e, project)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Link href={`/projects/${project.slug}`} className="flex-1">
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
