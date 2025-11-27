# Minute MVP - Phase 4 Implementation Handoff

## 🎯 Mission

Continue implementing the **Minute** AI-native task management platform (Jira alternative). **Phase 1-3 are complete.** You are picking up at **Phase 4** to finish the MVP.

---

## 🔧 CRITICAL: Tool Usage Requirements

**You MUST use Serena MCP tools for ALL file operations:**

| Task | Tool |
|------|------|
| Find files by name | `mcp_serena_find_file` |
| List directory contents | `mcp_serena_list_dir` |
| Search code patterns | `mcp_serena_search_for_pattern` |
| Get file overview | `mcp_serena_get_symbols_overview` |
| Find symbols (classes, functions) | `mcp_serena_find_symbol` |
| Find references to symbols | `mcp_serena_find_referencing_symbols` |
| Replace symbol body | `mcp_serena_replace_symbol_body` |
| Insert code after symbol | `mcp_serena_insert_after_symbol` |
| Insert code before symbol | `mcp_serena_insert_before_symbol` |
| Rename symbols across codebase | `mcp_serena_rename_symbol` |

**Also use:**
- `mcp_linear_*` tools for ticket management (update status, add comments)
- `mcp_serena_think_about_*` tools before making changes

**Before editing ANY file:**
1. Call `mcp_serena_get_symbols_overview` to understand the file structure
2. Call `mcp_serena_find_symbol` to get the exact symbol body you need to modify
3. Call `mcp_serena_think_about_task_adherence` before inserting/replacing code
4. Use `mcp_serena_replace_symbol_body` or `mcp_serena_insert_after_symbol` to edit

---

## 📊 Current Linear Status

| Ticket | Title | Status |
|--------|-------|--------|
| MIN-5 to MIN-8 | Phase 1 (Foundation + Auth) | ✅ Done |
| MIN-9 to MIN-13 | Phase 2 (Projects + Tickets CRUD) | ✅ Done |
| MIN-14 to MIN-17 | Phase 3 (Kanban Board) | ✅ Done |
| **MIN-18** | [PHASE-4.1] Ticket history tracking | 🔄 **In Progress** |
| MIN-19 | [PHASE-4.2] Activity log per project | ⏳ Backlog |
| MIN-20 | [PHASE-4.3] Search and filter tickets | ⏳ Backlog |
| MIN-21 | [PHASE-4.4] Responsive design pass | ⏳ Backlog |

---

## 📁 Project Structure

```
minutedev/
├── apps/web/                     # TanStack Start app
│   ├── src/
│   │   ├── server/
│   │   │   ├── projects.ts       # Projects CRUD server functions
│   │   │   └── tickets.ts        # Tickets CRUD + reorderTicket
│   │   ├── components/
│   │   │   ├── board/            # Kanban components
│   │   │   │   ├── kanban-board.tsx
│   │   │   │   ├── kanban-column.tsx
│   │   │   │   ├── sortable-ticket-card.tsx
│   │   │   │   └── ticket-card.tsx
│   │   │   ├── tickets/          # Ticket UI components
│   │   │   │   ├── ticket-table.tsx
│   │   │   │   ├── create-ticket-dialog.tsx
│   │   │   │   ├── edit-ticket-dialog.tsx
│   │   │   │   └── delete-ticket-dialog.tsx
│   │   │   ├── projects/         # Project UI components
│   │   │   └── layout/           # Sidebar, Header
│   │   ├── routes/
│   │   │   ├── _authed/projects/$projectId/
│   │   │   │   ├── index.tsx     # Project overview
│   │   │   │   ├── list.tsx      # Ticket list view
│   │   │   │   └── board.tsx     # Kanban board
│   │   │   └── auth/             # Login, Register, etc.
│   │   └── lib/
│   │       ├── auth.ts           # Better Auth server config
│   │       └── auth-client.ts    # Better Auth client
│   └── package.json
├── packages/db/                  # Drizzle + Turso
│   └── src/schema/
│       ├── auth.ts               # users, sessions, accounts, verifications
│       ├── projects.ts           # projects table
│       ├── tickets.ts            # tickets table with status/priority enums
│       ├── activity.ts           # ticketHistory, activityLog tables
│       ├── relations.ts          # Drizzle relations for type-safe joins
│       └── index.ts              # Re-exports all schemas
└── packages/ui/                  # Shared utilities (cn function)
```

---

## 🎯 Phase 4 Tasks (YOUR WORK)

### MIN-18: Ticket History Tracking (In Progress)

**What to build:**
1. Modify `updateTicket` in `apps/web/src/server/tickets.ts` to record changes
2. Create `apps/web/src/components/tickets/ticket-history.tsx` component
3. Add history timeline to ticket detail view

**Schema already exists** in `packages/db/src/schema/activity.ts`:

```typescript
export const ticketHistory = sqliteTable("ticket_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  field: text("field").notNull(),        // "status", "priority", "title", etc.
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
```

**Implementation steps:**
1. Use `mcp_serena_find_symbol` to get `updateTicket` function body
2. Modify it to compare old vs new values and insert into `ticketHistory`
3. Create new `ticket-history.tsx` component using `mcp_serena_insert_after_symbol`
4. Update Linear: `mcp_linear_update_issue` with id `MIN-18` state `Done`

---

### MIN-19: Activity Log per Project

**What to build:**
1. Create server function to log activities
2. Modify `createTicket`, `updateTicket`, `deleteTicket`, `reorderTicket` to log activities
3. Create `apps/web/src/components/activity-feed.tsx`
4. Display activity feed on project overview page

**Schema already exists:**

```typescript
export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  ticketId: text("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  userId: text("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),      // "created_ticket", "moved_ticket", "updated_ticket"
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
```

---

### MIN-20: Search and Filter Tickets

**What to build:**
1. Add shadcn `command` component: `pnpm dlx shadcn@latest add command popover`
2. Create search/filter bar component
3. Add query params to ticket list/board for filters
4. Implement command palette (Cmd+K)

**Filter options:**
- Text search (title, description)
- Status filter (multi-select)
- Priority filter
- Assignee filter

---

### MIN-21: Responsive Design Pass

**What to build:**
1. Collapsible sidebar with hamburger menu on mobile
2. Board horizontal scroll on mobile
3. Touch-friendly drag targets (larger hit areas)
4. Test all views at mobile breakpoints

---

## 🔑 Key Files to Understand

### Server Functions (`apps/web/src/server/tickets.ts`)

Current exports:
- `getTickets` - Get tickets by project with optional filters
- `getTicket` - Get single ticket with relations
- `createTicket` - Create with gap-based ordering (ORDER_GAP = 1000)
- `updateTicket` - Update any field
- `deleteTicket` - Delete ticket
- `reorderTicket` - Update status + order (for drag-drop)

### Database Types

From `packages/db/src/index.ts`:
```typescript
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketStatus = "backlog" | "todo" | "in_progress" | "done";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketHistory = typeof ticketHistory.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;
```

---

## 🛠️ Tech Stack Reference

- **Framework**: TanStack Start (React + TypeScript)
- **Database**: Turso (libSQL) + Drizzle ORM
- **Auth**: Better Auth with Drizzle adapter
- **UI**: shadcn/ui + Tailwind CSS v4
- **Icons**: Lucide React
- **Drag-drop**: @dnd-kit/core, @dnd-kit/sortable
- **Notifications**: Sonner (toast)

---

## 📝 Workflow for Each Task

```
1. Read the Linear ticket details
   → mcp_linear_get_issue with ticket ID

2. Understand current code
   → mcp_serena_get_symbols_overview for file structure
   → mcp_serena_find_symbol for specific functions

3. Plan the change
   → mcp_serena_think_about_collected_information
   → mcp_serena_think_about_task_adherence

4. Make the edit
   → mcp_serena_replace_symbol_body for modifying existing functions
   → mcp_serena_insert_after_symbol for adding new code

5. Update Linear
   → mcp_linear_update_issue to set status to "Done"
   → mcp_linear_create_comment if needed
```

---

## ✅ Acceptance Criteria (Phase 4)

- [ ] Every ticket update creates a history record in `ticket_history`
- [ ] Ticket detail view shows change history timeline
- [ ] Project overview shows recent activity feed (last 20 actions)
- [ ] Can search tickets by title/description (real-time filtering)
- [ ] Can filter tickets by status, priority, assignee
- [ ] Command palette opens with Cmd+K
- [ ] Sidebar collapses on mobile (< 768px)
- [ ] Board scrolls horizontally on mobile
- [ ] No horizontal overflow issues on any page

---

## 🚀 Start Here

1. Call `mcp_serena_initial_instructions` to get Serena tool usage guide
2. Call `mcp_linear_get_issue` with id `MIN-18` to see current task details
3. Call `mcp_serena_find_symbol` with `name_path_pattern: "updateTicket"` and `relative_path: "apps/web/src/server/tickets.ts"` with `include_body: true`
4. Modify `updateTicket` to track field changes in `ticketHistory` table
5. Create the `ticket-history.tsx` component
6. Update Linear ticket MIN-18 to Done and move to MIN-19

Good luck! 🎉

