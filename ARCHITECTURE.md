# Minute - Architecture Plan

> AI-native task management platform (Jira alternative)  
> **Stack**: Next.js 15 + Turborepo + Drizzle + Turso + shadcn + dnd-kit

---

## 1. Architecture Overview

### 1.1 Monorepo Structure

```
minutedev/
├── apps/
│   └── web/                          # Next.js 15 App Router
│       ├── src/
│       │   ├── app/                  # App Router pages
│       │   │   ├── (auth)/           # Auth route group (no layout)
│       │   │   │   ├── login/
│       │   │   │   │   └── page.tsx
│       │   │   │   └── register/
│       │   │   │       └── page.tsx
│       │   │   ├── (dashboard)/      # Main app route group
│       │   │   │   ├── layout.tsx    # Sidebar + Header shell
│       │   │   │   ├── projects/
│       │   │   │   │   ├── page.tsx  # Project list
│       │   │   │   │   └── [slug]/
│       │   │   │   │       ├── page.tsx      # Project overview (redirect to board)
│       │   │   │   │       ├── board/
│       │   │   │   │       │   └── page.tsx  # Kanban board
│       │   │   │   │       └── list/
│       │   │   │   │           └── page.tsx  # Table view
│       │   │   │   └── page.tsx      # Dashboard home (redirect to /projects)
│       │   │   ├── api/
│       │   │   │   └── [...catchall]/
│       │   │   │       └── route.ts  # Reserved for future API needs
│       │   │   ├── layout.tsx        # Root layout (providers, fonts)
│       │   │   └── page.tsx          # Landing (redirect to /projects)
│       │   ├── components/
│       │   │   ├── ui/               # shadcn components
│       │   │   ├── board/            # Kanban-specific (Client Components)
│       │   │   │   ├── kanban-board.tsx
│       │   │   │   ├── kanban-column.tsx
│       │   │   │   ├── ticket-card.tsx
│       │   │   │   └── sortable-ticket-card.tsx
│       │   │   ├── projects/
│       │   │   │   ├── project-card.tsx
│       │   │   │   ├── project-list.tsx
│       │   │   │   ├── create-project-dialog.tsx
│       │   │   │   └── delete-project-dialog.tsx
│       │   │   ├── tickets/
│       │   │   │   ├── ticket-table.tsx
│       │   │   │   ├── create-ticket-dialog.tsx
│       │   │   │   ├── edit-ticket-sheet.tsx
│       │   │   │   └── delete-ticket-dialog.tsx
│       │   │   └── layout/
│       │   │       ├── sidebar.tsx
│       │   │       ├── header.tsx
│       │   │       └── mobile-nav.tsx
│       │   ├── actions/              # Server Actions
│       │   │   ├── projects.ts
│       │   │   └── tickets.ts
│       │   └── lib/
│       │       ├── db.ts             # Re-export from @minute/db
│       │       └── utils.ts          # cn() helper
│       ├── tailwind.config.ts
│       ├── next.config.ts
│       └── package.json
├── packages/
│   └── db/                           # Database package (KEEP EXISTING)
│       ├── src/
│       │   ├── index.ts              # Client + exports
│       │   └── schema/
│       │       ├── auth.ts           # Better Auth tables (future)
│       │       ├── projects.ts       # ✓ Already exists
│       │       ├── tickets.ts        # ✓ Already exists
│       │       ├── activity.ts       # ✓ Already exists (ticketHistory, activityLog)
│       │       ├── relations.ts      # Drizzle relations
│       │       └── index.ts
│       ├── drizzle.config.ts
│       └── package.json
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── KANBAN.md
```

### 1.2 Data Model (Drizzle Schema)

**Already implemented in `packages/db/src/schema/`:**

```
┌─────────────────┐       ┌─────────────────┐
│    projects     │       │     tickets     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │
│ name            │  │    │ title           │
│ description     │  │    │ description     │
│ slug (unique)   │  │    │ status (enum)   │
│ ownerId (FK)    │  └───▶│ priority (enum) │
│ metadata (JSON) │       │ order (int)     │
│ createdAt       │       │ projectId (FK)  │──┐
│ updatedAt       │       │ creatorId (FK)  │  │
└─────────────────┘       │ assigneeId (FK) │  │
                          │ dueDate         │  │
                          │ metadata (JSON) │  │
                          │ createdAt       │  │
                          │ updatedAt       │  │
                          └─────────────────┘  │
                                    ▲          │
┌─────────────────┐       ┌────────┴────────┐  │
│ ticket_history  │       │  activity_log   │  │
├─────────────────┤       ├─────────────────┤  │
│ id (PK)         │       │ id (PK)         │  │
│ ticketId (FK)   │──────▶│ projectId (FK)  │◀─┘
│ userId (FK)     │       │ ticketId (FK)   │
│ field           │       │ userId (FK)     │
│ oldValue        │       │ action          │
│ newValue        │       │ details (JSON)  │
│ createdAt       │       │ createdAt       │
└─────────────────┘       └─────────────────┘
```

**Status Enum:** `backlog` | `todo` | `in_progress` | `done`  
**Priority Enum:** `low` | `medium` | `high` | `urgent`

**AI-Ready Notes:**
- `metadata` JSON columns for extensibility (embeddings pointer, custom fields)
- `ticket_history` for audit trail and "what changed?" queries
- `activity_log` for project-level feed and agent action tracking

### 1.3 Route Structure

| Route | Component Type | Description |
|-------|---------------|-------------|
| `/` | Server | Redirect to `/projects` |
| `/login` | Server | Login page (future auth) |
| `/register` | Server | Register page (future auth) |
| `/projects` | Server | Project list with create dialog |
| `/projects/[slug]` | Server | Redirect to `/projects/[slug]/board` |
| `/projects/[slug]/board` | **Client** | Kanban board (dnd-kit) |
| `/projects/[slug]/list` | Server + Client | Table view with sorting |

---

## 2. MVP Phases

### Phase 1: Foundation (Days 1-2)
**Goal:** Next.js 15 app running with Drizzle connected to Turso

**Deliverables:**
- Next.js 15 app in `apps/web`
- Turborepo config working
- Database package exporting schema + client
- Basic layout shell (sidebar + header placeholder)
- Environment setup (.env.local)

### Phase 2: Projects CRUD (Days 3-4)
**Goal:** Create, view, edit, delete projects

**Deliverables:**
- Server Actions for projects
- Project list page with cards
- Create project dialog
- Edit/delete project
- Project slug routing

### Phase 3: Tickets + Board (Days 5-7)
**Goal:** Full Kanban board with drag-and-drop

**Deliverables:**
- Server Actions for tickets
- Ticket CRUD dialogs
- Kanban board with dnd-kit
- Drag between columns (status change)
- Drag within column (reorder)
- Optimistic updates

### Phase 4: Polish (Days 8-9)
**Goal:** MVP ready for demo

**Deliverables:**
- Ticket table/list view
- Basic search/filter (client-side)
- Empty states
- Loading states
- Error handling
- Mobile responsive

---

## 3. Tickets by Phase

### Phase 1: Foundation

| ID | Title | Complexity | Description |
|----|-------|------------|-------------|
| P1-01 | Next.js 15 app setup | S | Create Next.js 15 app with App Router in apps/web |
| P1-02 | Turborepo configuration | S | Configure turbo.json, workspace dependencies |
| P1-03 | Tailwind v4 + shadcn setup | M | Install Tailwind v4, configure shadcn CLI |
| P1-04 | Database connection | S | Wire up Turso client in packages/db |
| P1-05 | Layout shell | M | Basic sidebar + header (no auth) |

### Phase 2: Projects CRUD

| ID | Title | Complexity | Description |
|----|-------|------------|-------------|
| P2-01 | Projects Server Actions | M | createProject, getProjects, updateProject, deleteProject |
| P2-02 | Project list page | M | Grid of project cards, empty state |
| P2-03 | Create project dialog | S | Name, description, slug auto-generation |
| P2-04 | Edit project sheet | S | Update name, description |
| P2-05 | Delete project dialog | S | Confirmation with cascade warning |

### Phase 3: Tickets + Board

| ID | Title | Complexity | Description |
|----|-------|------------|-------------|
| P3-01 | Tickets Server Actions | M | createTicket, getTickets, updateTicket, deleteTicket, reorderTicket |
| P3-02 | Create ticket dialog | M | All fields: title, description, status, priority, due date |
| P3-03 | Edit ticket sheet | M | Full edit with status/priority dropdowns |
| P3-04 | dnd-kit setup | M | Install, configure sensors, collision detection |
| P3-05 | Kanban column component | M | Column header, ticket count, droppable area |
| P3-06 | Ticket card component | S | Title, priority badge, due date |
| P3-07 | Drag-drop logic | L | Cross-column + within-column moves, optimistic updates |
| P3-08 | Delete ticket dialog | S | Confirmation dialog |

### Phase 4: Polish

| ID | Title | Complexity | Description |
|----|-------|------------|-------------|
| P4-01 | Ticket table view | M | Sortable columns, status/priority badges |
| P4-02 | Client-side search | S | Filter tickets by title |
| P4-03 | Empty states | S | No projects, no tickets illustrations |
| P4-04 | Loading skeletons | S | Skeleton loaders for list/board |
| P4-05 | Error boundaries | S | Graceful error handling |
| P4-06 | Mobile responsive | M | Collapsible sidebar, touch-friendly board |

---

## 4. Key Implementation Notes

### 4.1 shadcn Components to Install

```bash
# Phase 1
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dialog dropdown-menu input label sheet sidebar sonner

# Phase 2-3
pnpm dlx shadcn@latest add badge select textarea table avatar separator scroll-area

# Phase 4
pnpm dlx shadcn@latest add skeleton command popover
```

### 4.2 dnd-kit Integration

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Key patterns:**
- `kanban-board.tsx` → Client Component with `"use client"`
- `DndContext` wraps entire board
- `SortableContext` per column (vertical list strategy)
- `useSortable` hook for each ticket card
- `DragOverlay` for visual feedback

```tsx
// Sensors config
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);

// Collision detection
<DndContext
  sensors={sensors}
  collisionDetection={closestCorners}
  onDragEnd={handleDragEnd}
>
```

### 4.3 Server Actions Pattern

```tsx
// actions/projects.ts
"use server";

import { db } from "@minute/db";
import { projects } from "@minute/db/schema";
import { revalidatePath } from "next/cache";

export async function createProject(data: { name: string; description?: string }) {
  const slug = generateSlug(data.name);
  
  const [project] = await db.insert(projects).values({
    name: data.name,
    description: data.description,
    slug,
    ownerId: "implicit-user", // No auth for MVP
  }).returning();
  
  revalidatePath("/projects");
  return project;
}
```

### 4.4 Server vs Client Components

| Component | Type | Why |
|-----------|------|-----|
| Layout shell | Server | Static, no interactivity |
| Project list | Server | Data fetching |
| Project card | Server | Static display |
| Create dialog | Client | Form state, dialog open/close |
| Kanban board | **Client** | dnd-kit requires client |
| Ticket card | Client | Part of drag context |
| Table view | Server + Client | Server fetches, client sorts |

### 4.5 Optimistic Updates Pattern

```tsx
// In kanban-board.tsx
const [optimisticTickets, setOptimisticTickets] = useState(tickets);

async function handleDragEnd(event: DragEndEvent) {
  // 1. Calculate new state
  const newTickets = reorderTickets(optimisticTickets, event);
  
  // 2. Update UI immediately
  setOptimisticTickets(newTickets);
  
  // 3. Sync to server
  try {
    await reorderTicket({
      ticketId: event.active.id,
      newStatus,
      newOrder,
    });
  } catch (error) {
    // 4. Revert on failure
    setOptimisticTickets(tickets);
    toast.error("Failed to move ticket");
  }
}
```

### 4.6 Gap-Based Ordering

For drag-drop reordering without recalculating all positions:

```
ORDER_GAP = 1000

New ticket → order = (lastOrder ?? 0) + ORDER_GAP
Move between tickets → order = (above.order + below.order) / 2
Edge case (gap < 1) → Rebalance entire column
```

---

## 5. Environment Variables

```bash
# apps/web/.env.local
TURSO_DATABASE_URL=libsql://minutedev-xxx.turso.io
TURSO_AUTH_TOKEN=your-token

# Future (auth)
# BETTER_AUTH_SECRET=xxx
# GOOGLE_CLIENT_ID=xxx
# GOOGLE_CLIENT_SECRET=xxx
```

---

## 6. Commands

```bash
# Development
pnpm dev              # Start all apps
pnpm --filter web dev # Start web only

# Database
pnpm --filter db db:push      # Push schema to Turso
pnpm --filter db db:studio    # Open Drizzle Studio

# Build
pnpm build            # Build all
turbo run build       # With cache
```

---

## 7. MVP Scope Reminder

**In scope:**
- ✅ Projects CRUD
- ✅ Tickets CRUD (status, priority, description, dates)
- ✅ Kanban board with drag-drop
- ✅ List/table view
- ✅ Persistence (Drizzle + Turso)

**Out of scope (future phases):**
- ❌ Auth (single implicit user)
- ❌ Real-time/websockets
- ❌ Comments/attachments
- ❌ AI features (schema ready)
- ❌ Team collaboration

---

*Generated: 2024-11-26*








