"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useCreateTemplate, useUpdateTemplate } from "@/hooks/use-templates";
import type { TicketStatus, TicketPriority, TicketTemplate } from "@minute/db";

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  template?: TicketTemplate | null; // If provided, edit mode
}

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TemplateDialog({
  open,
  onOpenChange,
  projectId,
  template,
}: TemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [titleTemplate, setTitleTemplate] = useState("");
  const [descriptionTemplate, setDescriptionTemplate] = useState("");
  const [defaultStatus, setDefaultStatus] = useState<TicketStatus>("backlog");
  const [defaultPriority, setDefaultPriority] = useState<TicketPriority>("medium");
  const [defaultPoints, setDefaultPoints] = useState<string>("");

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const isLoading = createTemplate.isPending || updateTemplate.isPending;
  const isEditMode = !!template;

  // Initialize form when template data loads (edit mode)
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setTitleTemplate(template.titleTemplate || "");
      setDescriptionTemplate(template.descriptionTemplate || "");
      setDefaultStatus(template.defaultStatus || "backlog");
      setDefaultPriority(template.defaultPriority || "medium");
      setDefaultPoints(template.defaultPoints?.toString() || "");
    } else {
      // Reset form for create mode
      setName("");
      setDescription("");
      setTitleTemplate("");
      setDescriptionTemplate("");
      setDefaultStatus("backlog");
      setDefaultPriority("medium");
      setDefaultPoints("");
    }
  }, [template, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      return;
    }

    try {
      if (isEditMode && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          name: name.trim(),
          description: description.trim() || undefined,
          titleTemplate: titleTemplate.trim() || undefined,
          descriptionTemplate: descriptionTemplate || undefined,
          defaultStatus,
          defaultPriority,
          defaultPoints: defaultPoints ? parseInt(defaultPoints, 10) : null,
        });
      } else {
        await createTemplate.mutateAsync({
          projectId,
          name: name.trim(),
          description: description.trim() || undefined,
          titleTemplate: titleTemplate.trim() || undefined,
          descriptionTemplate: descriptionTemplate || undefined,
          defaultStatus,
          defaultPriority,
          defaultPoints: defaultPoints ? parseInt(defaultPoints, 10) : undefined,
        });
      }

      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Error saving template:", error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Template" : "Create Ticket Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the template settings."
              : "Create a template to quickly create similar tickets."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Template Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              placeholder="e.g., Bug Report, Feature Request"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">
              Template Description (optional)
            </Label>
            <Input
              id="template-description"
              placeholder="Brief description of when to use this template"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title-template">Title Prefix (optional)</Label>
            <Input
              id="title-template"
              placeholder="e.g., [BUG] or [FEATURE]"
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
              disabled={isLoading}
              maxLength={50}
            />
            <p className="text-muted-foreground text-xs">
              Will be prepended to the ticket title
            </p>
          </div>

          <div className="space-y-2">
            <Label>Description Template (optional)</Label>
            <RichTextEditor
              content={descriptionTemplate}
              onChange={setDescriptionTemplate}
              placeholder="Pre-filled description for tickets using this template..."
              disabled={isLoading}
              minHeight="100px"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-status">Default Status</Label>
              <Select
                value={defaultStatus}
                onValueChange={(value) => setDefaultStatus(value as TicketStatus)}
                disabled={isLoading}
              >
                <SelectTrigger id="default-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-priority">Default Priority</Label>
              <Select
                value={defaultPriority}
                onValueChange={(value) => setDefaultPriority(value as TicketPriority)}
                disabled={isLoading}
              >
                <SelectTrigger id="default-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-points">Default Story Points (optional)</Label>
            <Input
              id="default-points"
              type="number"
              min="1"
              placeholder="e.g., 1, 2, 3, 5, 8, 13"
              value={defaultPoints}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d+$/.test(value)) {
                  setDefaultPoints(value);
                }
              }}
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? "Saving..." : "Creating..."}
                </>
              ) : isEditMode ? (
                "Save Changes"
              ) : (
                "Create Template"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

