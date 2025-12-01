import Pusher from "pusher";

// Server-side Pusher client for triggering events
// Configure in .env:
// PUSHER_APP_ID=xxx
// PUSHER_KEY=xxx (same as NEXT_PUBLIC_PUSHER_KEY)
// PUSHER_SECRET=xxx
// PUSHER_CLUSTER=xxx (same as NEXT_PUBLIC_PUSHER_CLUSTER)

const pusherAppId = process.env.PUSHER_APP_ID;
const pusherKey = process.env.PUSHER_KEY;
const pusherSecret = process.env.PUSHER_SECRET;
const pusherCluster = process.env.PUSHER_CLUSTER;

// Only initialize if all env vars are present
export const pusher = pusherAppId && pusherKey && pusherSecret && pusherCluster
  ? new Pusher({
      appId: pusherAppId,
      key: pusherKey,
      secret: pusherSecret,
      cluster: pusherCluster,
      useTLS: true,
    })
  : null;

// Channel naming conventions
export const channels = {
  // Project-level channel for ticket updates
  project: (projectId: string) => `project-${projectId}`,
  // Ticket-level channel for comments, attachments
  ticket: (ticketId: string) => `ticket-${ticketId}`,
  // User-level channel for notifications
  user: (userId: string) => `user-${userId}`,
};

// Event types
export const events = {
  // Ticket events
  TICKET_CREATED: "ticket:created",
  TICKET_UPDATED: "ticket:updated",
  TICKET_DELETED: "ticket:deleted",
  TICKET_MOVED: "ticket:moved",
  // Comment events
  COMMENT_CREATED: "comment:created",
  COMMENT_UPDATED: "comment:updated",
  COMMENT_DELETED: "comment:deleted",
  // Presence events
  USER_JOINED: "user:joined",
  USER_LEFT: "user:left",
  USER_TYPING: "user:typing",
};

// Event payload types
export type TicketEvent = {
  ticketId: string;
  projectId: string;
  userId: string;
  data?: Record<string, unknown>;
};

export type CommentEvent = {
  commentId: string;
  ticketId: string;
  userId: string;
  data?: Record<string, unknown>;
};

export type PresenceEvent = {
  userId: string;
  userName: string;
  userImage?: string;
  ticketId?: string;
};

// Helper to trigger events (safe - no-ops if Pusher not configured)
export async function triggerEvent(
  channel: string,
  event: string,
  data: Record<string, unknown>
) {
  if (!pusher) {
    console.log(`[Pusher disabled] Would trigger ${event} on ${channel}:`, data);
    return;
  }
  
  try {
    await pusher.trigger(channel, event, data);
  } catch (error) {
    console.error(`[Pusher] Failed to trigger ${event} on ${channel}:`, error);
  }
}

// Convenience helpers
export async function triggerTicketEvent(
  projectId: string,
  event: string,
  data: TicketEvent
) {
  return triggerEvent(channels.project(projectId), event, data);
}

export async function triggerCommentEvent(
  ticketId: string,
  event: string,
  data: CommentEvent
) {
  return triggerEvent(channels.ticket(ticketId), event, data);
}


