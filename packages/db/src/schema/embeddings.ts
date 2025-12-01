import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, real } from 'drizzle-orm/sqlite-core';
import { tickets } from './tickets';
import { projects } from './projects';

/**
 * Embeddings table for storing vector embeddings
 * 
 * Note: This uses JSON storage for embeddings since sqlite-vec
 * is experimental in Turso. For production, consider migrating
 * to Pinecone, Weaviate, or waiting for native Turso vector support.
 * 
 * Embedding dimensions:
 * - OpenAI text-embedding-3-small: 1536 dimensions
 * - OpenAI text-embedding-3-large: 3072 dimensions (configurable)
 */
export const embeddings = sqliteTable(
  'embeddings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // What entity this embedding is for
    entityType: text('entity_type', { enum: ['ticket', 'project', 'comment'] }).notNull(),
    entityId: text('entity_id').notNull(),
    // The content that was embedded
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(), // MD5/SHA of content for dedup
    // Embedding vector stored as JSON array
    // Using JSON since Turso doesn't have native vector support yet
    embedding: text('embedding', { mode: 'json' }).$type<number[]>().notNull(),
    // Embedding metadata
    model: text('model').notNull().default('text-embedding-3-small'),
    dimensions: integer('dimensions').notNull().default(1536),
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    entityIdx: index('embeddings_entity_idx').on(table.entityType, table.entityId),
    contentHashIdx: index('embeddings_content_hash_idx').on(table.contentHash),
  })
);

// Type exports
export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;

/**
 * Agent action logs for tracking AI agent activities
 * 
 * This is the foundation for:
 * - Debugging AI agent behavior
 * - Learning from patterns
 * - Building predictive workflows
 */
export const agentActions = sqliteTable(
  'agent_actions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // What entity this action relates to
    ticketId: text('ticket_id').references(() => tickets.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    // Agent identification
    agentType: text('agent_type').notNull(), // 'cursor', 'claude', 'custom', etc.
    agentSessionId: text('agent_session_id'), // Group actions by session
    // Action details
    action: text('action').notNull(), // 'create_ticket', 'update_ticket', 'search', etc.
    promptSummary: text('prompt_summary'), // Truncated/summarized prompt
    responseSummary: text('response_summary'), // Truncated/summarized response
    // Resource usage
    tokensUsed: integer('tokens_used'),
    model: text('model'), // 'gpt-4', 'claude-3', etc.
    durationMs: integer('duration_ms'),
    // Full context (for debugging) - stored as JSON
    context: text('context', { mode: 'json' }).$type<Record<string, unknown>>(),
    // Outcome
    success: integer('success', { mode: 'boolean' }).notNull().default(true),
    errorMessage: text('error_message'),
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    ticketIdx: index('agent_actions_ticket_idx').on(table.ticketId),
    projectIdx: index('agent_actions_project_idx').on(table.projectId),
    agentIdx: index('agent_actions_agent_idx').on(table.agentType, table.agentSessionId),
    actionIdx: index('agent_actions_action_idx').on(table.action),
    createdIdx: index('agent_actions_created_idx').on(table.createdAt),
  })
);

// Type exports
export type AgentAction = typeof agentActions.$inferSelect;
export type NewAgentAction = typeof agentActions.$inferInsert;


