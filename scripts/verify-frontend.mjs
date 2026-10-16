import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const failures = [];

function check(label, condition, detail = "") {
  if (!condition) failures.push({ label, detail });
  console.log(`  [${condition ? "PASS" : "FAIL"}] ${label}${condition || !detail ? "" : ` (${detail})`}`);
}

async function exists(relativePath) {
  try {
    await readFile(path.join(root, relativePath));
    return true;
  } catch {
    try {
      await readdir(path.join(root, relativePath));
      return true;
    } catch {
      return false;
    }
  }
}

async function sourceFiles(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(relativePath)));
    else if (/\.(?:js|jsx|mjs|mts|ts|tsx)$/.test(entry.name)) files.push(relativePath);
  }

  return files;
}

console.log("Provi Beans - frontend architecture check");
console.log("=========================================");

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const packages = { ...packageJson.dependencies, ...packageJson.devDependencies };
const forbiddenPackages = ["@neondatabase/serverless", "drizzle-kit", "drizzle-orm", "pg", "postgres"];
const installedDatabasePackages = forbiddenPackages.filter((name) => name in packages);
check(
  "package metadata has no database runtime or migration tooling",
  installedDatabasePackages.length === 0,
  installedDatabasePackages.join(", "),
);

const databaseScripts = Object.keys(packageJson.scripts ?? {}).filter((name) => name.startsWith("db:"));
check("package scripts expose no database commands", databaseScripts.length === 0, databaseScripts.join(", "));

const removedPaths = [
  "drizzle.config.ts",
  "drizzle/0000_neon_pg.sql",
  "drizzle/0001_eminent_wallow.sql",
  "drizzle/meta/0000_snapshot.json",
  "drizzle/meta/0001_snapshot.json",
  "drizzle/meta/_journal.json",
  "lib/db/index.ts",
  "lib/db/schema.ts",
  "lib/db/seed.ts",
];
const presentDatabasePaths = [];
for (const relativePath of removedPaths) {
  if (await exists(relativePath)) presentDatabasePaths.push(relativePath);
}
check("database configuration, migrations, and modules are absent", presentDatabasePaths.length === 0, presentDatabasePaths.join(", "));

const obsoleteVerificationFiles = [
  "scripts/pg.mjs",
  "scripts/verify-rules.mjs",
  "scripts/verify-inventory.mts",
  "scripts/verify-notifications.mts",
  "scripts/verify-periods.mts",
  "scripts/smoke.mjs",
  "scripts/check-links.mjs",
  "scripts/smoke-cart.mjs",
  "scripts/list-accounts.mjs",
  "scripts/check-migration.mjs",
];
const presentVerificationFiles = [];
for (const relativePath of obsoleteVerificationFiles) {
  if (await exists(relativePath)) presentVerificationFiles.push(relativePath);
}
check("database-backed verification scripts are absent", presentVerificationFiles.length === 0, presentVerificationFiles.join(", "));

const applicationFiles = [...(await sourceFiles("app")), ...(await sourceFiles("lib"))];
const forbiddenSource = /(?:@neondatabase\/serverless|drizzle-orm|@\/lib\/db|DATABASE_URL)/;
const databaseSourceMatches = [];
const serverOnlyMatches = [];
for (const relativePath of applicationFiles) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  if (forbiddenSource.test(source)) databaseSourceMatches.push(relativePath);
  if (/(?:^|[\\/])route\.(?:js|ts)$/.test(relativePath) || /^\s*["']use server["'];/m.test(source)) {
    serverOnlyMatches.push(relativePath);
  }
}
check("application source has no database imports or connection variables", databaseSourceMatches.length === 0, databaseSourceMatches.join(", "));
check("application source has no route handlers or server actions", serverOnlyMatches.length === 0, serverOnlyMatches.join(", "));

const browserStateFiles = [];
for (const relativePath of applicationFiles) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  if (/\b(?:localStorage|sessionStorage)\b/.test(source)) browserStateFiles.push(relativePath);
}
check("browser-local persistence is present", browserStateFiles.length > 0, "no localStorage or sessionStorage usage found");

console.log("=========================================");
console.log(`${7 - failures.length}/7 checks passed`);
process.exit(failures.length === 0 ? 0 : 1);
