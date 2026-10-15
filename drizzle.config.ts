import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js and does not load .env.local on its own.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local — DATABASE_URL must come from the environment.
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});