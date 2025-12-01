"use client";

import { useState } from "react";
import { FileText, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTemplates } from "@/hooks/use-templates";
import { TemplateDialog } from "./template-dialog";
import type { TicketTemplate } from "@minute/db";

interface TemplateSelectorProps {
  projectId: string;
  onSelectTemplate: (template: TicketTemplate) => void;
}

export function TemplateSelector({
  projectId,
  onSelectTemplate,
}: TemplateSelectorProps) {
  const { data: templates = [], isLoading } = useTemplates(projectId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="h-8">
        <FileText className="mr-2 h-3.5 w-3.5" />
        Loading...
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <FileText className="mr-2 h-3.5 w-3.5" />
            Use Template
            <ChevronDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {templates.length > 0 ? (
            <>
              {templates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => onSelectTemplate(template)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{template.name}</span>
                    {template.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {template.description}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : (
            <DropdownMenuItem disabled>
              <span className="text-muted-foreground">No templates yet</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
      />
    </>
  );
}

