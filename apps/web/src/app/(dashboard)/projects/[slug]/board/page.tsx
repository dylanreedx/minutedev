import { getProject } from "@/actions/projects";
import { BoardPageClient } from "./board-client";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface BoardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { slug } = await params;
  const projectResult = await getProject(slug);
  const project = projectResult.success ? projectResult.data : null;

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <ErrorBoundary>
      <BoardPageClient slug={slug} projectId={project.id} projectName={project.name} />
    </ErrorBoundary>
  );
}

