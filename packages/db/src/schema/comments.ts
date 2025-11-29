import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { tickets } from "./tickets";

export const comments = sqliteTable(
  "comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentId: text("parent_id").references(() => comments.id, {
      onDelete: "cascade",
    }), // For threading
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    ticketIdx: index("comments_ticket_idx").on(table.ticketId),
    userIdx: index("comments_user_idx").on(table.userId),
    parentIdx: index("comments_parent_idx").on(table.parentId),
  })
);

// Type exports
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;






