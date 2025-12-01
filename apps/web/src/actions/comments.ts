'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { triggerCommentEvent, events } from '@/lib/pusher';
import {
  db,
  comments,
  tickets,
  projects,
  users,
  eq,
  and,
} from '@minute/db';
import { z } from 'zod';

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

// Verify project permission (reuse from tickets.ts pattern)
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
const createCommentSchema = z.object({
  ticketId: z.string(),
  content: z.string().min(1, 'Content is required').max(5000),
  parentId: z.string().optional(),
});

const updateCommentSchema = z.object({
  id: z.string(),
  content: z.string().min(1, 'Content is required').max(5000),
});

// Export types for use in hooks
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// Server Actions
export async function createComment(
  input: z.infer<typeof createCommentSchema>
) {
  try {
    const user = await getCurrentUser();
    const validated = createCommentSchema.parse(input);

    // Get ticket to find project
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, validated.ticketId))
      .limit(1);

    if (!ticket) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    // Verify project permission (comment access)
    const accessCheck = await verifyProjectPermission(ticket.projectId, 'comment');
    if (!accessCheck.success) {
      return accessCheck;
    }

    // If parentId is provided, verify it exists and belongs to the same ticket
    if (validated.parentId) {
      const [parent] = await db
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.id, validated.parentId),
            eq(comments.ticketId, validated.ticketId)
          )
        )
        .limit(1);

      if (!parent) {
        return {
          success: false,
          error: 'Parent comment not found',
        };
      }
    }

    // Create comment
    // Note: Don't set updatedAt explicitly - let database default handle it
    // This ensures createdAt and updatedAt are the same for new comments
    const commentResult = await db
      .insert(comments)
      .values({
        ticketId: validated.ticketId,
        userId: user.id,
        content: validated.content,
        parentId: validated.parentId || null,
      })
      .returning();
    
    if (!commentResult || !Array.isArray(commentResult) || commentResult.length === 0) {
      return {
        success: false,
        error: 'Failed to create comment',
      };
    }
    
    const comment = commentResult[0];
    
    if (!comment) {
      return {
        success: false,
        error: 'Failed to create comment',
      };
    }

    // Revalidate ticket pages
    if (accessCheck.success && accessCheck.project) {
      revalidatePath(`/projects/${accessCheck.project.slug}`);
      revalidatePath(`/projects/${accessCheck.project.slug}/board`);
      revalidatePath(`/projects/${accessCheck.project.slug}/list`);
    }

    // Trigger real-time event
    await triggerCommentEvent(validated.ticketId, events.COMMENT_CREATED, {
      commentId: comment.id,
      ticketId: validated.ticketId,
      userId: user.id,
    });

    return { success: true, data: comment };
  } catch (error) {
    console.error('Error creating comment:', error);
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
        error instanceof Error ? error.message : 'Failed to create comment',
    };
  }
}

export async function getComments(ticketId: string) {
  try {
    await getCurrentUser(); // Verify user is authenticated

    // Get ticket to find project
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return {
        success: false,
        error: 'Ticket not found',
        data: [],
      };
    }

    // Verify project permission (read access)
    const accessCheck = await verifyProjectPermission(ticket.projectId, 'read');
    if (!accessCheck.success) {
      return {
        ...accessCheck,
        data: [],
      };
    }

    // Get all comments for the ticket with user info
    const ticketComments = await db
      .select({
        id: comments.id,
        ticketId: comments.ticketId,
        userId: comments.userId,
        content: comments.content,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.ticketId, ticketId))
      .orderBy(comments.createdAt);

    return { success: true, data: ticketComments };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to fetch comments',
      data: [],
    };
  }
}

export async function updateComment(
  input: z.infer<typeof updateCommentSchema>
) {
  try {
    const user = await getCurrentUser();
    const validated = updateCommentSchema.parse(input);

    // Get existing comment
    const [existing] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, validated.id))
      .limit(1);

    if (!existing) {
      return {
        success: false,
        error: 'Comment not found',
      };
    }

    // Verify user owns the comment
    if (existing.userId !== user.id) {
      return {
        success: false,
        error: 'Unauthorized - you can only edit your own comments',
      };
    }

    // Get ticket to verify project permission
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, existing.ticketId))
      .limit(1);

    if (!ticket) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    // Verify project permission (comment access)
    const accessCheck = await verifyProjectPermission(ticket.projectId, 'comment');
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Update comment
    const updatedResult = await db
      .update(comments)
      .set({
        content: validated.content,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, validated.id))
      .returning();
    
    if (!updatedResult || !Array.isArray(updatedResult) || updatedResult.length === 0) {
      return {
        success: false,
        error: 'Comment not found or update failed',
      };
    }
    
    const updated = updatedResult[0];

    // Revalidate ticket pages
    if (accessCheck.success && accessCheck.project) {
      revalidatePath(`/projects/${accessCheck.project.slug}`);
      revalidatePath(`/projects/${accessCheck.project.slug}/board`);
      revalidatePath(`/projects/${accessCheck.project.slug}/list`);
    }

    // Trigger real-time event
    await triggerCommentEvent(existing.ticketId, events.COMMENT_UPDATED, {
      commentId: validated.id,
      ticketId: existing.ticketId,
      userId: user.id,
    });

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating comment:', error);
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
        error instanceof Error ? error.message : 'Failed to update comment',
    };
  }
}

export async function deleteComment(commentId: string) {
  try {
    const user = await getCurrentUser();

    // Get existing comment
    const [existing] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!existing) {
      return {
        success: false,
        error: 'Comment not found',
      };
    }

    // Verify user owns the comment
    if (existing.userId !== user.id) {
      return {
        success: false,
        error: 'Unauthorized - you can only delete your own comments',
      };
    }

    // Get ticket to verify project permission
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, existing.ticketId))
      .limit(1);

    if (!ticket) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    // Verify project permission (comment access)
    const accessCheck = await verifyProjectPermission(ticket.projectId, 'comment');
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Delete comment (cascade will handle replies)
    await db.delete(comments).where(eq(comments.id, commentId));

    // Revalidate ticket pages
    if (accessCheck.success && accessCheck.project) {
      revalidatePath(`/projects/${accessCheck.project.slug}`);
      revalidatePath(`/projects/${accessCheck.project.slug}/board`);
      revalidatePath(`/projects/${accessCheck.project.slug}/list`);
    }

    // Trigger real-time event
    await triggerCommentEvent(existing.ticketId, events.COMMENT_DELETED, {
      commentId: commentId,
      ticketId: existing.ticketId,
      userId: user.id,
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to delete comment',
    };
  }
}



