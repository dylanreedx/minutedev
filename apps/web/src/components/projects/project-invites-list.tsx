"use client";

import { Copy, Check, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useProjectInvitations, useCancelProjectInvitation } from "@/hooks/use-projects";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectInvitesListProps {
  projectId: string;
}

export function ProjectInvitesList({ projectId }: ProjectInvitesListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { data: invitations, isLoading } = useProjectInvitations(projectId);
  const cancelInvitation = useCancelProjectInvitation();

  const handleCopyLink = async (link: string, invitationId: string) => {
    await navigator.clipboard.writeText(link);
    setCopiedId(invitationId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCancel = async (invitationId: string) => {
    try {
      await cancelInvitation.mutateAsync({
        invitationId,
        projectId,
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>Manage project invitations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!invitations || invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>No pending invitations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Invite team members to collaborate.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
        <CardDescription>
          {invitations.length} pending team invitation{invitations.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {invitations.map((invitation) => {
          const isExpired = invitation.expiresAt
            ? new Date(invitation.expiresAt) < new Date()
            : false;
          const isCopied = copiedId === invitation.id;

          return (
            <div
              key={invitation.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{invitation.email}</p>
                  <Badge variant={isExpired ? "destructive" : "secondary"}>
                    {isExpired ? "Expired" : "Pending"}
                  </Badge>
                  {invitation.role && (
                    <Badge variant="outline">{invitation.role}</Badge>
                  )}
                </div>
                {invitation.expiresAt && (
                  <p className="text-sm text-muted-foreground">
                    Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {invitation.inviteLink && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleCopyLink(invitation.inviteLink!, invitation.id)
                    }
                  >
                    {isCopied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Link
                      </>
                    )}
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <X className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel the invitation for{" "}
                        <strong>{invitation.email}</strong>? They will no longer
                        be able to accept this invitation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Invitation</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancel(invitation.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Cancel Invitation
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

