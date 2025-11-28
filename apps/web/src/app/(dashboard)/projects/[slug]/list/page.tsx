import { getProject } from "@/actions/projects";
import { TicketsTableClient } from "./tickets-table-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ListPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ListPage({ params }: ListPageProps) {
  const { slug } = await params;
  const projectResult = await getProject(slug);
  const project = projectResult.success ? projectResult.data : null;

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <ErrorBoundary>
      <TicketsTableClient slug={slug} projectId={project.id} projectName={project.name} />
    </ErrorBoundary>
  );
}

