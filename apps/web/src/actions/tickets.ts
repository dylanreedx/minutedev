'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import {
  db,
  tickets,
  projects,
  type TicketStatus,
  type TicketPriority,
} from '@minute/db';
import { eq, and, desc, sql, max } from 'drizzle-orm';
import { z } from 'zod';

// Gap-based ordering constant
const ORDER_GAP = 1000;

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

// Verify user owns the project
async function verifyProjectAccess(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  if (project.ownerId !== userId) {
    return { success: false, error: 'Unauthorized' };
  }

  return { success: true, project };
}

// Validation schemas
const createTicketSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.number().optional(),
});

const updateTicketSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.number().nullable().optional(),
});

const reorderTicketSchema = z.object({
  ticketId: z.string(),
  projectId: z.string(),
  newStatus: z.enum(['backlog', 'todo', 'in_progress', 'done']),
  newOrder: z.number(),
  // For within-column reordering
  targetOrder: z.number().optional(),
});

// Export types for use in hooks
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ReorderTicketInput = z.infer<typeof reorderTicketSchema>;

// Get the next order value for a status in a project
async function getNextOrder(
  projectId: string,
  status: TicketStatus
): Promise<number> {
  const [result] = await db
    .select({ maxOrder: max(tickets.order) })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), eq(tickets.status, status)))
    .limit(1);

  const lastOrder = result?.maxOrder ?? 0;
  return lastOrder + ORDER_GAP;
}

// Rebalance orders in a column when gap is too small
async function rebalanceColumn(projectId: string, status: TicketStatus) {
  const columnTickets = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), eq(tickets.status, status)))
    .orderBy(tickets.order);

  // Update each ticket with new order values
  for (let i = 0; i < columnTickets.length; i++) {
    const newOrder = (i + 1) * ORDER_GAP;
    await db
      .update(tickets)
      .set({ order: newOrder })
      .where(eq(tickets.id, columnTickets[i].id));
  }
}

// Server Actions
export async function createTicket(input: z.infer<typeof createTicketSchema>) {
  try {
    const user = await getCurrentUser();
    const validated = createTicketSchema.parse(input);

    // Verify project access
    const accessCheck = await verifyProjectAccess(validated.projectId, user.id);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Get next order for the status
    const status = (validated.status || 'backlog') as TicketStatus;
    const order = await getNextOrder(validated.projectId, status);

    // Create ticket
    const [ticket] = await db
      .insert(tickets)
      .values({
        title: validated.title,
        description: validated.description || null,
        status,
        priority: (validated.priority || 'medium') as TicketPriority,
        order,
        projectId: validated.projectId,
        creatorId: user.id,
        assigneeId: validated.assigneeId || null,
        dueDate: validated.dueDate
          ? (() => {
              const timestamp = validated.dueDate * 1000;
              const date = new Date(timestamp);
              // Validate the date is valid
              if (isNaN(date.getTime())) {
                return null;
              }
              return date;
            })()
          : null,
        updatedAt: new Date(),
      })
      .returning();

    // Revalidate project pages
    if (accessCheck.success && accessCheck.project) {
      revalidatePath(`/projects/${accessCheck.project.slug}`);
      revalidatePath(`/projects/${accessCheck.project.slug}/board`);
      revalidatePath(`/projects/${accessCheck.project.slug}/list`);
    }

    return { success: true, data: ticket };
  } catch (error) {
    console.error('Error creating ticket:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.errors,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create ticket',
    };
  }
}

export async function getTickets(projectId: string) {
  try {
    const user = await getCurrentUser();

    // Verify project access
    const accessCheck = await verifyProjectAccess(projectId, user.id);
    if (!accessCheck.success) {
      return { ...accessCheck, data: [] };
    }

    // Get all tickets for the project, ordered by status and order
    const projectTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.projectId, projectId))
      .orderBy(tickets.status, tickets.order);

    // Group by status
    const grouped = projectTickets.reduce((acc, ticket) => {
      const status = ticket.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(ticket);
      return acc;
    }, {} as Record<TicketStatus, typeof projectTickets>);

    return { success: true, data: grouped };
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tickets',
      data: {},
    };
  }
}

export async function getTicket(ticketId: string) {
  try {
    const user = await getCurrentUser();

    // Get ticket with project
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    // Verify project access
    const accessCheck = await verifyProjectAccess(ticket.projectId, user.id);
    if (!accessCheck.success) {
      return accessCheck;
    }

    return { success: true, data: ticket };
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch ticket',
    };
  }
}

export async function updateTicket(input: z.infer<typeof updateTicketSchema>) {
  try {
    const user = await getCurrentUser();
    const validated = updateTicketSchema.parse(input);

    // Get existing ticket
    const [existing] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, validated.id))
      .limit(1);

    if (!existing) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    // Verify project access
    const accessCheck = await verifyProjectAccess(existing.projectId, user.id);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Prepare update data
    const updateData: {
      title?: string;
      description?: string | null;
      status?: TicketStatus;
      priority?: TicketPriority;
      assigneeId?: string | null;
      dueDate?: Date | null;
      order?: number;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (validated.title !== undefined) {
      updateData.title = validated.title;
    }

    if (validated.description !== undefined) {
      updateData.description = validated.description || null;
    }

    if (validated.status !== undefined) {
      updateData.status = validated.status;
      // If status changed, move to end of new column
      if (validated.status !== existing.status) {
        const newOrder = await getNextOrder(
          existing.projectId,
          validated.status
        );
        updateData.order = newOrder;
      }
    }

    if (validated.priority !== undefined) {
      updateData.priority = validated.priority;
    }

    if (validated.assigneeId !== undefined) {
      updateData.assigneeId = validated.assigneeId;
    }

    if (validated.dueDate !== undefined) {
      updateData.dueDate =
        validated.dueDate !== null ? new Date(validated.dueDate * 1000) : null;
    }

    // Update ticket
    const [updated] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, validated.id))
      .returning();

    // Revalidate project pages
    if (accessCheck.success && accessCheck.project) {
      revalidatePath(`/projects/${accessCheck.project.slug}`);
      revalidatePath(`/projects/${accessCheck.project.slug}/board`);
      revalidatePath(`/projects/${accessCheck.project.slug}/list`);
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating ticket:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.errors,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update ticket',
    };
  }
}

export async function deleteTicket(ticketId: string) {
  try {
    const user = await getCurrentUser();

    // Get existing ticket
    const [existing] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!existing) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    // Verify project access
    const accessCheck = await verifyProjectAccess(existing.projectId, user.id);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Delete ticket
    await db.delete(tickets).where(eq(tickets.id, ticketId));

    // Revalidate project pages
    if (accessCheck.success && accessCheck.project) {
      revalidatePath(`/projects/${accessCheck.project.slug}`);
      revalidatePath(`/projects/${accessCheck.project.slug}/board`);
      revalidatePath(`/projects/${accessCheck.project.slug}/list`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete ticket',
    };
  }
}

export async function reorderTicket(
  input: z.infer<typeof reorderTicketSchema>
) {
  try {
    const user = await getCurrentUser();
    const validated = reorderTicketSchema.parse(input);

    // Verify project access
    const accessCheck = await verifyProjectAccess(validated.projectId, user.id);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Get existing ticket
    const [existing] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, validated.ticketId))
      .limit(1);

    if (!existing) {
      return {
        success: false,
        error: 'Ticket not found',
      };
    }

    const isStatusChange = existing.status !== validated.newStatus;
    let newOrder = validated.newOrder;

    // If moving within the same column, calculate order between tickets
    if (!isStatusChange && validated.targetOrder !== undefined) {
      const aboveOrder = validated.targetOrder;
      const belowTickets = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.projectId, validated.projectId),
            eq(tickets.status, validated.newStatus),
            sql`${tickets.order} > ${aboveOrder}`
          )
        )
        .orderBy(tickets.order)
        .limit(1);

      if (belowTickets.length > 0) {
        const belowOrder = belowTickets[0].order;
        const gap = belowOrder - aboveOrder;

        // If gap is too small, rebalance the column
        if (gap < 2) {
          await rebalanceColumn(validated.projectId, validated.newStatus);
          // After rebalancing, calculate new order
          const rebalancedTickets = await db
            .select()
            .from(tickets)
            .where(
              and(
                eq(tickets.projectId, validated.projectId),
                eq(tickets.status, validated.newStatus)
              )
            )
            .orderBy(tickets.order);

          const targetIndex = rebalancedTickets.findIndex(
            (t) => t.order === aboveOrder
          );
          if (targetIndex >= 0 && targetIndex < rebalancedTickets.length - 1) {
            newOrder =
              (rebalancedTickets[targetIndex].order +
                rebalancedTickets[targetIndex + 1].order) /
              2;
          } else {
            newOrder = (targetIndex + 1) * ORDER_GAP;
          }
        } else {
          // Calculate order between above and below
          newOrder = (aboveOrder + belowOrder) / 2;
        }
      } else {
        // Moving to end of column
        newOrder = await getNextOrder(validated.projectId, validated.newStatus);
      }
    } else if (isStatusChange) {
      // Moving to different column - place at end
      newOrder = await getNextOrder(validated.projectId, validated.newStatus);
    }

    // Update ticket
    const [updated] = await db
      .update(tickets)
      .set({
        status: validated.newStatus,
        order: Math.floor(newOrder),
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, validated.ticketId))
      .returning();

    // Revalidate project pages
    if (accessCheck.success && accessCheck.project) {
      revalidatePath(`/projects/${accessCheck.project.slug}`);
      revalidatePath(`/projects/${accessCheck.project.slug}/board`);
      revalidatePath(`/projects/${accessCheck.project.slug}/list`);
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error reordering ticket:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.errors,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to reorder ticket',
    };
  }
}
