import "./env.mjs";
import { raw } from "./pg.mjs";

const count = async (table) => {
  const rows = await raw(`select count(*)::int as n from ${table}`);
  return rows[0].n;
};

console.log("existing data preserved:");
for (const table of ["products", "lots", "stock_movements", "suppliers", "users", "deliveries"]) {
  console.log(`  ${table}: ${await count(table)}`);
}

const tables = (
  await raw("select table_name from information_schema.tables where table_schema = 'public' order by table_name")
).map((row) => row.table_name);

const expected = ["order_request_lines", "order_requests", "order_reservations"];

console.log("\nnew tables created:");
for (const table of expected) {
  console.log(`  ${table}: ${tables.includes(table) ? "present" : "MISSING"}`);
}

console.log("\nall tables:", tables.join(", "));