import "./env.mjs";
import { raw } from "./pg.mjs";

/**
 * Link integrity: crawls the public site and fails on exactly the defect that
 * shipped twice — a page that renders perfectly but nothing links to it.
 */

const base = process.env.SMOKE_BASE ?? "http://localhost:3000";

const results = [];
const record = (label, ok, detail = "") => results.push({ label, ok, detail });

function isPageLink(href) {
  if (!href.startsWith("/")) return false;
  if (href.startsWith("/_next/")) return false;
  if (href.startsWith("/images/")) return false;
  return true;
}

function normalise(href) {
  const withoutHash = href.split("#")[0];
  return withoutHash || "/";
}

const rows = await raw("select sku from products where is_active = true");
const catalogueSlugs = () =>
  rows.map((row) =>
    row.sku
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
  );

const expected = new Set(["/", "/login"]);

// Cart and checkout sit outside the Chapter I scope (see lib/features.ts), so
// while the flag is off the route is expected to be absent rather than linked.
const COMMERCE_ENABLED = process.env.NEXT_PUBLIC_COMMERCE === "1";
if (COMMERCE_ENABLED) expected.add("/cart");

const discovered = new Map();
const inbound = new Map();
const queue = ["/"];
const queued = new Set(["/"]);

while (queue.length > 0) {
  const path = queue.shift();
  const response = await fetch(`${base}${path}`, { redirect: "manual" });

  if (response.status >= 400) {
    discovered.set(path, response.status);
    continue;
  }

  const location = response.headers.get("location");
  if (location === "/login") {
    discovered.set(path, "guarded");
    continue;
  }

  const html = await response.text();
  discovered.set(path, response.status);

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const raw = match[1];
    if (!isPageLink(raw)) continue;

    const target = normalise(raw);
    if (!inbound.has(target)) inbound.set(target, new Set());
    inbound.get(target).add(path);

    if (!queued.has(target)) {
      queued.add(target);
      queue.push(target);
    }
  }
}

// Every product should expose a detail page, and the site should link to it.
for (const slug of catalogueSlugs()) {
  const path = `/coffee/${slug}`;
  if (!queued.has(path)) {
    queued.add(path);
    queue.push(path);
    const response = await fetch(`${base}${path}`, { redirect: "manual" });
    discovered.set(path, response.status);
  }
}

const orphans = [];
for (const path of discovered.keys()) {
  if (path === "/") continue;
  if (discovered.get(path) === "guarded") continue;
  const sources = inbound.get(path);
  if (!sources || sources.size === 0) orphans.push(path);
}

record(
  "no public page is an orphan",
  orphans.length === 0,
  orphans.length > 0 ? `unreachable: ${orphans.join(", ")}` : "",
);

const deadLinks = [];
for (const [target, sources] of inbound.entries()) {
  const status = discovered.get(target);
  if (status === undefined || (typeof status === "number" && status >= 400)) {
    deadLinks.push(`${target} (from ${[...sources].join(", ")})`);
  }
}

record(
  "no link points at a missing page",
  deadLinks.length === 0,
  deadLinks.length > 0 ? deadLinks.join(" | ") : "",
);

for (const path of expected) {
  const sources = inbound.get(path);
  record(
    `${path} is linked from the public site`,
    Boolean(sources && sources.size > 0),
    sources ? `from ${[...sources].join(", ")}` : "never linked",
  );
}

for (const slug of catalogueSlugs()) {
  const path = `/coffee/${slug}`;
  const sources = inbound.get(path);
  record(
    `product page ${path} is linked from the collection`,
    Boolean(sources && sources.size > 0),
    sources ? `from ${[...sources].join(", ")}` : "never linked",
  );
}

const home = await (await fetch(`${base}/`)).text();
record(
  "every product card links to its detail page",
  catalogueSlugs().every((slug) => home.includes(`/coffee/${slug}`)),
);

if (COMMERCE_ENABLED) {
  record("the cart is reachable from the public site", home.includes('href="/cart"'));
  record("staff sign-in is reachable from the public site", home.includes('href="/login"'));

  const cartPage = await (await fetch(`${base}/cart`)).text();
  record(
    "the cart page offers a route back to the shop",
    cartPage.includes('href="/"') || cartPage.includes("/#collection"),
  );
} else {
  // The guard's real job now: prove the out-of-scope feature is genuinely gone.
  record("no page links to /cart while commerce is disabled", !home.includes('href="/cart"'));

  const cartStatus = (await fetch(`${base}/cart`, { redirect: "manual" })).status;
  record(
    "/cart returns 404 while commerce is disabled",
    cartStatus === 404,
    `got ${cartStatus}`,
  );

  const detail = await (await fetch(`${base}/coffee/${catalogueSlugs()[0]}`)).text();
  record("no product page offers add-to-cart", !detail.includes("Add to cart"));
  record("staff sign-in is reachable from the public site", home.includes('href="/login"'));
}

// The /order route was removed with the enquiry form. Nothing may link to it, and
// it must not quietly return.
const orderStatus = (await fetch(`${base}/order`, { redirect: "manual" })).status;
record(
  "/order is gone and nothing links to it",
  orderStatus === 404 && !home.includes('href="/order"'),
  `status=${orderStatus} stillLinked=${home.includes('href="/order"')}`,
);
record("no public page mentions an enquiry channel", !home.includes("/order"));

const anchors = [...home.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
const anchorTargets = [...home.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const brokenAnchors = [...new Set(anchors)].filter(
  (anchor) => !anchorTargets.includes(anchor),
);
record(
  "every in-page anchor resolves to a section",
  brokenAnchors.length === 0,
  brokenAnchors.length > 0 ? `missing: ${brokenAnchors.join(", ")}` : "",
);

console.log("Provi Beans - link integrity check");
console.log("====================================");
console.log(`  crawled ${discovered.size} pages from ${base}`);
for (const [path, status] of [...discovered.entries()].sort()) {
  const links = inbound.get(path)?.size ?? 0;
  console.log(`    ${String(status).padEnd(8)} ${path}  (${links} inbound)`);
}
console.log("------------------------------------");
for (const result of results) {
  const verdict = result.ok ? "PASS" : "FAIL";
  const suffix = result.ok || !result.detail ? "" : `  (${result.detail})`;
  console.log(`  [${verdict}] ${result.label}${suffix}`);
}
const failed = results.filter((result) => !result.ok);
console.log("====================================");
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);