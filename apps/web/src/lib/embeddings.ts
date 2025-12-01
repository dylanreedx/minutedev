import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { createHash } from "crypto";

// Configuration
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// Generate content hash for deduplication
export function hashContent(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

// Generate embedding for a single text
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  
  return embedding;
}

// Generate embeddings for multiple texts
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding(EMBEDDING_MODEL),
    values: texts,
  });
  
  return embeddings;
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  
  if (a.length === 0) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

// Find most similar embeddings from a list
export function findSimilar<T extends { embedding: number[] }>(
  query: number[],
  candidates: T[],
  options: { limit?: number; threshold?: number } = {}
): Array<T & { similarity: number }> {
  const { limit = 10, threshold = 0.5 } = options;
  
  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      similarity: cosineSimilarity(query, candidate.embedding),
    }))
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
  
  return scored;
}

// Prepare ticket content for embedding
export function prepareTicketContent(ticket: {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
}): string {
  const parts = [ticket.title];
  
  if (ticket.description) {
    // Strip HTML tags if description is rich text
    const plainDescription = ticket.description.replace(/<[^>]*>/g, " ").trim();
    if (plainDescription) {
      parts.push(plainDescription);
    }
  }
  
  // Include metadata for better semantic matching
  if (ticket.status) {
    parts.push(`Status: ${ticket.status}`);
  }
  if (ticket.priority) {
    parts.push(`Priority: ${ticket.priority}`);
  }
  
  return parts.join("\n\n");
}

// Export config for use elsewhere
export const embeddingConfig = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
};

