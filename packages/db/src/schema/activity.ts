import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { users } from "./auth";
import { projects } from "./projects";
import { tickets } from "./tickets";
import { organization } from "./organization";

export const ticketHistory = sqliteTable(
  "ticket_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    field: text("field").notNull(), // "status", "priority", "title", etc.
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    ticketIdx: index("ticket_history_ticket_idx").on(table.ticketId),
    userIdx: index("ticket_history_user_idx").on(table.userId),
    createdIdx: index("ticket_history_created_idx").on(table.createdAt),
  })
);

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id").references(() => tickets.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(), // "created_ticket", "moved_ticket", "updated_ticket", etc.
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    projectIdx: index("activity_log_project_idx").on(table.projectId),
    ticketIdx: index("activity_log_ticket_idx").on(table.ticketId),
    createdIdx: index("activity_log_created_idx").on(table.createdAt),
  })
);

export const teamActivity = sqliteTable(
  "team_activity",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(), // "member_joined", "member_left", "role_changed", "team_updated", "project_created", etc.
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    organizationIdx: index("team_activity_organization_idx").on(table.organizationId),
    userIdx: index("team_activity_user_idx").on(table.userId),
    createdIdx: index("team_activity_created_idx").on(table.createdAt),
  })
);

// Type exports
export type TicketHistory = typeof ticketHistory.$inferSelect;
export type NewTicketHistory = typeof ticketHistory.$inferInsert;
export type ActivityLog = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;
export type TeamActivity = typeof teamActivity.$inferSelect;
export type NewTeamActivity = typeof teamActivity.$inferInsert;








