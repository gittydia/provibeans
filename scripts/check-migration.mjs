import Database from "better-sqlite3";

const db = new Database("./data/provi-beans.db", { readonly: true });

const count = (table) => db.prepare(`select count(*) n from ${table}`).get().n;

console.log("existing data preserved:");
for (const table of ["products", "lots", "stock_movements", "suppliers", "users", "deliveries"]) {
  console.log(`  ${table}: ${count(table)}`);
}

const tables = db
  .prepare("select name from sqlite_master where type = 'table' order by name")
  .all()
  .map((row) => row.name);

const expected = ["order_request_lines", "order_requests", "order_reservations"];

console.log("\nnew tables created:");
for (const table of expected) {
  console.log(`  ${table}: ${tables.includes(table) ? "present" : "MISSING"}`);
}

console.log("\nall tables:", tables.join(", "));