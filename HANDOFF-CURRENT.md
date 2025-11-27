# Minute - Current State Handoff

**Date:** November 27, 2025  
**Status:** Phase 2 Complete, Phase 3 In Progress  
**Next Steps:** Fix dueDate error, continue with Kanban board implementation

---

## 🎯 Project Overview

**Minute** is an AI-native task management platform (Jira alternative) built with:

- **Framework:** Next.js 15 (App Router)
- **Monorepo:** Turborepo
- **Database:** Turso (libSQL) + Drizzle ORM
- **Auth:** Better Auth
- **UI:** shadcn/ui + Tailwind CSS v4
- **State Management:** TanStack Query (React Query)
- **Drag & Drop:** dnd-kit (planned for Phase 3)

---

## ✅ What's Been Completed

### Phase 1: Foundation + Auth ✅

- Turborepo monorepo setup
- Turso + Drizzle schema + migrations
- Better Auth integration (email/password, GitHub OAuth)
- Basic layout shell (sidebar, header, auth state)

### Phase 2: Projects + Tickets CRUD ✅

- **Projects:** Create, read, list (update/delete pending - MIN-13)
- **Tickets:** Create, read, update, delete, reorder
- **Server Actions:** All CRUD operations with proper validation
- **TanStack Query Hooks:** `use-projects.ts`, `use-tickets.ts`
- **UI Components:**
  - Create project dialog
  - Create ticket dialog (with shadcn calendar for due date)
  - Project list page
  - Board/list view placeholders

### Current Implementation Status

**Working:**

- ✅ User authentication (login, register, session management)
- ✅ Project creation and listing
- ✅ Ticket creation with form validation
- ✅ Ticket listing (grouped by status)
- ✅ Server Actions with proper error handling
- ✅ TanStack Query integration with cache invalidation
- ✅ Toast notifications on success/error

**In Progress:**

- 🔄 Kanban board UI (MIN-16) - columns exist but no drag-drop yet
- 🔄 Ticket display on board (MIN-16)

**Known Issues:**

- ⚠️ **CRITICAL:** `dueDate` error when creating tickets - "value.getTime is not a function"
  - **Location:** `apps/web/src/actions/tickets.ts:147`
  - **Issue:** Date conversion from Unix timestamp (seconds) to Date object
  - **Status:** Partially fixed - needs validation

---

## 🐛 Current Bug: dueDate Error

### Error Message

```
Error creating ticket: Error: value.getTime is not a function
    at useCreateTicket.useMutation [as mutationFn] (use-tickets.ts:64:15)
```

### Root Cause

The `dueDate` field is being converted incorrectly:

1. Client sends: Unix timestamp in **seconds** (via `Math.floor(dueDate.getTime() / 1000)`)
2. Server receives: Number (validated by Zod as `z.number().optional()`)
3. Server converts: `new Date(validated.dueDate * 1000)` - should work but Drizzle might be calling `.getTime()` on invalid Date

### Current Code

```typescript
// apps/web/src/components/tickets/create-ticket-dialog.tsx:83
dueDate: dueDate ? Math.floor(dueDate.getTime() / 1000) : undefined,

// apps/web/src/actions/tickets.ts:147
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
```

### Fix Needed

The Date validation is in place, but we need to ensure:

1. `validated.dueDate` is always a number when provided
2. The Date object is valid before passing to Drizzle
3. Handle edge cases (null, undefined, invalid numbers)

**Suggested Fix:**

```typescript
dueDate: validated.dueDate && typeof validated.dueDate === 'number' && !isNaN(validated.dueDate)
  ? new Date(validated.dueDate * 1000)
  : null,
```

---

## 📁 Key Files & Architecture

### Server Actions Pattern

**Location:** `apps/web/src/actions/`

**Pattern:**

```typescript
'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db, tickets, projects } from '@minute/db';
import { z } from 'zod';

// 1. Get current user
async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error('Unauthorized');
  return session.user;
}

// 2. Validation schema
const createTicketSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1).max(200),
  // ...
});

// 3. Server Action
export async function createTicket(input: z.infer<typeof createTicketSchema>) {
  try {
    const user = await getCurrentUser();
    const validated = createTicketSchema.parse(input);

    // Verify project access
    // ... database operations ...

    revalidatePath(`/projects/${project.slug}/board`);

    return { success: true, data: ticket };
  } catch (error) {
    // Error handling
    return { success: false, error: error.message };
  }
}
```

### TanStack Query Hooks Pattern

**Location:** `apps/web/src/hooks/`

**Pattern:**

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createTicket, type CreateTicketInput } from '@/actions/tickets';

// Query keys
export const ticketKeys = {
  all: ['tickets'] as const,
  lists: (projectId: string) => [...ticketKeys.all, projectId, 'list'] as const,
  list: (projectId: string) => [...ticketKeys.lists(projectId)] as const,
};

// Mutation hook
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      const result = await createTicket(input);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create ticket');
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ticketKeys.lists(data.projectId),
      });
      toast.success('Ticket created successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create ticket');
    },
  });
}
```

### Database Schema

**Location:** `packages/db/src/schema/`

**Key Tables:**

- `users` - Better Auth user table
- `projects` - Project data (name, slug, ownerId, metadata)
- `tickets` - Ticket data (title, description, status, priority, order, dueDate, points)
- `ticketHistory` - Change tracking (for Phase 4)
- `activityLog` - Project activity feed (for Phase 4)

**Gap-Based Ordering:**

- Tickets use `order` field with `ORDER_GAP = 1000`
- New tickets get: `(maxOrder || 0) + ORDER_GAP`
- Allows efficient reordering without updating all tickets

---

## 🎯 Next Steps (Priority Order)

### 1. Fix dueDate Error (URGENT)

- **File:** `apps/web/src/actions/tickets.ts`
- **Action:** Ensure proper Date validation and conversion
- **Test:** Create ticket with due date, verify no errors

### 2. Continue Phase 3: Kanban Board (MIN-16)

- **Status:** Backlog
- **Tasks:**
  - Install dnd-kit packages
  - Implement drag-drop between columns
  - Display tickets in columns
  - Add ticket cards with proper styling

### 3. Drag-Drop + Optimistic Updates (MIN-17)

- **Status:** Backlog
- **Tasks:**
  - Implement `useReorderTicket` with optimistic updates
  - Add visual drag overlay
  - Handle errors with rollback

### 4. Edit Ticket Sheet (MIN-18)

- **Status:** Backlog
- **Tasks:**
  - Create edit ticket sheet component
  - Use `useUpdateTicket` hook
  - Add delete functionality

### 5. Edit/Delete Project (MIN-13)

- **Status:** Backlog
- **Priority:** High
- **Tasks:**
  - Create edit project sheet
  - Add delete project dialog with cascade warning

---

## 📋 Linear Tickets Status

### Completed ✅

- MIN-5 to MIN-12: Phase 1 & 2 foundation

### In Progress 🔄

- None currently

### Backlog ⏳

- **MIN-13:** Edit/Delete project (High priority)
- **MIN-16:** Kanban board - dnd-kit + columns (High priority)
- **MIN-17:** Drag-drop + optimistic updates (High priority)
- **MIN-18:** Edit ticket sheet (Medium priority)
- **MIN-19:** Ticket table view (Medium priority)
- **MIN-20:** Client-side search + filters (Medium priority)
- **MIN-21:** Empty states + loading + errors (Low priority)
- **MIN-47:** Mobile responsive design (Low priority)
- **MIN-58:** Unified reusable button component with CVA variants (Medium priority)
- **MIN-59:** Story points (estimation) for tickets (Low priority)

---

## 🛠️ Development Workflow

### Running the Project

```bash
# Install dependencies
pnpm install

# Run dev server (from root)
pnpm dev

# Run migrations (auto-runs on hot reload)
# No manual migration needed
```

### Adding New Components

```bash
# Add shadcn component
cd apps/web
pnpm dlx shadcn@latest add [component-name]
```

### Database Changes

1. Modify schema in `packages/db/src/schema/`
2. Migrations run automatically on hot reload
3. No manual migration scripts needed

### Code Style

- TypeScript strict mode
- Server Actions use `'use server'` directive
- Client components use `"use client"` directive
- TanStack Query for all data fetching
- Server Actions for all mutations
- Zod for validation
- Toast notifications via Sonner

---

## 🔍 Key Patterns to Follow

### 1. Server Actions

- Always validate with Zod
- Always check authentication
- Always verify project ownership
- Always use `revalidatePath` after mutations
- Return `{ success: boolean, data?: T, error?: string }`

### 2. TanStack Query

- Use query keys factory pattern
- Invalidate queries after mutations
- Use `enabled` for conditional queries
- Handle loading/error states in UI

### 3. Error Handling

- Server Actions: Return error in response object
- Hooks: Throw errors, catch in `onError`
- UI: Show toast notifications (automatic via hooks)

### 4. Date Handling

- Store as Unix timestamp (seconds) in database
- Convert to Date object for Drizzle: `new Date(timestamp * 1000)`
- Convert from Date to timestamp: `Math.floor(date.getTime() / 1000)`
- Always validate Date objects before passing to Drizzle

---

## 🚨 Known Issues & Gotchas

1. **dueDate Error:** See bug section above
2. **Overflow Issue:** Fixed - layout uses `h-screen` and `overflow-hidden`
3. **Button Components:** Multiple button components exist - refactor planned (MIN-58)
4. **Story Points:** Schema field exists but UI not implemented (MIN-59)

---

## 📚 Resources

- **Architecture:** `ARCHITECTURE.md`
- **Previous Handoff:** `HANDOFF-PHASE4.md` (outdated, use this doc)
- **Linear Board:** Use MCP tools to view tickets
- **Better Auth Docs:** https://better-auth.com/docs
- **TanStack Query Docs:** https://tanstack.com/query/latest
- **Drizzle ORM Docs:** https://orm.drizzle.team/docs/overview

---

## 🎯 Immediate Action Items

1. **Fix dueDate error** - Critical blocker
2. **Review Linear tickets** - Understand next priorities
3. **Continue Kanban board** - MIN-16 is next high-priority ticket
4. **Test ticket creation** - Ensure all fields work correctly

---

## 💡 Tips for Next Developer

1. **Always use Serena tools** for file operations (see HANDOFF-PHASE4.md for tool list)
2. **Check Linear tickets** before starting work - they have detailed acceptance criteria
3. **Follow existing patterns** - Server Actions, TanStack Query hooks, component structure
4. **Test thoroughly** - Especially date handling and form validation
5. **Update Linear tickets** when completing work
6. **Small incremental changes** - User prefers digestible diffs

---

**Good luck! 🚀**
