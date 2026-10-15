import Database from "better-sqlite3";

const base = process.env.SMOKE_BASE ?? "http://localhost:3000";
const dbFile = process.env.DATABASE_FILE ?? "./data/provi-beans.db";

// Cart and checkout are outside the Chapter I scope and switched off by default
// (lib/features.ts). Skip rather than fail, so `verify:all` stays green while the
// feature is hidden. Run with NEXT_PUBLIC_COMMERCE=1 to exercise it.
if (process.env.NEXT_PUBLIC_COMMERCE !== "1") {
  console.log("Provi Beans - cart end-to-end suite");
  console.log("====================================");
  console.log("  SKIPPED: commerce is disabled (NEXT_PUBLIC_COMMERCE is not 1).");
  console.log("  Re-run with NEXT_PUBLIC_COMMERCE=1 and a server started with the");
  console.log("  same variable to verify the cart flow.");
  process.exit(0);
}

const db = new Database(dbFile);

const results = [];
const record = (label, ok, detail = "") => results.push({ label, ok, detail });

function formHtmlByPrefix(html, prefix) {
  const pattern = new RegExp(`<form[^>]*data-form="${prefix}[^"]*"[^>]*>([\\s\\S]*?)</form>`);
  const match = html.match(pattern);
  return match ? match[1] : "";
}

function hiddenFields(scope) {
  const hidden = {};
  for (const match of scope.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const tag = match[0];
    const name = tag.match(/name="([^"]+)"/)?.[1];
    const value = tag.match(/value="([^"]*)"/)?.[1] ?? "";
    if (name) hidden[name] = value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  }
  return hidden;
}

function postActionForm(scope, fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(hiddenFields(scope))) form.append(key, value);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

// Clean slate so counts are deterministic.
db.prepare("delete from cart_items").run();
db.prepare("delete from carts").run();

const detail = await fetch(`${base}/coffee/pb-hn-250`);
const detailBody = await detail.text();
record("product detail page renders", detail.status === 200, `status=${detail.status}`);
record("detail page shows the SKU", detailBody.includes("PB-HN-250"));
record("detail page shows an add-to-cart form", detailBody.includes("Add to cart"));
record("detail page lists issuable lots", detailBody.includes("Expires"));
record("unknown product 404s", (await fetch(`${base}/coffee/does-not-exist`)).status === 404);

const cartEmpty = await fetch(`${base}/cart`);
const cartEmptyBody = await cartEmpty.text();
record("cart page renders when empty", cartEmpty.status === 200 && cartEmptyBody.includes("Your cart is empty"));

// Add to cart, carrying the cart cookie the server issues.
const addForm = formHtmlByPrefix(detailBody, "add-to-cart-");
record("add-to-cart form is addressable", addForm.length > 0, `len=${addForm.length}`);

// The product id comes from the form itself, never assumed.
const cartProductId = hiddenFields(addForm).productId;
record("the form carries its own product id", Boolean(cartProductId), `productId=${cartProductId}`);

const addResponse = await fetch(`${base}/coffee/pb-hn-250`, {
  method: "POST",
  body: postActionForm(addForm, { quantity: "3" }),
  redirect: "manual",
});

const cartCookie = addResponse.headers.get("set-cookie") ?? "";
record(
  "adding to cart issues a cart cookie",
  cartCookie.includes("provi_cart="),
  cartCookie.slice(0, 50),
);

const cartToken = cartCookie.match(/provi_cart=([^;]+)/)?.[1];
const withCart = (path) =>
  fetch(`${base}${path}`, { headers: cartToken ? { cookie: `provi_cart=${cartToken}` } : {} });

const filledCart = await withCart("/cart");
const filledBody = await filledCart.text();
record("cart shows the added product", filledBody.includes("PB-HN-250"), `status=${filledCart.status}`);
record("cart shows a subtotal", filledBody.includes("Subtotal"));
record("cart offers checkout", filledBody.includes("Place order request"));

const stored = db.prepare("select count(*) n from cart_items").get();
record("the cart persisted to the database", stored.n === 1, `rows=${stored.n}`);

const beforeOrders = db.prepare("select count(*) n from order_requests").get().n;

const checkoutHtml = await (await withCart("/cart")).text();
const checkoutForm = formHtmlByPrefix(checkoutHtml, "checkout");
record("checkout form is addressable", checkoutForm.length > 0, `len=${checkoutForm.length}`);

const checkoutResponse = await fetch(`${base}/cart`, {
  method: "POST",
  headers: cartToken ? { cookie: `provi_cart=${cartToken}` } : {},
  body: postActionForm(checkoutForm, {
    customerName: "Cart Smoke Test",
    email: "cart@smoke.test",
    business: "Smoke Cafe",
  }),
  redirect: "manual",
});

const checkoutBody = await checkoutResponse.text();
record(
  "checkout creates an order request",
  checkoutBody.includes("ORD-"),
  `status=${checkoutResponse.status}`,
);

const afterOrders = db.prepare("select count(*) n from order_requests").get().n;
record("an order row was written", afterOrders === beforeOrders + 1, `before=${beforeOrders} after=${afterOrders}`);

const reservedMovements = db
  .prepare("select count(*) n from stock_movements where type = 'RESERVE' and reference like 'ORD-%'")
  .get().n;
record("checkout reserved real stock", reservedMovements >= 1, `reservations=${reservedMovements}`);

const emptied = db.prepare("select count(*) n from cart_items").get().n;
record("the cart is emptied after checkout", emptied === 0, `rows=${emptied}`);

// Clean up the order we just created so repeat runs stay deterministic.
const ref = checkoutBody.match(/ORD-\d{4}-\d{4}/)?.[0];
if (ref) {
  const request = db.prepare("select id from order_requests where reference = ?").get(ref);
  if (request) {
    for (const line of db
      .prepare("select id from order_request_lines where order_request_id = ?")
      .all(request.id)) {
      db.prepare("delete from order_reservations where order_request_line_id = ?").run(line.id);
      db.prepare("delete from stock_movements where reference = ?").run(ref);
    }
    db.prepare("delete from order_request_lines where order_request_id = ?").run(request.id);
    db.prepare("delete from audit_logs where entity_id = ?").run(ref);
    db.prepare("delete from order_requests where id = ?").run(request.id);
  }
}

db.prepare("delete from cart_items").run();
db.prepare("delete from carts").run();

console.log("Provi Beans - cart and checkout smoke test");
console.log("===========================================");
for (const result of results) {
  const verdict = result.ok ? "PASS" : "FAIL";
  const suffix = result.ok || !result.detail ? "" : `  (${result.detail})`;
  console.log(`  [${verdict}] ${result.label}${suffix}`);
}
const failed = results.filter((result) => !result.ok);
console.log("===========================================");
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);