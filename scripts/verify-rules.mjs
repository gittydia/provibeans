import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_FILE ?? "./data/provi-beans.db");
db.pragma("foreign_keys = ON");

const today = new Date().toISOString().slice(0, 10);

function cleanup() {
  db.prepare(
    "delete from stock_movements where lot_id in (select id from lots where code like 'LOT-RULECHECK%' or code like 'LOT-BAD-%')",
  ).run();
  db.prepare("delete from lots where code like 'LOT-RULECHECK%' or code like 'LOT-BAD-%'").run();
  db.prepare("delete from products where sku like 'PB-RULECHECK%'").run();
  db.prepare("delete from suppliers where name = ?").run("Rule Check Supplier");
}

cleanup();

const productId = db
  .prepare("insert into products (sku, name, weight_grams, unit_price) values (?, ?, ?, ?)").run(
    "PB-RULECHECK",
    "Rule Check Product",
    250,
    10,
  ).lastInsertRowid;

const lotId = db
  .prepare(
    "insert into lots (code, product_id, received_at, best_before_date, expiry_date) values (?, ?, ?, ?, ?)",
  )
  .run("LOT-RULECHECK", productId, today, "2099-01-01", "2099-06-01").lastInsertRowid;

const results = [];

const check = (label, expectBlocked, fn) => {
  let blocked = false;
  try {
    fn();
  } catch {
    blocked = true;
  }
  results.push({ label, expectBlocked, blocked, ok: blocked === expectBlocked });
};

check("expiry earlier than best-before", true, () =>
  db
    .prepare(
      "insert into lots (code, product_id, received_at, best_before_date, expiry_date) values (?, ?, ?, ?, ?)",
    )
    .run("LOT-BAD-1", productId, today, "2099-06-01", "2099-01-01"),
);

check("expiry earlier than receipt", true, () =>
  db
    .prepare("insert into lots (code, product_id, received_at, expiry_date) values (?, ?, ?, ?)")
    .run("LOT-BAD-2", productId, today, "2000-01-01"),
);

check("duplicate SKU", true, () =>
  db
    .prepare("insert into products (sku, name, weight_grams, unit_price) values (?, ?, ?, ?)")
    .run("PB-RULECHECK", "Duplicate", 250, 10),
);

check("duplicate lot code", true, () =>
  db
    .prepare("insert into lots (code, product_id, received_at) values (?, ?, ?)")
    .run("LOT-RULECHECK", productId, today),
);

check("zero-quantity movement", true, () =>
  db
    .prepare("insert into stock_movements (lot_id, product_id, type, quantity) values (?, ?, ?, ?)")
    .run(lotId, productId, "ISSUE", 0),
);

check("negative product weight", true, () =>
  db
    .prepare("insert into products (sku, name, weight_grams, unit_price) values (?, ?, ?, ?)")
    .run("PB-RULECHECK-NEG", "Negative", -5, 10),
);

check("negative unit price", true, () =>
  db
    .prepare("insert into products (sku, name, weight_grams, unit_price) values (?, ?, ?, ?)")
    .run("PB-RULECHECK-NEGP", "Negative price", 250, -1),
);

check("lot pointing at missing product", true, () =>
  db
    .prepare("insert into lots (code, product_id, received_at) values (?, ?, ?)")
    .run("LOT-BAD-FK", 999999, today),
);

check("movement pointing at missing lot", true, () =>
  db
    .prepare("insert into stock_movements (lot_id, product_id, type, quantity) values (?, ?, ?, ?)")
    .run(999999, productId, "ISSUE", 5),
);

check("valid lot", false, () => {
  const row = db
    .prepare("select code, status, best_before_date, expiry_date from lots where code = ?")
    .get("LOT-RULECHECK");
  if (!row) throw new Error("valid lot was not stored");
});

cleanup();

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