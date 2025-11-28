"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Edit2, Trash2, Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from "@/hooks/use-comments";
import { useSession } from "@/lib/auth-client";
import { Separator } from "@/components/ui/separator";

interface CommentsSectionProps {
  ticketId: string;
}

type CommentWithUser = {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  parentId: string | null;
  createdAt: Date | number;
  updatedAt: Date | number;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

export function CommentsSection({ ticketId }: CommentsSectionProps) {
  const { data: session } = useSession();
  const { data: comments = [], isLoading } = useComments(ticketId);
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!newComment.trim() || !ticketId) return;

    try {
      await createComment.mutateAsync({
        ticketId,
        content: newComment.trim(),
      });
      setNewComment("");
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit();
    }
  };

  const handleStartEdit = (comment: CommentWithUser) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;

    try {
      await updateComment.mutateAsync({
        id: editingId,
        content: editContent.trim(),
      });
      setEditingId(null);
      setEditContent("");
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteComment.mutateAsync(deletingId);
      setDeletingId(null);
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const formatDate = (date: Date | number) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return formatDistanceToNow(dateObj, { addSuffix: true });
  };

  const isEdited = (createdAt: Date | number, updatedAt: Date | number) => {
    // Check if comment was edited (allow 2 second tolerance for timing differences)
    const created = createdAt instanceof Date 
      ? createdAt.getTime() 
      : new Date(createdAt).getTime();
    const updated = updatedAt instanceof Date 
      ? updatedAt.getTime() 
      : new Date(updatedAt).getTime();
    const timeDiff = Math.abs(updated - created);
    // If difference is more than 2 seconds, consider it edited
    return timeDiff > 2000;
  };

  // Group comments by parent (threading)
  const rootComments = comments.filter((c) => !c.parentId);
  const repliesMap = new Map<string, CommentWithUser[]>();
  comments.forEach((c) => {
    if (c.parentId) {
      if (!repliesMap.has(c.parentId)) {
        repliesMap.set(c.parentId, []);
      }
      repliesMap.get(c.parentId)!.push(c);
    }
  });

  const renderComment = (comment: CommentWithUser, isReply = false) => {
    const isOwnComment = session?.user?.id === comment.userId;
    const isEditing = editingId === comment.id;
    const replies = repliesMap.get(comment.id) || [];

    return (
      <div key={comment.id} className={isReply ? "ml-8 mt-3" : ""}>
        <div className="flex gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={comment.user.image || undefined} alt={comment.user.name || comment.user.email} />
            <AvatarFallback>
              {getUserInitials(comment.user.name, comment.user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {comment.user.name || comment.user.email}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(comment.createdAt)}
                    {isEdited(comment.createdAt, comment.updatedAt) && " (edited)"}
                  </span>
                </div>
                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="min-h-[60px]"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updateComment.isPending || !editContent.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={updateComment.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                )}
              </div>
              {isOwnComment && !isEditing && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleStartEdit(comment)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeletingId(comment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {replies.length > 0 && (
              <div className="mt-3 space-y-3">
                {replies.map((reply) => renderComment(reply, true))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Comments</h3>
        {comments.length > 0 && (
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        )}
      </div>

      <Separator />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-16 w-full bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {rootComments.length > 0 ? (
            <div className="space-y-4">
              {rootComments.map((comment) => renderComment(comment))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No comments yet. Be the first to comment!
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="min-h-[60px] resize-none"
              disabled={createComment.isPending}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={createComment.isPending || !newComment.trim()}
              >
                {createComment.isPending ? (
                  <>
                    <Send className="mr-2 h-3.5 w-3.5 animate-pulse" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-3.5 w-3.5" />
                    Post Comment
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteComment.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteComment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteComment.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



