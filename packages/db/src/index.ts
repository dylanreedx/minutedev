import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

let client: Client | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error("TURSO_DATABASE_URL environment variable is not set");
    }
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getClient(), { schema });
  }
  return dbInstance;
}

// Export getClient for direct database access
export { getClient };

// For backwards compatibility - lazy getter
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  },
});

export * from "./schema";
export type { schema };

// Re-export drizzle-orm operators to avoid version mismatch issues
export { eq, and, or, not, gt, gte, lt, lte, ne, isNull, isNotNull, inArray, notInArray, exists, notExists, between, notBetween, like, notLike, ilike, notIlike, sql, asc, desc, max, min, sum, count, avg } from "drizzle-orm";

