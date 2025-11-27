import { getProject } from "@/actions/projects";
import { TicketsTableClient } from "./tickets-table-client";

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

  return <TicketsTableClient slug={slug} projectId={project.id} projectName={project.name} />;
}

