"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, embeddings, tickets, projects, eq, and, inArray } from "@minute/db";
import {
  generateEmbedding,
  hashContent,
  prepareTicketContent,
  findSimilar,
  embeddingConfig,
} from "@/lib/embeddings";

// Get current user session
async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session.user;
}

// Verify project access
async function verifyProjectAccess(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { success: false, error: "Project not found" };
  }

  // For backward compatibility: if no organizationId, check ownership
  if (!project.organizationId) {
    if (project.ownerId !== session.user.id) {
      return { success: false, error: "Unauthorized" };
    }
    return { success: true, project };
  }

  // Check organization permission
  const hasPermission = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      organizationId: project.organizationId,
      permissions: {
        project: ["read"],
      },
    },
  });

  if (!hasPermission) {
    return { success: false, error: "Insufficient permissions" };
  }

  return { success: true, project };
}

/**
 * Generate and store embedding for a ticket
 */
export async function embedTicket(ticketId: string) {
  try {
    await getCurrentUser();

    // Get ticket
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return { success: false, error: "Ticket not found" };
    }

    // Verify project access
    const accessCheck = await verifyProjectAccess(ticket.projectId);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Prepare content and generate hash
    const content = prepareTicketContent(ticket);
    const contentHash = hashContent(content);

    // Check if embedding already exists with same content
    const [existing] = await db
      .select()
      .from(embeddings)
      .where(
        and(
          eq(embeddings.entityType, "ticket"),
          eq(embeddings.entityId, ticketId),
          eq(embeddings.contentHash, contentHash)
        )
      )
      .limit(1);

    if (existing) {
      return { success: true, data: existing, cached: true };
    }

    // Generate new embedding
    const embedding = await generateEmbedding(content);

    // Delete old embedding for this ticket if exists
    await db
      .delete(embeddings)
      .where(
        and(
          eq(embeddings.entityType, "ticket"),
          eq(embeddings.entityId, ticketId)
        )
      );

    // Store new embedding
    const [stored] = await db
      .insert(embeddings)
      .values({
        entityType: "ticket",
        entityId: ticketId,
        content,
        contentHash,
        embedding,
        model: embeddingConfig.model,
        dimensions: embeddingConfig.dimensions,
      })
      .returning();

    return { success: true, data: stored, cached: false };
  } catch (error) {
    console.error("Error embedding ticket:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to embed ticket",
    };
  }
}

/**
 * Semantic search for tickets within a project
 */
export async function semanticSearchTickets(
  projectId: string,
  query: string,
  options: { limit?: number; threshold?: number } = {}
) {
  try {
    await getCurrentUser();

    // Verify project access
    const accessCheck = await verifyProjectAccess(projectId);
    if (!accessCheck.success) {
      return { success: false, error: accessCheck.error, data: [] };
    }

    // Get all ticket IDs in this project
    const projectTickets = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.projectId, projectId));

    const ticketIds = projectTickets.map((t) => t.id);

    if (ticketIds.length === 0) {
      return { success: true, data: [] };
    }

    // Get embeddings for these tickets
    const ticketEmbeddings = await db
      .select()
      .from(embeddings)
      .where(
        and(
          eq(embeddings.entityType, "ticket"),
          inArray(embeddings.entityId, ticketIds)
        )
      );

    if (ticketEmbeddings.length === 0) {
      return { success: true, data: [], message: "No embeddings found. Run embedTicket first." };
    }

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Find similar tickets
    const similar = findSimilar(queryEmbedding, ticketEmbeddings, {
      limit: options.limit || 10,
      threshold: options.threshold || 0.3,
    });

    // Get full ticket data for results
    const resultTicketIds = similar.map((s) => s.entityId);
    const resultTickets = await db
      .select()
      .from(tickets)
      .where(inArray(tickets.id, resultTicketIds));

    // Combine tickets with similarity scores
    const results = similar.map((s) => {
      const ticket = resultTickets.find((t) => t.id === s.entityId);
      return {
        ticket,
        similarity: s.similarity,
        embeddedContent: s.content,
      };
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("Error in semantic search:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
      data: [],
    };
  }
}

/**
 * Batch embed all tickets in a project
 */
export async function embedProjectTickets(projectId: string) {
  try {
    await getCurrentUser();

    // Verify project access
    const accessCheck = await verifyProjectAccess(projectId);
    if (!accessCheck.success) {
      return accessCheck;
    }

    // Get all tickets in project
    const projectTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.projectId, projectId));

    const results = {
      total: projectTickets.length,
      embedded: 0,
      cached: 0,
      errors: 0,
    };

    // Embed each ticket
    for (const ticket of projectTickets) {
      try {
        const result = await embedTicket(ticket.id);
        if (result.success) {
          if ('cached' in result && result.cached) {
            results.cached++;
          } else {
            results.embedded++;
          }
        } else {
          results.errors++;
        }
      } catch {
        results.errors++;
      }
    }

    return { success: true, data: results };
  } catch (error) {
    console.error("Error embedding project tickets:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to embed tickets",
    };
  }
}

/**
 * Find similar tickets to a given ticket
 */
export async function findSimilarTickets(
  ticketId: string,
  options: { limit?: number; threshold?: number } = {}
) {
  try {
    await getCurrentUser();

    // Get ticket and its embedding
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      return { success: false, error: "Ticket not found", data: [] };
    }

    // Verify project access
    const accessCheck = await verifyProjectAccess(ticket.projectId);
    if (!accessCheck.success) {
      return { success: false, error: accessCheck.error, data: [] };
    }

    // Get embedding for this ticket
    const [ticketEmb] = await db
      .select()
      .from(embeddings)
      .where(
        and(
          eq(embeddings.entityType, "ticket"),
          eq(embeddings.entityId, ticketId)
        )
      )
      .limit(1);

    if (!ticketEmb) {
      // Try to create embedding first
      const embedResult = await embedTicket(ticketId);
      if (!embedResult.success) {
        return { success: false, error: "No embedding found", data: [] };
      }
      // Recursively call with new embedding
      return findSimilarTickets(ticketId, options);
    }

    // Get other ticket embeddings in the same project
    const projectTickets = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.projectId, ticket.projectId));

    const otherTicketIds = projectTickets
      .map((t) => t.id)
      .filter((id) => id !== ticketId);

    if (otherTicketIds.length === 0) {
      return { success: true, data: [] };
    }

    const otherEmbeddings = await db
      .select()
      .from(embeddings)
      .where(
        and(
          eq(embeddings.entityType, "ticket"),
          inArray(embeddings.entityId, otherTicketIds)
        )
      );

    // Find similar
    const similar = findSimilar(ticketEmb.embedding, otherEmbeddings, {
      limit: options.limit || 5,
      threshold: options.threshold || 0.5,
    });

    // Get full ticket data
    const resultTicketIds = similar.map((s) => s.entityId);
    const resultTickets = await db
      .select()
      .from(tickets)
      .where(inArray(tickets.id, resultTicketIds));

    const results = similar.map((s) => {
      const t = resultTickets.find((ticket) => ticket.id === s.entityId);
      return {
        ticket: t,
        similarity: s.similarity,
      };
    });

    return { success: true, data: results };
  } catch (error) {
    console.error("Error finding similar tickets:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to find similar",
      data: [],
    };
  }
}

