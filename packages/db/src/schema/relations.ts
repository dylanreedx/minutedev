import { relations } from "drizzle-orm";
import { users, sessions, accounts } from "./auth";
import { projects } from "./projects";
import { tickets } from "./tickets";
import { ticketHistory, activityLog } from "./activity";

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  projects: many(projects),
  createdTickets: many(tickets, { relationName: "creator" }),
  assignedTickets: many(tickets, { relationName: "assignee" }),
  ticketHistory: many(ticketHistory),
  activityLogs: many(activityLog),
}));

// Session relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// Account relations
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

// Project relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  tickets: many(tickets),
  activityLogs: many(activityLog),
}));

// Ticket relations
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  project: one(projects, {
    fields: [tickets.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [tickets.creatorId],
    references: [users.id],
    relationName: "creator",
  }),
  assignee: one(users, {
    fields: [tickets.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  history: many(ticketHistory),
  activityLogs: many(activityLog),
}));

// Ticket history relations
export const ticketHistoryRelations = relations(ticketHistory, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketHistory.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [ticketHistory.userId],
    references: [users.id],
  }),
}));

// Activity log relations
export const activityLogRelations = relations(activityLog, ({ one }) => ({
  project: one(projects, {
    fields: [activityLog.projectId],
    references: [projects.id],
  }),
  ticket: one(tickets, {
    fields: [activityLog.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));



