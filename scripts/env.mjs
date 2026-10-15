import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // No .env.local — assume DATABASE_URL is already in the environment
  // (CI, Vercel, or an explicit shell export).
}