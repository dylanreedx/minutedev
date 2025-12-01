"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  Paperclip, 
  Trash2, 
  Download, 
  Image as ImageIcon, 
  FileText, 
  Film, 
  File,
  Upload,
  X,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { useAttachments, useCreateAttachment, useDeleteAttachment } from "@/hooks/use-attachments";
import { useSession } from "@/lib/auth-client";
import { UploadDropzone } from "@/lib/uploadthing-client";

interface AttachmentsSectionProps {
  ticketId: string;
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Get icon based on file type
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className="h-4 w-4" />;
  }
  if (mimeType.startsWith("video/")) {
    return <Film className="h-4 w-4" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

// Check if file is previewable image
function isPreviewableImage(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
}

export function AttachmentsSection({ ticketId }: AttachmentsSectionProps) {
  const { data: session } = useSession();
  const { data: attachments = [], isLoading } = useAttachments(ticketId);
  const createAttachment = useCreateAttachment();
  const deleteAttachment = useDeleteAttachment();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteAttachment.mutateAsync(deletingId);
      setDeletingId(null);
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const formatDate = (date: Date | number) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return formatDistanceToNow(dateObj, { addSuffix: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Attachments</h3>
          {attachments.length > 0 && (
            <span className="text-xs text-muted-foreground">({attachments.length})</span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowUploader(!showUploader);
          }}
          className="h-7 text-xs"
        >
          {showUploader ? (
            <>
              <X className="mr-1 h-3 w-3" />
              Cancel
            </>
          ) : (
            <>
              <Upload className="mr-1 h-3 w-3" />
              Add File
            </>
          )}
        </Button>
      </div>

      <Separator />

      {/* Upload Dropzone - supports drag and drop */}
      {showUploader && (
        <div className="rounded-lg border border-dashed border-primary/20 bg-muted/30 p-6">
          <UploadDropzone
            endpoint="ticketAttachment"
            onClientUploadComplete={(res) => {
              // Create attachment records for each uploaded file
              res.forEach((file) => {
                createAttachment.mutate({
                  ticketId,
                  fileKey: file.key,
                  fileName: file.name,
                  fileUrl: file.ufsUrl,
                  fileSize: file.size,
                  fileType: file.type,
                });
              });
              setShowUploader(false);
            }}
            onUploadError={(error: Error) => {
              console.error("Upload error:", error);
            }}
            onDrop={(acceptedFiles) => {
              // Files are automatically handled by UploadDropzone
              // This callback is just for logging/UI feedback
              console.log("Files dropped:", acceptedFiles.length);
            }}
            appearance={{
              container: "border-none p-0",
              uploadIcon: "text-muted-foreground",
              label: "text-sm text-muted-foreground cursor-pointer",
              allowedContent: "text-xs text-muted-foreground",
              button: "text-xs bg-primary text-primary-foreground hover:bg-primary/90",
            }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
              <div className="h-10 w-10 rounded bg-muted animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const isOwnAttachment = session?.user?.id === attachment.userId;
            
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors group"
              >
                {/* Preview/Icon */}
                {isPreviewableImage(attachment.fileType) ? (
                  <a 
                    href={attachment.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <img
                      src={attachment.fileUrl}
                      alt={attachment.fileName}
                      className="h-10 w-10 rounded object-cover"
                    />
                  </a>
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    {getFileIcon(attachment.fileType)}
                  </div>
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <a
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {attachment.fileName}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.fileSize)} • {formatDate(attachment.createdAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    asChild
                  >
                    <a href={attachment.fileUrl} download={attachment.fileName}>
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  {isOwnAttachment && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(attachment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No attachments yet. Click &quot;Add File&quot; to upload.
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAttachment.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteAttachment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAttachment.isPending ? (
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
    </div>
  );
}

