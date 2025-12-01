"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTicket, useUpdateTicket, useDeleteTicket } from "@/hooks/use-tickets";
import { useProjectMembers } from "@/hooks/use-projects";
import { CommentsSection } from "@/components/tickets/comments-section";
import { AttachmentsSection } from "@/components/tickets/attachments-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TicketStatus, TicketPriority } from "@minute/db";

interface EditTicketSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  projectId?: string; // Optional: if provided, will use cached list data for instant status display
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

export function EditTicketSheet({
  open,
  onOpenChange,
  ticketId,
  projectId,
}: EditTicketSheetProps) {
  const { data: ticket, isLoading: isLoadingTicket } = useTicket(ticketId || "", {
    enabled: !!ticketId && open,
    projectId, // Pass projectId to enable cache lookup for instant status display
  });
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TicketStatus>("backlog");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [points, setPoints] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch project members for assignee selection
  const { data: members = [], isLoading: isLoadingMembers } = useProjectMembers(
    ticket?.projectId || "",
    {
      enabled: !!ticket?.projectId && open,
    }
  );

  // Initialize form when ticket data loads
  useEffect(() => {
    if (ticket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(ticket.title);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDescription(ticket.description || "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(ticket.status);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPriority(ticket.priority);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDueDate(
        ticket.dueDate
          ? ticket.dueDate instanceof Date
            ? ticket.dueDate
            : new Date(ticket.dueDate)
          : undefined
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPoints(ticket.points?.toString() || "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssigneeId(ticket.assigneeId || "unassigned");
    }
  }, [ticket]);

  const isLoading = updateTicket.isPending || deleteTicket.isPending;
  const isFormLoading = isLoadingTicket || isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticketId || !title.trim()) {
      return;
    }

    try {
      await updateTicket.mutateAsync({
        id: ticketId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assigneeId: assigneeId === "unassigned" ? null : assigneeId || null,
        dueDate: dueDate ? Math.floor(dueDate.getTime() / 1000) : null,
        points: points ? parseInt(points, 10) : null,
      });

      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Error updating ticket:", error);
    }
  };

  const handleDelete = async () => {
    if (!ticketId) return;

    try {
      await deleteTicket.mutateAsync(ticketId);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Error deleting ticket:", error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setShowDeleteConfirm(false);
      }
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col h-full p-0">
          <SheetHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <SheetTitle>Edit Ticket</SheetTitle>
            <SheetDescription>
              Update ticket details and information.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 flex flex-col overflow-hidden">
            {isLoadingTicket ? (
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="h-24 w-full bg-muted animate-pulse rounded" />
                </div>
              </div>
            ) : ticket ? (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-title"
                    placeholder="Enter ticket title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    disabled={isFormLoading}
                    maxLength={200}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <RichTextEditor
                    content={description}
                    onChange={setDescription}
                    placeholder="Describe the ticket..."
                    disabled={isFormLoading}
                    minHeight="100px"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as TicketStatus)}
                      disabled={isFormLoading}
                    >
                      <SelectTrigger id="edit-status">
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
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select
                      value={priority}
                      onValueChange={(value) => setPriority(value as TicketPriority)}
                      disabled={isFormLoading}
                    >
                      <SelectTrigger id="edit-priority">
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
                  <Label>Due Date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dueDate && "text-muted-foreground"
                        )}
                        disabled={isFormLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-points">Story Points (optional)</Label>
                  <Input
                    id="edit-points"
                    type="number"
                    min="1"
                    placeholder="e.g., 1, 2, 3, 5, 8, 13"
                    value={points}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow positive integers
                      if (value === "" || /^\d+$/.test(value)) {
                        setPoints(value);
                      }
                    }}
                    disabled={isFormLoading}
                  />
                  <p className="text-muted-foreground text-xs">
                    Estimate effort using story points
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-assignee">Assignee</Label>
                  <Select
                    value={assigneeId}
                    onValueChange={setAssigneeId}
                    disabled={isFormLoading || isLoadingMembers}
                  >
                    <SelectTrigger id="edit-assignee">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={member.image || undefined}
                                alt={member.name || member.email}
                              />
                              <AvatarFallback className="text-xs">
                                {(member.name || member.email || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{member.name || member.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {ticketId && (
                  <>
                    <div className="pt-4 border-t">
                      <AttachmentsSection ticketId={ticketId} />
                    </div>
                    <div className="pt-4 border-t">
                      <CommentsSection ticketId={ticketId} />
                    </div>
                  </>
                )}
                </div>

                <SheetFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4 pb-6 px-6 border-t bg-muted/50 flex-shrink-0">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isFormLoading}
                    className="w-full sm:w-auto sm:mr-auto order-2 sm:order-1"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                  <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenChange(false)}
                      disabled={isFormLoading}
                      className="flex-1 sm:flex-initial"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isFormLoading || !title.trim()} className="flex-1 sm:flex-initial">
                      {isFormLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </SheetFooter>
              </form>
            ) : (
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="py-4 text-center text-muted-foreground">
                  Ticket not found
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the ticket
              &quot;{ticket?.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

