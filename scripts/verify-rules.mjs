import "./env.mjs";
import { raw, run } from "./pg.mjs";

const today = new Date().toISOString().slice(0, 10);

async function cleanup() {
  await run(
    "delete from stock_movements where lot_id in (select id from lots where code like 'LOT-RULECHECK%' or code like 'LOT-BAD-%')",
  );
  await run("delete from lots where code like 'LOT-RULECHECK%' or code like 'LOT-BAD-%'");
  await run("delete from products where sku like 'PB-RULECHECK%'");
  await run("delete from suppliers where name = $1", ["Rule Check Supplier"]);
}

await cleanup();

const productRows = await raw(
  "insert into products (sku, name, weight_grams, unit_price) values ($1,$2,$3,$4) returning id",
  ["PB-RULECHECK", "Rule Check Product", 250, 10],
);
const productId = productRows[0].id;

const lotRows = await raw(
  "insert into lots (code, product_id, received_at, best_before_date, expiry_date) values ($1,$2,$3,$4,$5) returning id",
  ["LOT-RULECHECK", productId, today, "2099-01-01", "2099-06-01"],
);
const lotId = lotRows[0].id;

const results = [];

const check = async (label, expectBlocked, fn) => {
  let blocked = false;
  try {
    await fn();
  } catch {
    blocked = true;
  }
  results.push({ label, expectBlocked, blocked, ok: blocked === expectBlocked });
};

await check("expiry earlier than best-before", true, () =>
  run("insert into lots (code, product_id, received_at, best_before_date, expiry_date) values ($1,$2,$3,$4,$5)", [
    "LOT-BAD-1",
    productId,
    today,
    "2099-06-01",
    "2099-01-01",
  ]),
);

await check("expiry earlier than receipt", true, () =>
  run("insert into lots (code, product_id, received_at, expiry_date) values ($1,$2,$3,$4)", [
    "LOT-BAD-2",
    productId,
    today,
    "2000-01-01",
  ]),
);

await check("duplicate SKU", true, () =>
  run("insert into products (sku, name, weight_grams, unit_price) values ($1,$2,$3,$4)", [
    "PB-RULECHECK",
    "Duplicate",
    250,
    10,
  ]),
);

await check("duplicate lot code", true, () =>
  run("insert into lots (code, product_id, received_at) values ($1,$2,$3)", ["LOT-RULECHECK", productId, today]),
);

await check("zero-quantity movement", true, () =>
  run("insert into stock_movements (lot_id, product_id, type, quantity) values ($1,$2,$3,$4)", [
    lotId,
    productId,
    "ISSUE",
    0,
  ]),
);

await check("negative product weight", true, () =>
  run("insert into products (sku, name, weight_grams, unit_price) values ($1,$2,$3,$4)", [
    "PB-RULECHECK-NEG",
    "Negative",
    -5,
    10,
  ]),
);

await check("negative unit price", true, () =>
  run("insert into products (sku, name, weight_grams, unit_price) values ($1,$2,$3,$4)", [
    "PB-RULECHECK-NEGP",
    "Negative price",
    250,
    -1,
  ]),
);

await check("lot pointing at missing product", true, () =>
  run("insert into lots (code, product_id, received_at) values ($1,$2,$3)", ["LOT-BAD-FK", 999999, today]),
);

await check("movement pointing at missing lot", true, () =>
  run("insert into stock_movements (lot_id, product_id, type, quantity) values ($1,$2,$3,$4)", [
    999999,
    productId,
    "ISSUE",
    5,
  ]),
);

await check("valid lot", false, async () => {
  const row = (
    await raw("select code, status, best_before_date, expiry_date from lots where code = $1", ["LOT-RULECHECK"])
  )[0];
  if (!row) throw new Error("valid lot was not stored");
});

await cleanup();

console.log("Provi Beans - database rule verification");
console.log("=======================================");
for (const result of results) {
  const verdict = result.ok ? "PASS" : "FAIL";
  const behaviour = result.blocked ? "blocked" : "allowed";
  const expected = result.expectBlocked ? "blocked" : "allowed";
  console.log(`  [${verdict}] ${result.label.padEnd(38)} expected ${expected}, got ${behaviour}`);
}

const failed = results.filter((result) => !result.ok);
console.log("=======================================");
console.log(`${results.length - failed.length}/${results.length} rules verified`);
process.exit(failed.length === 0 ? 0 : 1);