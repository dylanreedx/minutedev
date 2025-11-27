import Link from "next/link";
import { List, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Kanban board page - will be fully implemented in Phase 3 (MIN-16)
interface BoardPageProps {
  params: Promise<{ slug: string }>;
}

const columns = [
  { id: "backlog", name: "Backlog", color: "bg-muted" },
  { id: "todo", name: "Todo", color: "bg-blue-500/10" },
  { id: "in_progress", name: "In Progress", color: "bg-yellow-500/10" },
  { id: "done", name: "Done", color: "bg-green-500/10" },
];

export default async function BoardPage({ params }: BoardPageProps) {
  const { slug } = await params;
  
  return (
    <>
      <Header title={slug}>
        <Link href={`/projects/${slug}/list`}>
          <Button variant="outline" size="sm">
            <List className="mr-2 h-4 w-4" />
            List View
          </Button>
        </Link>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Ticket
        </Button>
      </Header>

      {/* Board columns placeholder */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4">
          {columns.map((column) => (
            <div
              key={column.id}
              className={`min-w-[300px] flex-shrink-0 rounded-lg ${column.color} p-4`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium">{column.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  0
                </Badge>
              </div>
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-background/50 p-8 text-center">
                <p className="text-sm text-muted-foreground">No tickets</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

