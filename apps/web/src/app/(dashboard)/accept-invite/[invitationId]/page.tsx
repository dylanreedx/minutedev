import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { authClient } from "@/lib/auth-client";
import { AcceptInviteClient } from "./accept-invite-client";

interface AcceptInvitePageProps {
  params: Promise<{ invitationId: string }>;
}

export default async function AcceptInvitePage({
  params,
}: AcceptInvitePageProps) {
  const { invitationId } = await params;

  // Check if user is logged in (but don't redirect - allow viewing invitation)
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Get invitation details (works even without session for link-based invites)
  try {
    const invitation = await auth.api.getInvitation({
      headers: await headers(),
      query: {
        id: invitationId,
      },
    });

    if (!invitation) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Invitation Not Found</h1>
            <p className="mt-2 text-muted-foreground">
              This invitation may have expired or been cancelled.
            </p>
          </div>
        </div>
      );
    }

    // Check if already accepted
    if (invitation.status === "accepted") {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Invitation Already Accepted</h1>
            <p className="mt-2 text-muted-foreground">
              This invitation has already been accepted.
            </p>
          </div>
        </div>
      );
    }

    // Check if expired
    if (
      invitation.expiresAt &&
      new Date(invitation.expiresAt) < new Date()
    ) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Invitation Expired</h1>
            <p className="mt-2 text-muted-foreground">
              This invitation has expired. Please request a new invitation.
            </p>
          </div>
        </div>
      );
    }

    // Get organization name for display
    let organizationName = "the team";
    try {
      const { getClient } = await import("@minute/db");
      const client = getClient();
      const orgResult = await client.execute({
        sql: `SELECT name FROM organization WHERE id = ? LIMIT 1`,
        args: [invitation.organizationId],
      });
      if (orgResult.rows?.[0]) {
        const row = orgResult.rows[0] as unknown as { name: string };
        organizationName = row.name;
      }
    } catch (error) {
      console.error("Error fetching organization name:", error);
    }

    return (
      <AcceptInviteClient
        invitationId={invitationId}
        invitation={invitation}
        organizationName={organizationName}
        isAuthenticated={!!session}
      />
    );
  } catch (error) {
    console.error("Error fetching invitation:", error);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Error</h1>
          <p className="mt-2 text-muted-foreground">
            Failed to load invitation. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}


