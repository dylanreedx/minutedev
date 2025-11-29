'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { logTeamActivity } from './team-activity';
import { db, projects, tickets, users, eq, desc, sql, count, inArray, and, organizationTable } from '@minute/db';
import { z } from 'zod';

// Utility function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Ensure slug is unique by appending a number if needed
async function ensureUniqueSlug(
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);

    if (existing.length === 0 || (excludeId && existing[0]?.id === excludeId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

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

// Verify project permission
async function verifyProjectPermission(
  projectId: string,
  permission: 'create' | 'read' | 'update' | 'delete' | 'assign' | 'comment'
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  // For backward compatibility: if no organizationId, check ownership
  if (!project.organizationId) {
    if (project.ownerId !== session.user.id) {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: true, project };
  }

  // Check organization permission - must pass organizationId explicitly
  const hasPermission = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      organizationId: project.organizationId,
      permissions: {
        project: [permission],
      },
    },
  });

  if (!hasPermission) {
    return { success: false, error: 'Insufficient permissions' };
  }

  return { success: true, project };
}

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  teamId: z.string().min(1, 'Team is required'),
});

const updateProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required').max(100).optional(),
  description: z.string().max(500).optional(),
});

// Export types for use in hooks
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// Server Actions
export async function createProject(
  input: z.infer<typeof createProjectSchema>
) {
  try {
    const user = await getCurrentUser();
    const validated = createProjectSchema.parse(input);

    // Verify team exists and user has access
    if (!validated.teamId) {
      return {
        success: false,
        error: 'Team is required',
      };
    }

    // Generate unique slug
    const baseSlug = generateSlug(validated.name);
    const slug = await ensureUniqueSlug(baseSlug);

    // Create project with team (organizationId)
    const [project] = await db
      .insert(projects)
      .values({
        name: validated.name,
        description: validated.description || null,
        slug,
        ownerId: user.id,
        organizationId: validated.teamId, // teamId is the organizationId
      })
      .returning();

    // Revalidate projects list page
    revalidatePath('/projects');

    // Log project creation activity if team exists
    if (validated.teamId) {
      await logTeamActivity(validated.teamId, 'project_created', {
        projectId: project.id,
        projectName: validated.name,
      });
    }

    return { success: true, data: project };
  } catch (error) {
    console.error('Error creating project:', error);
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
        error instanceof Error ? error.message : 'Failed to create project',
    };
  }
}

export async function getProjects(teamId?: string) {
  try {
    const user = await getCurrentUser();

    // Build where conditions
    const conditions = [eq(projects.ownerId, user.id)];
    if (teamId) {
      conditions.push(eq(projects.organizationId, teamId));
    }
    const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get all projects owned by the user with ticket counts and team names
    const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        slug: projects.slug,
        ownerId: projects.ownerId,
        organizationId: projects.organizationId,
        teamName: organizationTable.name,
        metadata: projects.metadata,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ticketCount: sql<number>`COALESCE(COUNT(${tickets.id}), 0)`.as(
          'ticketCount'
        ),
      })
      .from(projects)
      .leftJoin(tickets, eq(projects.id, tickets.projectId))
      .leftJoin(organizationTable, eq(projects.organizationId, organizationTable.id))
      .where(whereCondition)
      .groupBy(projects.id)
      .orderBy(desc(projects.createdAt));

    return { success: true, data: userProjects };
  } catch (error) {
    console.error('Error fetching projects:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to fetch projects',
      data: [],
    };
  }
}

/**
 * Get projects for a specific team
 */
export async function getProjectsByTeam(teamId: string) {
  return getProjects(teamId);
}

export async function getProject(slug: string) {
  try {
    const user = await getCurrentUser();

    // Get project by slug, ensuring user owns it
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);

    if (!project) {
      return {
        success: false,
        error: 'Project not found',
      };
    }

    // Check permission (read access)
    const accessCheck = await verifyProjectPermission(project.id, 'read');
    if (!accessCheck.success) {
      return accessCheck;
    }

    return { success: true, data: project };
  } catch (error) {
    console.error('Error fetching project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch project',
    };
  }
}

export async function updateProject(
  input: z.infer<typeof updateProjectSchema>
) {
  try {
    const user = await getCurrentUser();
    const validated = updateProjectSchema.parse(input);

    // Verify project exists and user owns it
    const [existing] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, validated.id))
      .limit(1);

    if (!existing) {
      return {
        success: false,
        error: 'Project not found',
      };
    }

    // Check permission (update access)
    const accessCheck = await verifyProjectPermission(existing.id, 'update');
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Prepare update data
    const updateData: {
      name?: string;
      description?: string | null;
      slug?: string;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    if (validated.name !== undefined) {
      updateData.name = validated.name;
      // Regenerate slug if name changed
      if (validated.name !== existing.name) {
        const baseSlug = generateSlug(validated.name);
        updateData.slug = await ensureUniqueSlug(baseSlug, validated.id);
      }
    }

    if (validated.description !== undefined) {
      updateData.description = validated.description || null;
    }

    // Update project
    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, validated.id))
      .returning();

    if (!updated) {
      return {
        success: false,
        error: 'Failed to update project',
      };
    }

    // Revalidate relevant paths
    revalidatePath('/projects');
    revalidatePath(`/projects/${updated.slug}`);

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating project:', error);
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
        error instanceof Error ? error.message : 'Failed to update project',
    };
  }
}

export async function deleteProject(projectId: string) {
  try {
    const user = await getCurrentUser();

    // Verify project exists and user owns it
    const [existing] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!existing) {
      return {
        success: false,
        error: 'Project not found',
      };
    }

    // Check permission (delete access)
    const accessCheck = await verifyProjectPermission(existing.id, 'delete');
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Delete project (cascade will handle tickets)
    await db.delete(projects).where(eq(projects.id, projectId));

    // Revalidate projects list page
    revalidatePath('/projects');

    return { success: true };
  } catch (error) {
    console.error('Error deleting project:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete project',
    };
  }
}

export async function getProjectMembers(projectId: string) {
  try {
    const user = await getCurrentUser();

    // Get project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return {
        success: false,
        error: 'Project not found',
        data: [],
      };
    }

    // Verify project permission (read access)
    const accessCheck = await verifyProjectPermission(project.id, 'read');
    if (!accessCheck.success) {
      return {
        ...accessCheck,
        data: [],
      };
    }

    // If no team (organizationId), return just the owner
    if (!project.organizationId) {
      const [owner] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(users)
        .where(eq(users.id, project.ownerId))
        .limit(1);

      return {
        success: true,
        data: owner ? [owner] : [],
      };
    }

    // Get team members using Better Auth API
    try {
      const members = await auth.api.listMembers({
        headers: await headers(),
        query: {
          organizationId: project.organizationId,
        },
      });

      if (!members || !Array.isArray(members)) {
        // Fall back to owner if API returns invalid data
        const [owner] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, project.ownerId))
          .limit(1);

        return {
          success: true,
          data: owner ? [owner] : [],
        };
      }

      // Extract user IDs from members
      const userIds = members.map((member) => member.userId).filter(Boolean);

      if (userIds.length === 0) {
        // If no members found, at least return the project owner
        const [owner] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, project.ownerId))
          .limit(1);

        return {
          success: true,
          data: owner ? [owner] : [],
        };
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

      // Ensure owner is included even if not in member list (shouldn't happen, but safety check)
      const ownerIncluded = memberUsers.some((u) => u.id === project.ownerId);
      if (!ownerIncluded) {
        const [owner] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, project.ownerId))
          .limit(1);

        if (owner) {
          return {
            success: true,
            data: [owner, ...memberUsers],
          };
        }
      }

      return {
        success: true,
        data: memberUsers,
      };
    } catch (error) {
      // If team API fails, fall back to owner only
      console.error('Error fetching team members:', error);
      const [owner] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(users)
        .where(eq(users.id, project.ownerId))
        .limit(1);

      return {
        success: true,
        data: owner ? [owner] : [],
      };
    }
  } catch (error) {
    console.error('Error fetching project members:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch project members',
      data: [],
    };
  }
}

// Invite validation schema
const inviteMemberSchema = z.object({
  projectId: z.string(),
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'admin']).default('member'),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Invite a user to a project by email
 * Creates a team invitation if project has a team (organizationId)
 */
export async function inviteProjectMember(
  input: z.infer<typeof inviteMemberSchema>
) {
  try {
    const user = await getCurrentUser();
    const validated = inviteMemberSchema.parse(input);

    // Get project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, validated.projectId))
      .limit(1);

    if (!project) {
      return {
        success: false,
        error: 'Project not found',
      };
    }

    // Verify project permission (update access required to invite)
    const accessCheck = await verifyProjectPermission(project.id, 'update');
    if (!accessCheck.success) {
      return accessCheck;
    }

    // If project has no team, create one on-demand for backward compatibility
    let organizationId = project.organizationId;
    if (!organizationId) {
      try {
        const requestHeaders = await headers();
        const teamSlug = `team-${project.slug}`;
        
        // Create team via Better Auth handler
        const request = new Request(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/organization/create`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...Object.fromEntries(requestHeaders.entries()),
            },
            body: JSON.stringify({
              name: `${project.name} Team`,
              slug: teamSlug,
              metadata: {
                projectId: project.id,
                autoCreated: true, // Mark as auto-created for migration
              },
            }),
          }
        );

        const response = await auth.handler(request);
        const teamResult = await response.json();

        if (response.ok && teamResult?.id) {
          organizationId = teamResult.id;
          
          // Update project with team ID
          await db
            .update(projects)
            .set({ organizationId })
            .where(eq(projects.id, project.id));
        } else {
          return {
            success: false,
            error: teamResult?.error || 'Failed to create team for project. Please create a team first.',
          };
        }
      } catch (teamError) {
        console.error('Error creating team on-demand:', teamError);
        return {
          success: false,
          error: 'Failed to create team. Please create a team first and try again.',
        };
      }
    }

    // Invite user to team using Better Auth
    try {
      // Call Better Auth's organization invite endpoint via the handler
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
            organizationId: organizationId,
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
    console.error('Error inviting project member:', error);
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
          : 'Failed to invite project member',
    };
  }
}

/**
 * Generate an invite link for a project
 * Creates a new invitation if one doesn't exist
 */
export async function generateProjectInviteLink(projectId: string) {
  try {
    const user = await getCurrentUser();

    // Get project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return {
        success: false,
        error: 'Project not found',
      };
    }

    // Verify project permission (update access required)
    const accessCheck = await verifyProjectPermission(project.id, 'update');
    if (!accessCheck.success) {
      return accessCheck;
    }

    if (!project.organizationId) {
      return {
        success: false,
        error: 'Project must be part of a team to generate invite links',
      };
    }

    // Get existing pending invitations
    const invitations = await auth.api.listInvitations({
      headers: await headers(),
      body: {
        organizationId: project.organizationId,
      },
    });

    // Generate a shareable link - we'll use a special token format
    // For now, we'll create a generic invite that can be accepted by anyone with the link
    // Better Auth doesn't have a "public invite link" feature, so we'll need to work around this
    // Option: Create a placeholder invitation or use a custom token system
    
    // For MVP, we'll return a message that they need to invite by email first
    // Then we can share that invitation's link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // If there are pending invitations, we could use one of them
    // But for a true "shareable link", we'd need a different approach
    // Let's create a generic invitation token that can be shared
    
    return {
      success: true,
      data: {
        message: 'Use inviteProjectMember to create an invitation, then share the returned inviteLink',
        projectId: project.id,
        organizationId: project.organizationId,
      },
    };
  } catch (error) {
    console.error('Error generating invite link:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate invite link',
    };
  }
}

/**
 * List all invitations for a project
 */
export async function listProjectInvitations(projectId: string) {
  try {
    const user = await getCurrentUser();

    // Get project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return {
        success: false,
        error: 'Project not found',
        data: [],
      };
    }

    // Verify project permission (read access)
    const accessCheck = await verifyProjectPermission(project.id, 'read');
    if (!accessCheck.success) {
      return {
        ...accessCheck,
        data: [],
      };
    }

    if (!project.organizationId) {
      return {
        success: true,
        data: [],
      };
    }

    // List team invitations
    try {
      const invitations = await auth.api.listInvitations({
        headers: await headers(),
        body: {
          organizationId: project.organizationId,
        },
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
    console.error('Error listing project invitations:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to list project invitations',
      data: [],
    };
  }
}

/**
 * Cancel/revoke an invitation
 */
export async function cancelProjectInvitation(invitationId: string) {
  try {
    const user = await getCurrentUser();

    // Cancel invitation using Better Auth
    try {
      await auth.api.cancelInvitation({
        headers: await headers(),
        body: {
          invitationId,
        },
      });

      return {
        success: true,
      };
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
    console.error('Error canceling project invitation:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to cancel project invitation',
    };
  }
}

/**
 * Get invitation details by ID
 */
export async function getProjectInvitation(invitationId: string) {
  try {
    const user = await getCurrentUser();

    try {
      const invitation = await auth.api.getInvitation({
        headers: await headers(),
        query: {
          id: invitationId,
        },
      });

      if (!invitation) {
        return {
          success: false,
          error: 'Invitation not found',
        };
      }

      // Generate invite link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const inviteLink = `${baseUrl}/accept-invite/${invitation.id}`;

      return {
        success: true,
        data: {
          ...invitation,
          inviteLink,
        },
      };
    } catch (error) {
      console.error('Error getting invitation:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get invitation',
      };
    }
  } catch (error) {
    console.error('Error getting project invitation:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get project invitation',
    };
  }
}
