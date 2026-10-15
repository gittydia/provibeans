import "./env.mjs";
import { Pool } from "@neondatabase/serverless";

const globalForDb = globalThis;

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  return url;
}

export const pool = globalForDb.proviPool ?? new Pool({ connectionString: connectionString() });

if (process.env.NODE_ENV !== "production") {
  globalForDb.proviPool = pool;
}

/** Parameterised raw SQL. Postgres placeholders are `$1..$n`. */
export async function raw(query, params = []) {
  const result = await pool.query(query, params);
  return result.rows;
}

/** Runs a statement and returns the affected row count. */
export async function run(query, params = []) {
  const result = await pool.query(query, params);
  return result.rowCount ?? 0;
}