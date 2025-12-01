import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { projects } from './projects';
import { users } from './auth';
import { ticketStatus, ticketPriority } from './tickets';

export const ticketTemplates = sqliteTable(
  'ticket_templates',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(), // Template name (e.g., "Bug Report", "Feature Request")
    description: text('description'), // Template description
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    creatorId: text('creator_id')
      .references(() => users.id, { onDelete: 'set null' }),
    // Default values for tickets created from this template
    titleTemplate: text('title_template'), // e.g., "[BUG] " or "[FEATURE] "
    descriptionTemplate: text('description_template'), // Pre-filled description with placeholders
    defaultStatus: text('default_status', { enum: ticketStatus }).default('backlog'),
    defaultPriority: text('default_priority', { enum: ticketPriority }).default('medium'),
    defaultPoints: integer('default_points'), // Default story points
    // Metadata for extensibility
    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    projectIdx: index('templates_project_idx').on(table.projectId),
    creatorIdx: index('templates_creator_idx').on(table.creatorId),
  })
);

// Type exports
export type TicketTemplate = typeof ticketTemplates.$inferSelect;
export type NewTicketTemplate = typeof ticketTemplates.$inferInsert;

