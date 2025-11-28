'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useCreateTicket } from '@/hooks/use-tickets';
import { useProjectMembers } from '@/hooks/use-projects';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { TicketStatus, TicketPriority } from '@minute/db';

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const priorityOptions: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function CreateTicketDialog({
  open,
  onOpenChange,
  projectId,
}: CreateTicketDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TicketStatus>('backlog');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [points, setPoints] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('unassigned');

  const createTicket = useCreateTicket();
  const { data: members = [], isLoading: isLoadingMembers } = useProjectMembers(
    projectId,
    {
      enabled: open && !!projectId,
    }
  );
  const isLoading = createTicket.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    try {
      await createTicket.mutateAsync({
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assigneeId:
          assigneeId === 'unassigned' ? undefined : assigneeId || undefined,
        dueDate: dueDate ? Math.floor(dueDate.getTime() / 1000) : undefined,
        points: points ? parseInt(points, 10) : undefined,
      });

      // Reset form and close dialog on success
      setTitle('');
      setDescription('');
      setStatus('backlog');
      setPriority('medium');
      setDueDate(undefined);
      setPoints('');
      setAssigneeId('unassigned');
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error('Error creating ticket:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen);
      // Reset form when closing
      if (!newOpen) {
        setTitle('');
        setDescription('');
        setStatus('backlog');
        setPriority('medium');
        setDueDate(undefined);
        setPoints('');
        setAssigneeId('unassigned');
      }
    }
  };

  const getUserDisplayName = (user: { name: string | null; email: string }) => {
    return user.name || user.email;
  };

  const getUserInitials = (user: { name: string | null; email: string }) => {
    if (user.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email?.[0]?.toUpperCase() || '?';
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>
            Add a new ticket to track work and tasks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Enter ticket title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isLoading}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the ticket..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              maxLength={5000}
              rows={4}
            />
            <p className="text-muted-foreground text-xs">
              {description.length}/5000 characters
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as TicketStatus)}
                disabled={isLoading}
              >
                <SelectTrigger id="status">
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
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TicketPriority)}
                disabled={isLoading}
              >
                <SelectTrigger id="priority">
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
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dueDate && 'text-muted-foreground'
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(date) =>
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="points">Story Points (optional)</Label>
            <Input
              id="points"
              type="number"
              min="1"
              placeholder="e.g., 1, 2, 3, 5, 8, 13"
              value={points}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow positive integers
                if (value === '' || /^\d+$/.test(value)) {
                  setPoints(value);
                }
              }}
              disabled={isLoading}
            />
            <p className="text-muted-foreground text-xs">
              Estimate effort using story points
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignee">Assignee (optional)</Label>
            <Select
              value={assigneeId}
              onValueChange={setAssigneeId}
              disabled={isLoading || isLoadingMembers}
            >
              <SelectTrigger id="assignee">
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
                          alt={getUserDisplayName(member)}
                        />
                        <AvatarFallback className="text-xs">
                          {getUserInitials(member)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{getUserDisplayName(member)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={isLoading || !title.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
