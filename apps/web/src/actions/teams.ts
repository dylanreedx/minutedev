'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getClient, db, users, inArray, eq } from '@minute/db';
import { z } from 'zod';
import { logTeamActivity } from './team-activity';

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

// Validation schemas
const createTeamSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100).optional(),
});

const updateTeamSchema = z.object({
  teamId: z.string(),
  name: z.string().min(1, 'Name is required').max(100).optional(),
  slug: z.string().min(1, 'Slug is required').max(100).optional(),
});

// Export types for use in hooks
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

// Utility function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Create a new team (Better Auth organization)
 */
export async function createTeam(input: z.infer<typeof createTeamSchema>) {
  try {
    const user = await getCurrentUser();
    const validated = createTeamSchema.parse(input);

    // Generate slug if not provided
    const slug = validated.slug || generateSlug(validated.name);

    // Create team via Better Auth organization API
    try {
      const requestHeaders = await headers();
      const request = new Request(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(requestHeaders.entries()),
          },
          body: JSON.stringify({
            name: validated.name,
            slug,
          }),
        }
      );

      const response = await auth.handler(request);
      
      // Handle response - read as text first, then try to parse as JSON
      const responseText = await response.text();
      
      // Parse response regardless of status code
      let team;
        try {
          team = JSON.parse(responseText);
        } catch {
          console.error('Failed to parse JSON response:', responseText);
        if (!response.ok) {
          return {
            success: false,
            error: 'Failed to create team: Invalid response from server',
          };
        }
      }

      // Check if response indicates an error
      if (!response.ok || team?.error || (!team?.id && team?.message)) {
        // If slug already exists, check if team was actually created
        if (team?.error?.includes('already exists') || team?.message?.includes('already exists')) {
          // Try to find the existing team by slug
          try {
            const client = getClient();
            const existingTeam = await client.execute({
              sql: `SELECT id, name, slug FROM organization WHERE slug = ? LIMIT 1`,
              args: [slug],
            });

            if (existingTeam.rows && existingTeam.rows.length > 0) {
              const row = existingTeam.rows[0] as unknown as { id: string; name: string; slug: string };
              if (!row) {
                throw new Error('Failed to get team row');
              }
              // Check if user is already a member
              const memberCheck = await client.execute({
                sql: `SELECT id FROM member WHERE organization_id = ? AND user_id = ? LIMIT 1`,
                args: [row.id, user.id],
              });

              if (memberCheck.rows && memberCheck.rows.length > 0) {
                // User is already a member, return the existing team
                return {
                  success: true,
                  data: {
                    id: row.id,
                    name: row.name,
                    slug: row.slug,
                  },
                };
              }
            }
          } catch (checkError) {
            console.error('Error checking existing team:', checkError);
          }
        }

        // Return the error
        const errorMessage = team?.error || team?.message || 'Failed to create team';
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Ensure we have a valid team ID
      if (!team?.id) {
        return {
          success: false,
          error: 'Failed to create team: No team ID returned',
        };
      }

      // Revalidate teams list page
      revalidatePath('/teams');
      revalidatePath('/projects');

      // Log team creation activity
      await logTeamActivity(team.id, 'team_created', {
        teamName: validated.name,
      });

      return { success: true, data: team };
    } catch (error) {
      console.error('Error creating team:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create team',
      };
    }
  } catch (error) {
    console.error('Error creating team:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.issues,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to create team',
    };
  }
}

/**
 * Get all teams (organizations) for the current user
 * Optimized query includes project and member counts in a single query
 */
export async function getTeams() {
  try {
    const user = await getCurrentUser(); // Need user.id for query

    // Use Better Auth API to get user's organizations
    // Query the database directly using the libSQL client with optimized counts
    try {
      const client = getClient();

      // Execute optimized SQL query with project and member counts
      const result = await client.execute({
        sql: `
          SELECT 
            o.id, 
            o.name, 
            o.slug, 
            o.logo, 
            o.metadata, 
            o.created_at as createdAt,
            COALESCE(project_counts.project_count, 0) as projectCount,
            COALESCE(member_counts.member_count, 0) as memberCount
          FROM organization o
          INNER JOIN member m ON o.id = m.organization_id
          LEFT JOIN (
            SELECT organization_id, COUNT(*) as project_count
            FROM projects
            GROUP BY organization_id
          ) project_counts ON o.id = project_counts.organization_id
          LEFT JOIN (
            SELECT organization_id, COUNT(*) as member_count
            FROM member
            GROUP BY organization_id
          ) member_counts ON o.id = member_counts.organization_id
          WHERE m.user_id = ?
          GROUP BY o.id, o.name, o.slug, o.logo, o.metadata, o.created_at, project_counts.project_count, member_counts.member_count
          ORDER BY o.created_at DESC
        `,
        args: [user.id],
      });

      // Convert rows to proper format
      const teamsList = (result.rows || []).map((row: Record<string, unknown>) => {
        // libSQL returns rows as objects with column names
        const metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null;
        return {
          id: row.id as string,
          name: row.name as string,
          slug: row.slug as string,
          logo: row.logo as string | null,
          metadata,
          createdAt: row.createdAt || row.created_at,
          projectCount: typeof row.projectCount === 'number' ? row.projectCount : parseInt(String(row.projectCount || '0'), 10),
          memberCount: typeof row.memberCount === 'number' ? row.memberCount : parseInt(String(row.memberCount || '0'), 10),
        };
      });

      return { success: true, data: teamsList };
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Fallback: return empty array if query fails
      return {
        success: true,
        data: [],
      };
    }
  } catch (error) {
    console.error('Error fetching teams:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to fetch teams',
      data: [],
    };
  }
}

/**
 * Get a single team by ID
 * Uses Better Auth API to get organization
 */
export async function getTeam(teamId: string) {
  try {
    const user = await getCurrentUser();

    // Query organization directly from database using libSQL client
    try {
      const client = getClient();

      const result = await client.execute({
        sql: `
          SELECT 
            o.id, 
            o.name, 
            o.slug, 
            o.logo, 
            o.metadata, 
            o.created_at as createdAt
          FROM organization o
          INNER JOIN member m ON o.id = m.organization_id
          WHERE o.id = ? AND m.user_id = ?
          LIMIT 1
        `,
        args: [teamId, user.id],
      });

      const row = result.rows[0];

      if (!row) {
        return {
          success: false,
          error: 'Team not found or you do not have access',
        };
      }

      // Convert row to proper format
      const metadata = row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null;
      const team = {
        id: row.id as string,
        name: row.name as string,
        slug: row.slug as string,
        logo: row.logo as string | null,
        metadata,
        createdAt: row.createdAt || row.created_at,
      };

      return { success: true, data: team };
    } catch (error) {
      console.error('Error fetching team:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch team',
      };
    }
  } catch (error) {
    console.error('Error fetching team:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to fetch team',
    };
  }
}

/**
 * Update a team
 */
export async function updateTeam(input: z.infer<typeof updateTeamSchema>) {
  try {
    await getCurrentUser(); // Verify user is authenticated
    const validated = updateTeamSchema.parse(input);

    // Update team via Better Auth organization API
    try {
      const requestHeaders = await headers();
      const request = new Request(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(requestHeaders.entries()),
          },
          body: JSON.stringify({
            organizationId: validated.teamId,
            data: {
              ...(validated.name && { name: validated.name }),
              ...(validated.slug && { slug: validated.slug }),
            },
          }),
        }
      );

      const response = await auth.handler(request);
      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result?.error || 'Failed to update team',
        };
      }

      // Revalidate teams list page
      revalidatePath('/teams');
      revalidatePath('/projects');

      // Log team update activity
      await logTeamActivity(validated.teamId, 'team_updated', {
        changes: {
          ...(validated.name && { name: validated.name }),
          ...(validated.slug && { slug: validated.slug }),
        },
      });

      return { success: true, data: result };
    } catch (error) {
      console.error('Error updating team:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update team',
      };
    }
  } catch (error) {
    console.error('Error updating team:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.issues,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update team',
    };
  }
}

/**
 * Delete a team
 */
export async function deleteTeam(teamId: string) {
  try {
    await getCurrentUser(); // Verify user is authenticated

    // Delete team via Better Auth organization API
    try {
      const requestHeaders = await headers();
      const request = new Request(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(requestHeaders.entries()),
          },
          body: JSON.stringify({
            organizationId: teamId,
          }),
        }
      );

      const response = await auth.handler(request);
      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result?.error || 'Failed to delete team',
        };
      }

      // Get team name before deletion for activity log
      const teamCheck = await getTeam(teamId);
      
      // Log team deletion activity (before deletion)
      await logTeamActivity(teamId, 'team_deleted', {
        teamName: teamCheck.success && teamCheck.data ? teamCheck.data.name : undefined,
      });

      // Revalidate teams list page
      revalidatePath('/teams');
      revalidatePath('/projects');

      return { success: true };
    } catch (error) {
      console.error('Error deleting team:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete team',
      };
    }
  } catch (error) {
    console.error('Error deleting team:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete team',
    };
  }
}

// Invite validation schema
const inviteTeamMemberSchema = z.object({
  teamId: z.string(),
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'admin']).default('member'),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

/**
 * Invite a user to a team by email
 */
export async function inviteTeamMember(
  input: z.infer<typeof inviteTeamMemberSchema>
) {
  try {
    await getCurrentUser(); // Verify user is authenticated
    const validated = inviteTeamMemberSchema.parse(input);

    // Verify team exists and user has access
    const teamCheck = await getTeam(validated.teamId);
    if (!teamCheck.success) {
      return {
        success: false,
        error: 'Team not found or you do not have access',
      };
    }

    // Invite user to team using Better Auth
    try {
      const requestHeaders = await headers();
      const request = new Request(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/invite-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(requestHeaders.entries()),
          },
          body: JSON.stringify({
            email: validated.email,
            role: validated.role,
            organizationId: validated.teamId,
            resend: true,
          }),
        }
      );

      const response = await auth.handler(request);
      const invitation = await response.json();

      if (!response.ok || !invitation || invitation.error) {
        return {
          success: false,
          error: invitation?.error || 'Failed to create invitation',
        };
      }

      if (!invitation) {
        return {
          success: false,
          error: 'Failed to create invitation',
        };
      }

      // Generate invite link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const inviteLink = `${baseUrl}/accept-invite/${invitation.id}`;

      // Revalidate team detail page
      revalidatePath(`/teams/${validated.teamId}`);

      // Log invitation sent activity
      await logTeamActivity(validated.teamId, 'invitation_sent', {
        email: validated.email,
        role: validated.role,
        invitationId: invitation.id,
      });

      return {
        success: true,
        data: {
          invitation,
          inviteLink,
        },
      };
    } catch (error) {
      console.error('Error creating invitation:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create invitation',
      };
    }
  } catch (error) {
    console.error('Error inviting team member:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.issues,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to invite team member',
    };
  }
}

/**
 * List all invitations for a team
 */
export async function listTeamInvitations(teamId: string) {
  try {
    const user = await getCurrentUser();

    // Verify team exists and user has access
    const teamCheck = await getTeam(teamId);
    if (!teamCheck.success) {
      return {
        success: false,
        error: 'Team not found or you do not have access',
        data: [],
      };
    }

    // List team invitations
    try {
      // Note: listInvitations API doesn't accept body parameter
      // It uses query params or organization context from session
      const invitations = await auth.api.listInvitations({
        headers: await headers(),
      });

      if (!invitations || !Array.isArray(invitations)) {
        return {
          success: true,
          data: [],
        };
      }

      // Generate invite links for each invitation
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const invitationsWithLinks = invitations.map((invitation) => ({
        ...invitation,
        inviteLink: `${baseUrl}/accept-invite/${invitation.id}`,
      }));

      return {
        success: true,
        data: invitationsWithLinks,
      };
    } catch (error) {
      console.error('Error listing invitations:', error);
      return {
        success: true,
        data: [],
      };
    }
  } catch (error) {
    console.error('Error listing team invitations:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to list team invitations',
      data: [],
    };
  }
}

/**
 * Fallback: Get team members directly from database
 */
async function getTeamMembersFromDatabase(teamId: string, _currentUserId: string) {
  try {
    const client = getClient();

    // Query members directly from database
    const result = await client.execute({
      sql: `
        SELECT 
          m.id,
          m.user_id as userId,
          m.role,
          m.organization_id as organizationId,
          u.id as user_id,
          u.name,
          u.email,
          u.image
        FROM member m
        INNER JOIN users u ON m.user_id = u.id
        WHERE m.organization_id = ?
        ORDER BY m.created_at ASC
      `,
      args: [teamId],
    });

    if (!result.rows || result.rows.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Convert rows to proper format
    const membersWithUsers = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      userId: row.userId || row.user_id,
      role: row.role || 'member',
      organizationId: row.organizationId,
      user: {
        id: row.user_id,
        name: row.name,
        email: row.email,
        image: row.image,
      },
    }));

    return {
      success: true,
      data: membersWithUsers,
    };
  } catch (error) {
    console.error('Error fetching team members from database:', error);
    return {
      success: true,
      data: [],
    };
  }
}

/**
 * Get team members
 */
export async function getTeamMembers(teamId: string) {
  try {
    const user = await getCurrentUser(); // Need user.id for fallback

    // Verify team exists and user has access
    const teamCheck = await getTeam(teamId);
    if (!teamCheck.success) {
      return {
        success: false,
        error: 'Team not found or you do not have access',
        data: [],
      };
    }

    // Get team members using Better Auth API
    try {
      const result = await auth.api.listMembers({
        headers: await headers(),
        query: {
          organizationId: teamId,
        },
      });

      const members = result?.members;
      if (!members || !Array.isArray(members)) {
        console.warn('listMembers returned invalid data, falling back to database query');
        // Fallback: Query member table directly
        return await getTeamMembersFromDatabase(teamId, user.id);
      }

      // Extract user IDs from members
      const userIds = members.map((member) => member.userId).filter(Boolean);

      if (userIds.length === 0) {
        console.warn('listMembers returned empty array, falling back to database query');
        // Fallback: Query member table directly
        return await getTeamMembersFromDatabase(teamId, user.id);
      }

      // Query users table for member details
      const memberUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(users)
        .where(inArray(users.id, userIds));

      // Combine member data with user data
      const membersWithUsers = members.map((member) => {
        const user = memberUsers.find((u) => u.id === member.userId);
        return {
          ...member,
          user: user || null,
        };
      });

      return {
        success: true,
        data: membersWithUsers,
      };
    } catch (error) {
      console.error('Error fetching team members from API:', error);
      // Fallback: Query member table directly
      return await getTeamMembersFromDatabase(teamId, user.id);
    }
  } catch (error) {
    console.error('Error fetching team members:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch team members',
      data: [],
    };
  }
}

// Update member role validation schema
const updateTeamMemberRoleSchema = z.object({
  teamId: z.string(),
  memberId: z.string(),
  role: z.enum(['owner', 'admin', 'member']),
});

export type UpdateTeamMemberRoleInput = z.infer<typeof updateTeamMemberRoleSchema>;

/**
 * Update a team member's role
 */
export async function updateTeamMemberRole(
  input: z.infer<typeof updateTeamMemberRoleSchema>
) {
  try {
    await getCurrentUser(); // Verify user is authenticated
    const validated = updateTeamMemberRoleSchema.parse(input);

    // Verify team exists and user has access
    const teamCheck = await getTeam(validated.teamId);
    if (!teamCheck.success) {
      return {
        success: false,
        error: 'Team not found or you do not have access',
      };
    }

    // Update member role using Better Auth API
    try {
      const requestHeaders = await headers();
      const request = new Request(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/update-member-role`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(requestHeaders.entries()),
          },
          body: JSON.stringify({
            organizationId: validated.teamId,
            memberId: validated.memberId,
            role: validated.role,
          }),
        }
      );

      const response = await auth.handler(request);
      const result = await response.json();

      if (!response.ok || result?.error) {
        return {
          success: false,
          error: result?.error || 'Failed to update member role',
        };
      }

      // Revalidate team detail page
      revalidatePath(`/teams/${validated.teamId}`);
      revalidatePath(`/teams/${validated.teamId}/settings`);

      // Log role change activity
      // Get member details for activity log
      const membersResult = await auth.api.listMembers({
        headers: await headers(),
        query: {
          organizationId: validated.teamId,
        },
      });
      const targetMember = membersResult?.members?.find((m: { id: string; userId?: string; role?: string }) => m.id === validated.memberId);
      const targetUser = targetMember?.userId 
        ? await db.select().from(users).where(eq(users.id, targetMember.userId)).limit(1).then(r => r[0])
        : null;

      await logTeamActivity(validated.teamId, 'role_changed', {
        memberId: validated.memberId,
        oldRole: targetMember?.role,
        newRole: validated.role,
        targetUserName: targetUser?.name || targetUser?.email || 'Unknown',
      });

      return { success: true, data: result };
    } catch (error) {
      console.error('Error updating member role:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update member role',
      };
    }
  } catch (error) {
    console.error('Error updating member role:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.issues,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update member role',
    };
  }
}

// Remove member validation schema
const removeTeamMemberSchema = z.object({
  teamId: z.string(),
  memberIdOrEmail: z.string(),
});

export type RemoveTeamMemberInput = z.infer<typeof removeTeamMemberSchema>;

/**
 * Remove a member from a team
 */
export async function removeTeamMember(
  input: z.infer<typeof removeTeamMemberSchema>
) {
  try {
    await getCurrentUser(); // Verify user is authenticated
    const validated = removeTeamMemberSchema.parse(input);

    // Verify team exists and user has access
    const teamCheck = await getTeam(validated.teamId);
    if (!teamCheck.success) {
      return {
        success: false,
        error: 'Team not found or you do not have access',
      };
    }

    // Remove member using Better Auth API
    try {
      const requestHeaders = await headers();
      const request = new Request(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/remove-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(requestHeaders.entries()),
          },
          body: JSON.stringify({
            organizationId: validated.teamId,
            memberIdOrEmail: validated.memberIdOrEmail,
          }),
        }
      );

      const response = await auth.handler(request);
      const result = await response.json();

      if (!response.ok || result?.error) {
        return {
          success: false,
          error: result?.error || 'Failed to remove member',
        };
      }

      // Revalidate team detail page
      revalidatePath(`/teams/${validated.teamId}`);
      revalidatePath(`/teams/${validated.teamId}/settings`);

      // Log member removal activity
      await logTeamActivity(validated.teamId, 'member_left', {
        memberIdOrEmail: validated.memberIdOrEmail,
      });

      return { success: true };
    } catch (error) {
      console.error('Error removing member:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to remove member',
      };
    }
  } catch (error) {
    console.error('Error removing member:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.issues,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to remove member',
    };
  }
}

/**
 * Cancel a team invitation
 */
export async function cancelTeamInvitation(invitationId: string) {
  try {
    await getCurrentUser(); // Verify user is authenticated

    // Cancel invitation using Better Auth API
    try {
      const requestHeaders = await headers();
      const request = new Request(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/cancel-invitation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(requestHeaders.entries()),
          },
          body: JSON.stringify({
            invitationId,
          }),
        }
      );

      const response = await auth.handler(request);
      const result = await response.json();

      if (!response.ok || result?.error) {
        return {
          success: false,
          error: result?.error || 'Failed to cancel invitation',
        };
      }

      // Get team ID from invitation if available, or we need to find it
      // For now, we'll need to query the invitation to get the organizationId
      const client = getClient();
      const invitationResult = await client.execute({
        sql: `SELECT organization_id FROM invitation WHERE id = ? LIMIT 1`,
        args: [invitationId],
      });
      
      const firstRow = invitationResult.rows?.[0];
      if (firstRow && firstRow.organization_id) {
        const orgId = firstRow.organization_id as string;
        await logTeamActivity(orgId, 'invitation_cancelled', {
          invitationId,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error canceling invitation:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to cancel invitation',
      };
    }
  } catch (error) {
    console.error('Error canceling invitation:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to cancel invitation',
    };
  }
}

// Resend invitation validation schema
const resendInvitationSchema = z.object({
  teamId: z.string(),
  invitationId: z.string(),
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'admin', 'owner']),
});

export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>;

/**
 * Resend a team invitation
 */
export async function resendTeamInvitation(
  input: z.infer<typeof resendInvitationSchema>
) {
  try {
    await getCurrentUser(); // Verify user is authenticated
    const validated = resendInvitationSchema.parse(input);

    // Verify team exists and user has access
    const teamCheck = await getTeam(validated.teamId);
    if (!teamCheck.success) {
      return {
        success: false,
        error: 'Team not found or you do not have access',
      };
    }

    // Resend invitation using Better Auth API (using invite-member with resend: true)
    try {
      const requestHeaders = await headers();
      const request = new Request(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/invite-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(requestHeaders.entries()),
          },
          body: JSON.stringify({
            email: validated.email,
            role: validated.role,
            organizationId: validated.teamId,
            resend: true,
          }),
        }
      );

      const response = await auth.handler(request);
      const invitation = await response.json();

      if (!response.ok || !invitation || invitation.error) {
        return {
          success: false,
          error: invitation?.error || 'Failed to resend invitation',
        };
      }

      // Generate invite link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const inviteLink = `${baseUrl}/accept-invite/${validated.invitationId}`;

      // Revalidate team detail page
      revalidatePath(`/teams/${validated.teamId}`);
      revalidatePath(`/teams/${validated.teamId}/settings`);

      // Log invitation resent activity
      await logTeamActivity(validated.teamId, 'invitation_sent', {
        email: validated.email,
        role: validated.role,
        invitationId: validated.invitationId,
        resend: true,
      });

      return {
        success: true,
        data: {
          invitation,
          inviteLink,
        },
      };
    } catch (error) {
      console.error('Error resending invitation:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to resend invitation',
      };
    }
  } catch (error) {
    console.error('Error resending invitation:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.issues,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to resend invitation',
    };
  }
}

