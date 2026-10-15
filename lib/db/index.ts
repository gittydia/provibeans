import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Next.js loads .env.local for the app, but the seed and verification suites run
// under plain tsx and would otherwise find no DATABASE_URL. Never override a URL
// that is already set, so CI and Vercel keep their injected value.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local — DATABASE_URL must come from the environment.
  }
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Neon connection string (see .env.example).",
    );
  }
  return url;
}

// The WebSocket pool is used rather than the plain HTTP driver because the HTTP
// driver exposes no `transaction()`. Issuing stock, holding reservations and
// reversing movements all need real rollback, so those operations must be atomic.
const globalForDb = globalThis as unknown as { proviPool?: Pool };

export const pool =
  globalForDb.proviPool ?? new Pool({ connectionString: connectionString() });

if (process.env.NODE_ENV !== "production") {
  globalForDb.proviPool = pool;
}

export const db = drizzle(pool, { schema });

export async function ensureSchema() {
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  const path = await import("node:path");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

/** Raw parameterised SQL for the verification suites. Postgres placeholders are `$1..$n`. */
export async function raw<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(query, params);
  return result.rows as T[];
}

export { schema };