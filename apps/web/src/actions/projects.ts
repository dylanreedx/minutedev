'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db, projects, tickets, users, eq, desc, sql, count, inArray } from '@minute/db';
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

  // Check organization permission
  const hasPermission = await auth.api.hasPermission({
    headers: await headers(),
    body: {
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

    // Generate unique slug
    const baseSlug = generateSlug(validated.name);
    const slug = await ensureUniqueSlug(baseSlug);

    // Create project
    const [project] = await db
      .insert(projects)
      .values({
        name: validated.name,
        description: validated.description || null,
        slug,
        ownerId: user.id,
      })
      .returning();

    // Revalidate projects list page
    revalidatePath('/projects');

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

export async function getProjects() {
  try {
    const user = await getCurrentUser();

    // Get all projects owned by the user with ticket counts
    const userProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        slug: projects.slug,
        ownerId: projects.ownerId,
        metadata: projects.metadata,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ticketCount: sql<number>`COALESCE(COUNT(${tickets.id}), 0)`.as(
          'ticketCount'
        ),
      })
      .from(projects)
      .leftJoin(tickets, eq(projects.id, tickets.projectId))
      .where(eq(projects.ownerId, user.id))
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

    // If no organizationId, return just the owner
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

    // Get organization members using Better Auth API
    try {
      const members = await auth.api.listMembers({
        headers: await headers(),
        body: {
          organizationId: project.organizationId,
        },
      });

      if (!members || !Array.isArray(members)) {
        return {
          success: true,
          data: [],
        };
      }

      // Extract user IDs from members
      const userIds = members.map((member) => member.userId).filter(Boolean);

      if (userIds.length === 0) {
        return {
          success: true,
          data: [],
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

      return {
        success: true,
        data: memberUsers,
      };
    } catch (error) {
      // If organization API fails, fall back to owner only
      console.error('Error fetching organization members:', error);
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
