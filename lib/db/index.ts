import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { proviSqlite?: Database.Database };

function createConnection() {
  const file = process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "provi-beans.db");
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export const sqlite = globalForDb.proviSqlite ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.proviSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });

export async function ensureSchema() {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

export { schema };
export { sql };