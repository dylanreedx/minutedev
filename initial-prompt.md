You are architecting a task management platform called Minute.

## Context

- Solo developer building in spare time
- Goal: AI-native Jira alternative, MVP first
- Workflow: Generate plan → phases → tickets (via Linear MCP) → KANBAN.md tracking
- MCP tools available:
  - **Linear**: Create and manage tickets for THIS project's development
  - **shadcn**: UI component generation (use liberally for speed)
  - **Serena**: Agentic coding assistance

## Tech Stack (non-negotiable)

- **Monorepo**: Turborepo
- **Framework**: TanStack Start (TypeScript, full-stack)
- **Auth**: Better Auth
  - Drizzle adapter (SQLite provider)
  - Social providers: Google, GitHub
  - Email + password with email verification
  - Reference: https://better-auth.com/docs/integrations/tanstack
- **UI**: shadcn + Tailwind v4
- **Database**: Turso (libSQL) + Drizzle ORM (production-ready from day 1)
- **Drag-and-drop**: dnd-kit

## MVP Scope

### Phase 1: Foundation + Auth

- Turborepo setup (apps/web, packages/db, packages/ui)
- Turso connection + Drizzle schema + migrations
- Better Auth integration (Google, GitHub, email/password, verification)
- Basic layout shell (sidebar, header, auth state)

### Phase 2: Projects + Tickets CRUD

- Projects: create, read, update, delete, list
- Tickets: create, read, update, delete
- Ticket fields: title, description, status (backlog/todo/in-progress/done), priority (low/medium/high/urgent), dates (created, updated, due)
- List view for tickets within a project

### Phase 3: Kanban Board

- Board view: columns by status
- dnd-kit integration: drag tickets between columns
- Optimistic updates + Turso persistence
- Column ticket counts, empty states

### Phase 4: Polish + AI-Ready Schema

- Ticket history table (who changed what, when) — for future "what did I do last?" queries
- Activity log per ticket
- Metadata JSON column for extensibility
- Search/filter tickets
- Responsive design pass

### Explicit NON-goals for MVP

- No real-time/websockets (yet)
- No comments/attachments (yet)
- No team/org management (yet)
- No AI features in UI (yet) — but schema MUST support future: embeddings, agent action logs, context windows

## Deliverables

### 1. Architecture Overview

- Monorepo folder structure
- Drizzle schema (all tables, relations, indexes)
  - users, sessions, accounts (Better Auth)
  - projects
  - tickets
  - ticket_history
  - activity_log
- TanStack Start route structure (file-based)
- Environment variables needed

### 2. Phases (4 total)

Each phase = shippable increment with:

- Goal statement
- Files created/modified (full paths)
- Dependencies (npm packages)
- Acceptance criteria (testable)

### 3. Tickets per Phase

Format for Linear:

```
Title: [PHASE-X.Y] Descriptive title
Description:
- What: ...
- Why: ...
- Acceptance criteria:
  - [ ] Criterion 1
  - [ ] Criterion 2
Labels: phase-1 | phase-2 | phase-3 | phase-4
Priority: urgent | high | medium | low
Estimate: 1 | 2 | 3 | 5 (points, roughly hours)
```

Order tickets by dependency (blocking tickets first).

### 4. Implementation Notes

- shadcn components per feature (be specific: which components, where)
- dnd-kit setup pattern for Kanban (sensors, collision detection, sortable contexts)
- Better Auth setup steps (env vars, OAuth app creation, email provider)
- Drizzle migration workflow with Turso
- TanStack Start + Tailwind v4 config gotchas
- File naming conventions

## Optimization Priorities

1. **Speed**: Board visible by end of Phase 3
2. **Separation**: Auth, DB, UI in distinct packages — easy to add collab later
3. **AI-ready**: History tracking, extensible metadata, structured logs
4. **Developer UX**: Hot reload, type safety, minimal boilerplate

## Output Format

Start with Architecture Overview, then proceed phase-by-phase with full ticket breakdowns. End with Implementation Notes.

Use Linear MCP to create tickets as you define them. Use shadcn MCP when specifying component usage. Reference official docs for any non-obvious patterns.

Begin.
