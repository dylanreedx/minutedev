"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

interface AcceptInviteClientProps {
  invitationId: string;
  invitation: {
    id: string;
    email: string;
    organizationId: string;
    role?: string;
    expiresAt?: Date | string;
    status?: string;
  };
}

export function AcceptInviteClient({
  invitationId,
  invitation,
}: AcceptInviteClientProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [status, setStatus] = useState<"idle" | "accepted" | "rejected">("idle");

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await authClient.organization.acceptInvitation({
        body: {
          invitationId,
        },
      });

      setStatus("accepted");
      // Redirect to projects page after a short delay
      setTimeout(() => {
        router.push("/projects");
      }, 2000);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to accept invitation. Please try again."
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await authClient.organization.rejectInvitation({
        body: {
          invitationId,
        },
      });

      setStatus("rejected");
      // Redirect to projects page after a short delay
      setTimeout(() => {
        router.push("/projects");
      }, 2000);
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to reject invitation. Please try again."
      );
    } finally {
      setIsRejecting(false);
    }
  };

  if (status === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Invitation Accepted!</CardTitle>
            <CardDescription>
              You've successfully joined the team. Redirecting...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <XCircle className="h-6 w-6 text-gray-600" />
            </div>
            <CardTitle>Invitation Declined</CardTitle>
            <CardDescription>
              You've declined the invitation. Redirecting...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
            <CardTitle>Team Invitation</CardTitle>
            <CardDescription>
              You've been invited to join a team.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Email:</p>
            <p className="text-sm text-muted-foreground">{invitation.email}</p>
          </div>

          {invitation.role && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Role:</p>
              <p className="text-sm text-muted-foreground capitalize">
                {invitation.role}
              </p>
            </div>
          )}

          {invitation.expiresAt && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Expires:</p>
              <p className="text-sm text-muted-foreground">
                {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={isAccepting || isRejecting}
              className="flex-1"
            >
              {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isAccepting || isRejecting}
              className="flex-1"
            >
              {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept Invitation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

