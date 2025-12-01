"use client";

import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useProjectChannel, 
  useTicketChannel, 
  events 
} from "@/lib/pusher-client";
import { ticketKeys } from "./use-tickets";
import { commentKeys } from "./use-comments";

// Hook to auto-invalidate ticket queries on real-time events
export function useRealtimeTickets(projectId: string | null) {
  const queryClient = useQueryClient();
  const { isConnected, bind } = useProjectChannel(projectId);
  
  const handleTicketEvent = useCallback(() => {
    if (projectId) {
      // Invalidate all ticket queries for this project
      queryClient.invalidateQueries({
        queryKey: ticketKeys.list(projectId),
      });
    }
  }, [projectId, queryClient]);
  
  useEffect(() => {
    if (!isConnected) return;
    
    const unbindCreated = bind(events.TICKET_CREATED, handleTicketEvent);
    const unbindUpdated = bind(events.TICKET_UPDATED, handleTicketEvent);
    const unbindDeleted = bind(events.TICKET_DELETED, handleTicketEvent);
    const unbindMoved = bind(events.TICKET_MOVED, handleTicketEvent);
    
    return () => {
      unbindCreated();
      unbindUpdated();
      unbindDeleted();
      unbindMoved();
    };
  }, [isConnected, bind, handleTicketEvent]);
  
  return { isConnected };
}

// Hook to auto-invalidate comment queries on real-time events
export function useRealtimeComments(ticketId: string | null) {
  const queryClient = useQueryClient();
  const { isConnected, bind } = useTicketChannel(ticketId);
  
  const handleCommentEvent = useCallback(() => {
    if (ticketId) {
      // Invalidate comment queries for this ticket
      queryClient.invalidateQueries({
        queryKey: commentKeys.list(ticketId),
      });
    }
  }, [ticketId, queryClient]);
  
  useEffect(() => {
    if (!isConnected) return;
    
    const unbindCreated = bind(events.COMMENT_CREATED, handleCommentEvent);
    const unbindUpdated = bind(events.COMMENT_UPDATED, handleCommentEvent);
    const unbindDeleted = bind(events.COMMENT_DELETED, handleCommentEvent);
    
    return () => {
      unbindCreated();
      unbindUpdated();
      unbindDeleted();
    };
  }, [isConnected, bind, handleCommentEvent]);
  
  return { isConnected };
}

// Combined hook for a ticket detail view (both ticket and comments)
export function useRealtimeTicketDetail(projectId: string | null, ticketId: string | null) {
  const ticketRealtime = useRealtimeTickets(projectId);
  const commentRealtime = useRealtimeComments(ticketId);
  
  return {
    isTicketConnected: ticketRealtime.isConnected,
    isCommentConnected: commentRealtime.isConnected,
    isConnected: ticketRealtime.isConnected || commentRealtime.isConnected,
  };
}

