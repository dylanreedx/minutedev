import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { tickets } from './tickets';

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // UploadThing fields
    fileKey: text('file_key').notNull(), // UploadThing file key
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url').notNull(), // UploadThing CDN URL
    fileSize: integer('file_size').notNull(), // Size in bytes
    fileType: text('file_type').notNull(), // MIME type
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    ticketIdx: index('attachments_ticket_idx').on(table.ticketId),
    userIdx: index('attachments_user_idx').on(table.userId),
  })
);

// Type exports
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

