import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { projects } from './projects';

export const ticketStatus = ['backlog', 'todo', 'in_progress', 'done'] as const;
export const ticketPriority = ['low', 'medium', 'high', 'urgent'] as const;

export type TicketStatus = (typeof ticketStatus)[number];
export type TicketPriority = (typeof ticketPriority)[number];

export const tickets = sqliteTable(
  'tickets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status', { enum: ticketStatus }).notNull().default('backlog'),
    priority: text('priority', { enum: ticketPriority })
      .notNull()
      .default('medium'),
    order: integer('order').notNull().default(0), // Gap-based: 1000, 2000, 3000...
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    creatorId: text('creator_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    assigneeId: text('assignee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    dueDate: integer('due_date', { mode: 'timestamp' }),
    metadata: text('metadata', { mode: 'json' }).$type<
      Record<string, unknown>
    >(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    projectIdx: index('tickets_project_idx').on(table.projectId),
    statusIdx: index('tickets_status_idx').on(table.status),
    assigneeIdx: index('tickets_assignee_idx').on(table.assigneeId),
    orderIdx: index('tickets_order_idx').on(
      table.projectId,
      table.status,
      table.order
    ),
  })
);

// Type exports
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
