"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

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
  organizationName: string;
  isAuthenticated: boolean;
}

export function AcceptInviteClient({
  invitationId,
  invitation,
  organizationName,
  isAuthenticated,
}: AcceptInviteClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [status, setStatus] = useState<"idle" | "accepted" | "rejected">("idle");
  const [checkingAuth, setCheckingAuth] = useState(!isAuthenticated);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Check if user just authenticated (e.g., after signup/login redirect)
  // This runs on mount and when authentication state changes
  useEffect(() => {
    const checkAndAccept = async () => {
      // Only check if we haven't already checked and user is authenticated
      if (hasCheckedAuth) return;
      
      try {
        const session = await authClient.getSession();
        if (session && isAuthenticated) {
          setHasCheckedAuth(true);
          setCheckingAuth(false);
          
          // User is authenticated, try to accept invitation automatically
          setIsAccepting(true);
          try {
            await authClient.organization.acceptInvitation({
              invitationId,
            });
            setStatus("accepted");
            toast.success("Successfully joined the team!");
            setTimeout(() => {
              router.push("/projects");
            }, 2000);
          } catch (error) {
            console.error("Error accepting invitation:", error);
            setIsAccepting(false);
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to accept invitation. Please try again."
            );
          }
        } else if (!session && !isAuthenticated) {
          // User is not authenticated, stop checking
          setCheckingAuth(false);
          setHasCheckedAuth(true);
        }
      } catch (error) {
        // Error checking session, stop checking
        setCheckingAuth(false);
        setHasCheckedAuth(true);
      }
    };

    // Check immediately if user is authenticated
    if (isAuthenticated && !hasCheckedAuth) {
      checkAndAccept();
    } else if (!isAuthenticated && !hasCheckedAuth) {
      // If not authenticated, check once after a short delay to catch redirects
      const timer = setTimeout(() => {
        checkAndAccept();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, invitationId, router, hasCheckedAuth]);

  // Also check when search params change (e.g., after redirect from auth)
  useEffect(() => {
    if (searchParams.get("accepted") === "true") {
      // User was redirected here after accepting, but let's verify
      if (isAuthenticated && !hasCheckedAuth) {
        setHasCheckedAuth(true);
        setCheckingAuth(false);
      }
    }
  }, [searchParams, isAuthenticated, hasCheckedAuth]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await authClient.organization.acceptInvitation({
        invitationId,
      });

      setStatus("accepted");
      toast.success("Successfully joined the team!");
      // Redirect to projects page after a short delay
      setTimeout(() => {
        router.push("/projects");
      }, 2000);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast.error(
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
        invitationId,
      });

      setStatus("rejected");
      toast.info("Invitation declined");
      // Redirect to projects page after a short delay
      setTimeout(() => {
        router.push("/projects");
      }, 2000);
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      toast.error(
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
              You've successfully joined {organizationName}. Redirecting...
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

  // Show signup/login prompt for non-authenticated users
  if (!isAuthenticated && !checkingAuth) {
    const isLinkBasedInvite = invitation.email.includes("@team.invite");
    
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Join {organizationName}</CardTitle>
            <CardDescription>
              {isLinkBasedInvite
                ? "Create an account to join this team."
                : `You've been invited to join ${organizationName} as a ${invitation.role || "member"}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isLinkBasedInvite && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Invited Email:</p>
                <p className="text-sm text-muted-foreground">{invitation.email}</p>
              </div>
            )}

            {invitation.role && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Role:</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {invitation.role}
                </p>
              </div>
            )}

            <div className="space-y-3 pt-4">
              <Button
                asChild
                className="w-full"
              >
                <Link href={`/register?invite=${invitationId}`}>
                  Create Account
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full"
              >
                <Link href={`/login?redirect=/accept-invite/${invitationId}`}>
                  Sign In
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (checkingAuth || isAccepting) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <CardTitle className="mt-4">
              {isAccepting ? "Accepting invitation..." : "Checking..."}
            </CardTitle>
            <CardDescription>
              {isAccepting 
                ? "Please wait while we add you to the team."
                : "Verifying your account..."}
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
              You've been invited to join {organizationName}.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

