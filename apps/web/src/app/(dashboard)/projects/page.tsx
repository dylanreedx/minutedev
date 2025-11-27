import { Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

// Project list page - will be fully implemented in Phase 2 (MIN-11)
export default function ProjectsPage() {
  return (
    <>
      <Header title="Projects">
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </Header>
      
      <div className="p-6">
        {/* Empty state placeholder */}
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="mb-4 text-4xl">📋</div>
          <h3 className="mb-2 text-lg font-medium">No projects yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first project to get started
          </p>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </div>
      </div>
    </>
  );
}

