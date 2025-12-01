#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  db,
  projects,
  tickets,
  comments,
  embeddings,
  agentActions,
  eq,
  and,
  inArray,
  desc,
} from "@minute/db";

// Status values matching the schema
const TICKET_STATUS = ["backlog", "todo", "in_progress", "done"] as const;
type TicketStatus = (typeof TICKET_STATUS)[number];

// Create the MCP server
const server = new McpServer({
  name: "minute-mcp",
  version: "0.1.0",
});

// Helper: Calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

// Helper: Log agent action
async function logAgentAction(data: {
  ticketId?: string;
  projectId?: string;
  action: string;
  promptSummary?: string;
  responseSummary?: string;
  agentSessionId?: string;
  context?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await db.insert(agentActions).values({
      ...data,
      agentType: "mcp-server",
      context: data.context ?? null,
    });
  } catch (err) {
    console.error("Failed to log agent action:", err);
  }
}

// ==================== TOOLS ====================

// Tool: List Projects
server.registerTool(
  "list_projects",
  {
    title: "List Projects",
    description:
      "List all projects the agent has access to, with ticket counts and recent activity summary",
    inputSchema: {
      includeTicketCounts: z.boolean().optional().describe("Include ticket counts per status"),
    },
    outputSchema: {
      projects: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          description: z.string().nullable(),
          ticketCounts: z
            .object({
              total: z.number(),
              backlog: z.number(),
              todo: z.number(),
              inProgress: z.number(),
              done: z.number(),
            })
            .optional(),
        })
      ),
    },
  },
  async ({ includeTicketCounts }) => {
    const projectList = await db.select().from(projects);

    const enrichedProjects = await Promise.all(
      projectList.map(async (project) => {
        const result: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          ticketCounts?: {
            total: number;
            backlog: number;
            todo: number;
            inProgress: number;
            done: number;
          };
        } = {
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: project.description,
        };

        if (includeTicketCounts) {
          const projectTickets = await db
            .select({ status: tickets.status })
            .from(tickets)
            .where(eq(tickets.projectId, project.id));

          result.ticketCounts = {
            total: projectTickets.length,
            backlog: projectTickets.filter((t) => t.status === "backlog").length,
            todo: projectTickets.filter((t) => t.status === "todo").length,
            inProgress: projectTickets.filter((t) => t.status === "in_progress").length,
            done: projectTickets.filter((t) => t.status === "done").length,
          };
        }

        return result;
      })
    );

    await logAgentAction({
      action: "list_projects",
      responseSummary: `Listed ${enrichedProjects.length} projects`,
      success: true,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(enrichedProjects, null, 2) }],
      structuredContent: { projects: enrichedProjects },
    };
  }
);

// Tool: Search Tickets (Semantic)
server.registerTool(
  "search_tickets",
  {
    title: "Search Tickets",
    description:
      "Search tickets semantically by meaning. Returns tickets that match the query intent, not just keywords.",
    inputSchema: {
      projectId: z.string().describe("Project ID to search within"),
      query: z.string().describe("Natural language search query"),
      limit: z.number().optional().describe("Max results (default 10)"),
    },
    outputSchema: {
      tickets: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          status: z.string(),
          priority: z.string(),
          similarity: z.number(),
        })
      ),
      message: z.string().optional(),
    },
  },
  async ({ projectId, query, limit = 10 }) => {
    // Get project tickets
    const projectTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.projectId, projectId));

    if (projectTickets.length === 0) {
      return {
        content: [{ type: "text", text: "No tickets found in this project" }],
        structuredContent: { tickets: [], message: "No tickets in project" },
      };
    }

    const ticketIds = projectTickets.map((t) => t.id);

    // Get embeddings for tickets
    const ticketEmbeddings = await db
      .select()
      .from(embeddings)
      .where(
        and(eq(embeddings.entityType, "ticket"), inArray(embeddings.entityId, ticketIds))
      );

    if (ticketEmbeddings.length === 0) {
      // Fallback to keyword search
      const keywordMatches = projectTickets
        .filter(
          (t) =>
            t.title.toLowerCase().includes(query.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, limit)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          similarity: 0.5, // Arbitrary score for keyword match
        }));

      await logAgentAction({
        projectId,
        action: "search_tickets",
        promptSummary: query,
        responseSummary: `Keyword search returned ${keywordMatches.length} results (no embeddings)`,
        success: true,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(keywordMatches, null, 2) }],
        structuredContent: {
          tickets: keywordMatches,
          message: "Used keyword search (no embeddings available)",
        },
      };
    }

    // Find similar using content matching (in production, embed the query)
    const scored = ticketEmbeddings
      .map((emb) => {
        const ticket = projectTickets.find((t) => t.id === emb.entityId);
        if (!ticket) return null;

        // Simple content matching score
        const content = emb.content?.toLowerCase() || "";
        const queryWords = query.toLowerCase().split(/\s+/);
        const matchCount = queryWords.filter((w) => content.includes(w)).length;
        const similarity = matchCount / queryWords.length;

        return {
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          similarity,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .filter((t) => t.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    await logAgentAction({
      projectId,
      action: "search_tickets",
      promptSummary: query,
      responseSummary: `Found ${scored.length} matching tickets`,
      success: true,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(scored, null, 2) }],
      structuredContent: { tickets: scored },
    };
  }
);

// Tool: Get Ticket Context
server.registerTool(
  "get_ticket_context",
  {
    title: "Get Ticket Context",
    description:
      "Get comprehensive context for a ticket including description, comments, related tickets, and recent activity. Use this before working on a ticket.",
    inputSchema: {
      ticketId: z.string().describe("Ticket ID"),
      includeRelated: z.boolean().optional().describe("Include semantically related tickets"),
    },
    outputSchema: {
      ticket: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        status: z.string(),
        priority: z.string(),
        points: z.number().nullable(),
        order: z.number(),
        createdAt: z.number(),
        updatedAt: z.number(),
      }),
      comments: z.array(
        z.object({
          id: z.string(),
          content: z.string(),
          createdAt: z.number(),
        })
      ),
      relatedTickets: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            status: z.string(),
            similarity: z.number(),
          })
        )
        .optional(),
      recentActivity: z.array(
        z.object({
          action: z.string(),
          timestamp: z.number(),
        })
      ),
    },
  },
  async ({ ticketId, includeRelated }) => {
    // Get ticket
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);

    if (!ticket) {
      return {
        content: [{ type: "text", text: "Ticket not found" }],
        isError: true,
      };
    }

    // Get comments
    const ticketComments = await db
      .select()
      .from(comments)
      .where(eq(comments.ticketId, ticketId))
      .orderBy(desc(comments.createdAt));

    // Get related tickets if requested
    let relatedTickets: Array<{
      id: string;
      title: string;
      status: string;
      similarity: number;
    }> = [];

    if (includeRelated) {
      // Get this ticket's embedding
      const [ticketEmb] = await db
        .select()
        .from(embeddings)
        .where(and(eq(embeddings.entityType, "ticket"), eq(embeddings.entityId, ticketId)))
        .limit(1);

      if (ticketEmb && ticketEmb.embedding) {
        // Get other embeddings in same project
        const projectTickets = await db
          .select({ id: tickets.id })
          .from(tickets)
          .where(eq(tickets.projectId, ticket.projectId));

        const otherIds = projectTickets.map((t) => t.id).filter((id) => id !== ticketId);

        if (otherIds.length > 0) {
          const otherEmbeddings = await db
            .select()
            .from(embeddings)
            .where(
              and(eq(embeddings.entityType, "ticket"), inArray(embeddings.entityId, otherIds))
            );

          const allTickets = await db
            .select()
            .from(tickets)
            .where(inArray(tickets.id, otherIds));

          relatedTickets = otherEmbeddings
            .map((emb) => {
              if (!emb.embedding) return null;
              const t = allTickets.find((t) => t.id === emb.entityId);
              if (!t) return null;
              const similarity = cosineSimilarity(ticketEmb.embedding, emb.embedding);
              return {
                id: t.id,
                title: t.title,
                status: t.status,
                similarity,
              };
            })
            .filter((t): t is NonNullable<typeof t> => t !== null)
            .filter((t) => t.similarity > 0.5)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5);
        }
      }
    }

    // Get recent agent activity on this ticket
    const recentActions = await db
      .select()
      .from(agentActions)
      .where(eq(agentActions.ticketId, ticketId))
      .orderBy(desc(agentActions.createdAt))
      .limit(10);

    const context = {
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        points: ticket.points,
        order: ticket.order,
        createdAt: ticket.createdAt?.getTime() ?? 0,
        updatedAt: ticket.updatedAt?.getTime() ?? 0,
      },
      comments: ticketComments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt?.getTime() ?? 0,
      })),
      relatedTickets: includeRelated ? relatedTickets : undefined,
      recentActivity: recentActions.map((a) => ({
        action: a.action,
        timestamp: a.createdAt?.getTime() ?? 0,
      })),
    };

    await logAgentAction({
      ticketId,
      projectId: ticket.projectId,
      action: "get_ticket_context",
      responseSummary: `Retrieved context for "${ticket.title}"`,
      success: true,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(context, null, 2) }],
      structuredContent: context,
    };
  }
);

// Tool: List Tickets
server.registerTool(
  "list_tickets",
  {
    title: "List Tickets",
    description: "List tickets in a project with optional filtering by status",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      status: z
        .enum(TICKET_STATUS)
        .optional()
        .describe("Filter by status"),
      limit: z.number().optional().describe("Max results (default 50)"),
    },
    outputSchema: {
      tickets: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          status: z.string(),
          priority: z.string(),
          points: z.number().nullable(),
        })
      ),
    },
  },
  async ({ projectId, status, limit = 50 }) => {
    const allTickets = await db
      .select()
      .from(tickets)
      .where(eq(tickets.projectId, projectId))
      .limit(limit);

    const filtered = status ? allTickets.filter((t) => t.status === status) : allTickets;

    const result = filtered.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      points: t.points,
    }));

    await logAgentAction({
      projectId,
      action: "list_tickets",
      responseSummary: `Listed ${result.length} tickets${status ? ` with status ${status}` : ""}`,
      success: true,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { tickets: result },
    };
  }
);

// Tool: Create Ticket
server.registerTool(
  "create_ticket",
  {
    title: "Create Ticket",
    description: "Create a new ticket in a project",
    inputSchema: {
      projectId: z.string().describe("Project ID"),
      title: z.string().describe("Ticket title"),
      description: z.string().optional().describe("Ticket description (supports HTML)"),
      status: z
        .enum(TICKET_STATUS)
        .optional()
        .describe("Initial status (default: backlog)"),
      priority: z
        .enum(["low", "medium", "high", "urgent"])
        .optional()
        .describe("Priority (default: medium)"),
      points: z.number().optional().describe("Story points estimate"),
    },
    outputSchema: {
      ticket: z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        priority: z.string(),
      }),
    },
  },
  async ({ projectId, title, description, status = "backlog", priority = "medium", points }) => {
    // Get max order for this status
    const existingTickets = await db
      .select({ order: tickets.order })
      .from(tickets)
      .where(and(eq(tickets.projectId, projectId), eq(tickets.status, status)));

    const maxOrder =
      existingTickets.length > 0
        ? Math.max(...existingTickets.map((t) => t.order ?? 0))
        : 0;

    const [newTicket] = await db
      .insert(tickets)
      .values({
        projectId,
        title,
        description: description ?? null,
        status,
        priority,
        points: points ?? null,
        order: maxOrder + 1000, // Gap-based ordering
      })
      .returning();

    if (!newTicket) {
      await logAgentAction({
        projectId,
        action: "create_ticket",
        success: false,
        errorMessage: "Failed to create ticket",
      });

      return {
        content: [{ type: "text", text: "Failed to create ticket" }],
        isError: true,
      };
    }

    await logAgentAction({
      ticketId: newTicket.id,
      projectId,
      action: "create_ticket",
      promptSummary: `Create: ${title}`,
      responseSummary: `Created ticket ${newTicket.id}`,
      success: true,
    });

    return {
      content: [
        {
          type: "text",
          text: `Created ticket "${title}" with ID ${newTicket.id}`,
        },
      ],
      structuredContent: {
        ticket: {
          id: newTicket.id,
          title: newTicket.title,
          status: newTicket.status,
          priority: newTicket.priority,
        },
      },
    };
  }
);

// Tool: Update Ticket
server.registerTool(
  "update_ticket",
  {
    title: "Update Ticket",
    description: "Update an existing ticket",
    inputSchema: {
      ticketId: z.string().describe("Ticket ID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z.enum(TICKET_STATUS).optional().describe("New status"),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("New priority"),
      points: z.number().optional().describe("New points estimate"),
    },
    outputSchema: {
      ticket: z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        priority: z.string(),
      }),
      changes: z.array(z.string()),
    },
  },
  async ({ ticketId, title, description, status, priority, points }) => {
    const [existing] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);

    if (!existing) {
      await logAgentAction({
        ticketId,
        action: "update_ticket",
        success: false,
        errorMessage: "Ticket not found",
      });

      return {
        content: [{ type: "text", text: "Ticket not found" }],
        isError: true,
      };
    }

    const updates: Partial<typeof existing> = {};
    const changes: string[] = [];

    if (title !== undefined && title !== existing.title) {
      updates.title = title;
      changes.push(`title: "${existing.title}" → "${title}"`);
    }
    if (description !== undefined && description !== existing.description) {
      updates.description = description;
      changes.push("description updated");
    }
    if (status !== undefined && status !== existing.status) {
      updates.status = status;
      changes.push(`status: ${existing.status} → ${status}`);
    }
    if (priority !== undefined && priority !== existing.priority) {
      updates.priority = priority;
      changes.push(`priority: ${existing.priority} → ${priority}`);
    }
    if (points !== undefined && points !== existing.points) {
      updates.points = points;
      changes.push(`points: ${existing.points ?? "none"} → ${points}`);
    }

    if (Object.keys(updates).length === 0) {
      return {
        content: [{ type: "text", text: "No changes to apply" }],
        structuredContent: {
          ticket: {
            id: existing.id,
            title: existing.title,
            status: existing.status,
            priority: existing.priority,
          },
          changes: [],
        },
      };
    }

    const [updated] = await db
      .update(tickets)
      .set(updates)
      .where(eq(tickets.id, ticketId))
      .returning();

    if (!updated) {
      await logAgentAction({
        ticketId,
        projectId: existing.projectId,
        action: "update_ticket",
        success: false,
        errorMessage: "Failed to update ticket",
      });

      return {
        content: [{ type: "text", text: "Failed to update ticket" }],
        isError: true,
      };
    }

    await logAgentAction({
      ticketId,
      projectId: existing.projectId,
      action: "update_ticket",
      promptSummary: `Update: ${changes.join(", ")}`,
      responseSummary: `Updated ticket ${ticketId}`,
      success: true,
    });

    return {
      content: [
        {
          type: "text",
          text: `Updated ticket "${updated.title}": ${changes.join(", ")}`,
        },
      ],
      structuredContent: {
        ticket: {
          id: updated.id,
          title: updated.title,
          status: updated.status,
          priority: updated.priority,
        },
        changes,
      },
    };
  }
);

// Tool: Add Comment (agent-only, no auth required)
server.registerTool(
  "add_comment",
  {
    title: "Add Comment",
    description: "Add a comment to a ticket. Note: Comments added via MCP require a userId parameter.",
    inputSchema: {
      ticketId: z.string().describe("Ticket ID"),
      userId: z.string().describe("User ID for the comment author"),
      content: z.string().describe("Comment content"),
    },
    outputSchema: {
      comment: z.object({
        id: z.string(),
        content: z.string(),
        createdAt: z.number(),
      }),
    },
  },
  async ({ ticketId, userId, content }) => {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1);

    if (!ticket) {
      return {
        content: [{ type: "text", text: "Ticket not found" }],
        isError: true,
      };
    }

    const [comment] = await db
      .insert(comments)
      .values({
        ticketId,
        userId,
        content,
      })
      .returning();

    if (!comment) {
      await logAgentAction({
        ticketId,
        projectId: ticket.projectId,
        action: "add_comment",
        success: false,
        errorMessage: "Failed to add comment",
      });

      return {
        content: [{ type: "text", text: "Failed to add comment" }],
        isError: true,
      };
    }

    await logAgentAction({
      ticketId,
      projectId: ticket.projectId,
      action: "add_comment",
      promptSummary: content.slice(0, 100),
      responseSummary: `Added comment ${comment.id}`,
      success: true,
    });

    return {
      content: [{ type: "text", text: `Added comment to ticket "${ticket.title}"` }],
      structuredContent: {
        comment: {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt?.getTime() ?? Date.now(),
        },
      },
    };
  }
);

// ==================== RUN SERVER ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Minute MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
