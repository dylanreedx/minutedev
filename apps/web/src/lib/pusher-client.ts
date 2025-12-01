'use client';

import PusherClient from 'pusher-js';
import { useEffect, useState, useCallback, useRef } from 'react';

// Client-side Pusher configuration
// Configure in .env:
// NEXT_PUBLIC_PUSHER_KEY=xxx
// NEXT_PUBLIC_PUSHER_CLUSTER=xxx

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

// Singleton Pusher client
let pusherClient: PusherClient | null = null;

function getPusherClient(): PusherClient | null {
  if (typeof window === 'undefined') return null;
  if (!pusherKey || !pusherCluster) return null;

  if (!pusherClient) {
    pusherClient = new PusherClient(pusherKey, {
      cluster: pusherCluster,
    });
  }

  return pusherClient;
}

// Channel naming (must match server-side)
export const channels = {
  project: (projectId: string) => `project-${projectId}`,
  ticket: (ticketId: string) => `ticket-${ticketId}`,
  user: (userId: string) => `user-${userId}`,
};

// Event types (must match server-side)
export const events = {
  TICKET_CREATED: 'ticket:created',
  TICKET_UPDATED: 'ticket:updated',
  TICKET_DELETED: 'ticket:deleted',
  TICKET_MOVED: 'ticket:moved',
  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_DELETED: 'comment:deleted',
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  USER_TYPING: 'user:typing',
};

// Hook to subscribe to a channel and listen for events
export function useChannel(channelName: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<PusherClient['subscribe']> | null>(null);

  useEffect(() => {
    if (!channelName) return;

    const client = getPusherClient();
    if (!client) return;

    const channel = client.subscribe(channelName);
    channelRef.current = channel;

    channel.bind('pusher:subscription_succeeded', () => {
      setIsConnected(true);
    });

    channel.bind('pusher:subscription_error', () => {
      setIsConnected(false);
    });

    return () => {
      channel.unbind_all();
      client.unsubscribe(channelName);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [channelName]);

  const bind = useCallback(
    <T = unknown>(event: string, callback: (data: T) => void) => {
      const channel = channelRef.current;
      if (!channel) return () => {};

      channel.bind(event, callback);
      return () => channel.unbind(event, callback);
    },
    []
  );

  return { isConnected, bind };
}

// Hook for project-level updates (tickets)
export function useProjectChannel(projectId: string | null) {
  const channelName = projectId ? channels.project(projectId) : null;
  return useChannel(channelName);
}

// Hook for ticket-level updates (comments, attachments)
export function useTicketChannel(ticketId: string | null) {
  const channelName = ticketId ? channels.ticket(ticketId) : null;
  return useChannel(channelName);
}

// Hook to listen for specific ticket events and invalidate React Query cache
export function useTicketUpdates(
  projectId: string | null,
  onUpdate?: () => void
) {
  const { isConnected, bind } = useProjectChannel(projectId);

  useEffect(() => {
    if (!isConnected) return;

    const unbindCreated = bind(events.TICKET_CREATED, onUpdate || (() => {}));
    const unbindUpdated = bind(events.TICKET_UPDATED, onUpdate || (() => {}));
    const unbindDeleted = bind(events.TICKET_DELETED, onUpdate || (() => {}));
    const unbindMoved = bind(events.TICKET_MOVED, onUpdate || (() => {}));

    return () => {
      unbindCreated();
      unbindUpdated();
      unbindDeleted();
      unbindMoved();
    };
  }, [isConnected, bind, onUpdate]);

  return { isConnected };
}

// Hook to listen for comment events
export function useCommentUpdates(
  ticketId: string | null,
  onUpdate?: () => void
) {
  const { isConnected, bind } = useTicketChannel(ticketId);

  useEffect(() => {
    if (!isConnected) return;

    const unbindCreated = bind(events.COMMENT_CREATED, onUpdate || (() => {}));
    const unbindUpdated = bind(events.COMMENT_UPDATED, onUpdate || (() => {}));
    const unbindDeleted = bind(events.COMMENT_DELETED, onUpdate || (() => {}));

    return () => {
      unbindCreated();
      unbindUpdated();
      unbindDeleted();
    };
  }, [isConnected, bind, onUpdate]);

  return { isConnected };
}

// Check if real-time is available
export function useRealtimeStatus() {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const client = getPusherClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAvailable(!!client);
  }, []);

  return isAvailable;
}
