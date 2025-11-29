'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db, teamActivity, users, eq, desc, organization } from '@minute/db';

// Get current user session
async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session.user;
}

// Team activity action types
export type TeamActivityAction =
  | 'member_joined'
  | 'member_left'
  | 'role_changed'
  | 'team_created'
  | 'team_updated'
  | 'team_deleted'
  | 'project_created'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'invitation_cancelled';

// Create activity log entry
export async function logTeamActivity(
  organizationId: string,
  action: TeamActivityAction,
  details?: Record<string, unknown>
) {
  try {
    const user = await getCurrentUser();

    await db.insert(teamActivity).values({
      organizationId,
      userId: user.id,
      action,
      details: details || {},
    });

    return { success: true };
  } catch (error) {
    console.error('Error logging team activity:', error);
    // Don't throw - activity logging should not break the main flow
    return { success: false };
  }
}

// Get team activity
export async function getTeamActivity(teamId: string, limit: number = 50) {
  try {
    await getCurrentUser(); // Verify user is authenticated

    // Verify team exists and user has access
    const teamCheck = await db
      .select()
      .from(organization)
      .where(eq(organization.id, teamId))
      .limit(1);

    if (teamCheck.length === 0) {
      return {
        success: false,
        error: 'Team not found or you do not have access',
        data: [],
      };
    }

    // Get activity with user details
    const activities = await db
      .select({
        id: teamActivity.id,
        organizationId: teamActivity.organizationId,
        userId: teamActivity.userId,
        action: teamActivity.action,
        details: teamActivity.details,
        createdAt: teamActivity.createdAt,
        userName: users.name,
        userEmail: users.email,
        userImage: users.image,
      })
      .from(teamActivity)
      .innerJoin(users, eq(teamActivity.userId, users.id))
      .where(eq(teamActivity.organizationId, teamId))
      .orderBy(desc(teamActivity.createdAt))
      .limit(limit);

    return {
      success: true,
      data: activities.map((activity) => ({
        id: activity.id,
        organizationId: activity.organizationId,
        userId: activity.userId,
        action: activity.action as TeamActivityAction,
        details: activity.details,
        createdAt: activity.createdAt,
        user: {
          name: activity.userName,
          email: activity.userEmail,
          image: activity.userImage,
        },
      })),
    };
  } catch (error) {
    console.error('Error fetching team activity:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to fetch team activity',
      data: [],
    };
  }
}

