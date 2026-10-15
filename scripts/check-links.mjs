import "./env.mjs";
import { raw, run } from "./pg.mjs";
import { randomBytes } from "node:crypto";

/**
 * Link integrity for an internal system.
 *
 * There is no public site. The root redirects to sign-in and every working page
 * sits behind the session guard, so this suite checks three things instead:
 *   - the root really redirects to login
 *   - no protected route leaks to an anonymous visitor
 *   - once signed in, every screen is reachable and nothing links to a route
 *     that has been removed
 */

const base = process.env.SMOKE_BASE ?? "http://localhost:3000";
const COMMERCE_ENABLED = process.env.NEXT_PUBLIC_COMMERCE === "1";

const results = [];
const record = (label, ok, detail = "") => results.push({ label, ok, detail });

const anon = (path) => fetch(`${base}${path}`, { redirect: "manual" });

const IMS_ROUTES = [
  "/dashboard",
  "/lots",
  "/issue",
  "/catalog",
  "/reports",
  "/reports/periods",
  "/requests",
];

const REMOVED_ROUTES = ["/coffee/pb-hn-250", "/coffee/pb-sgn-250", "/order"];

// ---------------------------------------------------------------- anonymous

const root = await anon("/");
const rootLocation = root.headers.get("location") ?? "";
record(
  "the root redirects to sign-in",
  (root.status === 307 || root.status === 302) && rootLocation.endsWith("/login"),
  `status=${root.status} loc=${rootLocation}`,
);

const login = await anon("/login");
record("the sign-in page is reachable", login.status === 200, `status=${login.status}`);

for (const path of IMS_ROUTES) {
  const response = await anon(path);
  const location = response.headers.get("location") ?? "";
  const guarded =
    (response.status === 307 || response.status === 302) && location.includes("/login");
  record(`${path} is not reachable without signing in`, guarded, `status=${response.status} loc=${location}`);
}

for (const path of REMOVED_ROUTES) {
  const response = await anon(path);
  record(`${path} is gone`, response.status === 404, `status=${response.status}`);
}

if (!COMMERCE_ENABLED) {
  const cart = await anon("/cart");
  record("/cart is gone while commerce is disabled", cart.status === 404, `status=${cart.status}`);
}

// ------------------------------------------------------------ authenticated

const owner = (
  await raw("select id, email from users where email = $1", ["owner@provibeans.ph"])
)[0];

if (!owner) {
  console.error("Seeded users missing. Run `npm run db:seed` first.");
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
await run("insert into sessions (token, user_id, expires_at) values ($1, $2, $3)", [
  token,
  owner.id,
  new Date(Date.now() + 3600_000).toISOString(),
]);

try {
  const seen = new Map();
  const outbound = new Set();

  for (const path of IMS_ROUTES) {
    const response = await fetch(`${base}${path}`, {
      headers: { cookie: `provi_session=${token}` },
      redirect: "manual",
    });
    const html = await response.text();
    seen.set(path, { status: response.status, length: html.length });

    record(
      `${path} renders for a signed-in user`,
      response.status === 200 && html.length > 2000,
      `status=${response.status} bytes=${html.length}`,
    );

    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (href.startsWith("/_next/") || href.startsWith("/images/")) continue;
      outbound.add(href.split("#")[0] || "/");
    }
  }

  const orphans = [...seen.keys()].filter((path) => !outbound.has(path));
  record("every screen is reachable from another screen", orphans.length === 0, orphans.join(", "));

  for (const path of REMOVED_ROUTES) {
    record(
      `nothing links to the removed ${path}`,
      ![...outbound].some((href) => href.startsWith(path)),
      [...outbound].filter((href) => href.startsWith(path)).join(", "),
    );
  }

  const cartLinked = [...outbound].some((href) => href === "/cart");
  record(
    COMMERCE_ENABLED ? "the cart is linked for staff" : "nothing links to the disabled cart",
    COMMERCE_ENABLED ? cartLinked : !cartLinked,
  );
} finally {
  await run("delete from sessions where token = $1", [token]);
}

console.log("Provi Beans - link integrity check");
console.log("====================================");
for (const result of results) {
  const verdict = result.ok ? "PASS" : "FAIL";
  const suffix = result.ok || !result.detail ? "" : `  (${result.detail})`;
  console.log(`  [${verdict}] ${result.label}${suffix}`);
}
const failed = results.filter((result) => !result.ok);
console.log("====================================");
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);