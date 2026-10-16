import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // Environment variables are optional for this frontend-only demo.
}
