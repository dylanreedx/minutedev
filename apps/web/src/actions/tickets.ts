'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { triggerTicketEvent, events } from '@/lib/pusher';
import { embedTicket } from './search';
import {
  db,
  tickets,
  projects,
  users,
  eq,
  and,
  sql,
  max,
  type TicketStatus,
  type TicketPriority,
  type Ticket,
} from '@minute/db';
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
const createTicketSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.number().optional(),
  points: z.number().int().positive().optional().nullable(),
});

const updateTicketSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required').max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.number().nullable().optional(),
  points: z.number().int().positive().optional().nullable(),
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

// Type for ticket with assignee data
export type TicketWithAssignee = Ticket & {
  assignee: {
    id: string | null;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
};

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
    const ticket = columnTickets[i];
    if (!ticket) continue;
    const newOrder = (i + 1) * ORDER_GAP;
    await db
      .update(tickets)
      .set({ order: newOrder })
      .where(eq(tickets.id, ticket.id));
  }
}

// Server Actions
export async function createTicket(input: z.infer<typeof createTicketSchema>) {
  try {
    const user = await getCurrentUser();
    const validated = createTicketSchema.parse(input);

    // Verify project permission (create ticket requires read permission)
    const accessCheck = await verifyProjectPermission(validated.projectId, 'read');
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
        points: validated.points ?? null,
        updatedAt: new Date(),
      })
      .returning();

    if (!ticket || !Array.isArray(ticket) || ticket.length === 0) {
      return {
        success: false,
        error: 'Failed to create ticket',
      };
    }

    const createdTicket = ticket[0];

    // Revalidate project pages
    if (accessCheck.success && accessCheck.project) {
      revalidatePath(`/projects/${accessCheck.project.slug}`);
      revalidatePath(`/projects/${accessCheck.project.slug}/board`);
      revalidatePath(`/projects/${accessCheck.project.slug}/list`);
    }

    // Trigger real-time event
    await triggerTicketEvent(validated.projectId, events.TICKET_CREATED, {
      ticketId: createdTicket.id,
      projectId: validated.projectId,
      userId: user.id,
      data: { title: createdTicket.title, status: createdTicket.status },
    });

    // Generate embedding in background (non-blocking)
    embedTicket(createdTicket.id).catch((err) => 
      console.error('Background embedding failed:', err)
    );

    return { success: true, data: createdTicket };
  } catch (error) {
    console.error('Error creating ticket:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.issues,
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
    await getCurrentUser(); // Ensure user is authenticated

    // Verify project permission (read access)
    const accessCheck = await verifyProjectPermission(projectId, 'read');
    if (!accessCheck.success) {
      return {
        ...accessCheck,
        data: {
          backlog: [],
          todo: [],
          in_progress: [],
          done: [],
        } as Record<TicketStatus, TicketWithAssignee[]>,
      };
    }

    // Get all tickets for the project with assignee data, ordered by status and order
    const projectTickets = await db
      .select({
        id: tickets.id,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        order: tickets.order,
        projectId: tickets.projectId,
        creatorId: tickets.creatorId,
        assigneeId: tickets.assigneeId,
        dueDate: tickets.dueDate,
        points: tickets.points,
        metadata: tickets.metadata,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        assignee: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.assigneeId, users.id))
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
    }, {} as Record<TicketStatus, TicketWithAssignee[]>);

    return { success: true, data: grouped };
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tickets',
      data: {
        backlog: [],
        todo: [],
        in_progress: [],
        done: [],
      } as Record<TicketStatus, TicketWithAssignee[]>,
    };
  }
}

export async function getTicket(ticketId: string) {
  try {
    await getCurrentUser(); // Ensure user is authenticated

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

    // Verify project permission (read access)
    const accessCheck = await verifyProjectPermission(ticket.projectId, 'read');
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

    // Verify project permission (update access)
    const accessCheck = await verifyProjectPermission(existing.projectId, 'update');
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
      points?: number | null;
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

    if (validated.points !== undefined) {
      updateData.points = validated.points;
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

    // Trigger real-time event
    await triggerTicketEvent(existing.projectId, events.TICKET_UPDATED, {
      ticketId: validated.id,
      projectId: existing.projectId,
      userId: user.id,
      data: { title: updated?.title, status: updated?.status },
    });

    // Re-generate embedding if title or description changed (non-blocking)
    if (validated.title !== undefined || validated.description !== undefined) {
      embedTicket(validated.id).catch((err) =>
        console.error('Background embedding failed:', err)
      );
    }

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating ticket:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation error',
        details: error.issues,
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

    // Verify project permission (delete access)
    const accessCheck = await verifyProjectPermission(existing.projectId, 'delete');
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

    // Trigger real-time event
    await triggerTicketEvent(existing.projectId, events.TICKET_DELETED, {
      ticketId: ticketId,
      projectId: existing.projectId,
      userId: user.id,
    });

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

    // Verify project permission (update access for reordering)
    const accessCheck = await verifyProjectPermission(validated.projectId, 'update');
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

      if (belowTickets.length > 0 && belowTickets[0]) {
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
          const targetTicket = rebalancedTickets[targetIndex];
          const nextTicket = rebalancedTickets[targetIndex + 1];
          if (targetIndex >= 0 && targetTicket && nextTicket) {
            newOrder = (targetTicket.order + nextTicket.order) / 2;
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

    // Trigger real-time event
    await triggerTicketEvent(validated.projectId, events.TICKET_MOVED, {
      ticketId: validated.ticketId,
      projectId: validated.projectId,
      userId: user.id,
      data: { 
        newStatus: validated.newStatus, 
        oldStatus: existing.status,
        newOrder: Math.floor(newOrder),
      },
    });

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error reordering ticket:', error);
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
        error instanceof Error ? error.message : 'Failed to reorder ticket',
    };
  }
}
