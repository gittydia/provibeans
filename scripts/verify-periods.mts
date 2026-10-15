export {};

process.env.DATABASE_FILE ??= "./data/verify.db";

const [
  { eq },
  { db, sqlite, ensureSchema },
  schema,
  { hashPassword },
  periods,
  ledger,
] = await Promise.all([
  import("drizzle-orm"),
  import("@/lib/db"),
  import("@/lib/db/schema"),
  import("@/lib/auth/password"),
  import("@/lib/inventory/periods"),
  import("@/lib/inventory/ledger"),
]);

const { lots, movements, products, suppliers, users } = schema;
const { resolvePeriod, shiftPeriod, buildPeriodReport, switchAnchor } = periods;
const { productSummaries } = ledger;

await ensureSchema();

for (const table of [
  "stock_movements",
  "lots",
  "deliveries",
  "products",
  "suppliers",
  "sessions",
  "users",
]) {
  sqlite.prepare(`delete from ${table}`).run();
}

const results: { label: string; ok: boolean; detail: string }[] = [];
function expect(label: string, condition: boolean, detail = "") {
  results.push({ label, ok: condition, detail });
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

// ---------------------------------------------------------------- boundaries

const jan1 = utc(2026, 0, 1);
const week = resolvePeriod("week", jan1);
expect("week starts on a Monday", week.start.getUTCDay() === 1, week.start.toISOString());
expect("week containing 1 Jan 2026 begins 29 Dec 2025", week.start.toISOString().slice(0, 10) === "2025-12-29", week.start.toISOString());
expect("that week is ISO week 1 of 2026", week.key === "2026-W01", week.key);
expect("week ends on Sunday", week.end.getUTCDay() === 0, week.end.toISOString());
expect("week spans exactly 7 days inclusive", week.end.getTime() - week.start.getTime() === 7 * 86_400_000 - 1, String(week.end.getTime() - week.start.getTime()));
expect("week contains its anchor", week.start <= jan1 && jan1 <= week.end);

// The classic ISO edge: 1 Jan can belong to week 52/53 of the PREVIOUS ISO year.
const jan1_2021 = utc(2021, 0, 1);
const week2021 = resolvePeriod("week", jan1_2021);
expect("1 Jan 2021 belongs to ISO week 53 of 2020", week2021.key === "2020-W53", week2021.key);
expect("that week starts Mon 28 Dec 2020", week2021.start.toISOString().slice(0, 10) === "2020-12-28", week2021.start.toISOString());

// Leap day must land in 29 February, not 1 March.
const leap = resolvePeriod("month", utc(2028, 1, 15));
expect("February 2028 has 29 days", leap.end.getUTCDate() === 29, leap.end.toISOString());
expect("February ends at the last millisecond", leap.end.getUTCHours() === 23 && leap.end.getUTCMilliseconds() === 999, leap.end.toISOString());
expect("non-leap February has 28 days", resolvePeriod("month", utc(2027, 1, 15)).end.getUTCDate() === 28);

const december = resolvePeriod("month", utc(2026, 11, 20));
expect("December ends on the 31st", december.end.getUTCDate() === 31, december.end.toISOString());
expect("December does not roll into January", december.end.getUTCMonth() === 11, december.end.toISOString());

const year = resolvePeriod("year", utc(2026, 5, 9));
expect("year starts 1 January", year.start.toISOString() === "2026-01-01T00:00:00.000Z", year.start.toISOString());
expect("year ends 31 December", year.end.toISOString().slice(0, 10) === "2026-12-31", year.end.toISOString());
expect("2026 is not a leap year", year.end.getUTCDate() === 31);

// Contiguity: consecutive periods must abut exactly, with no gap or overlap.
for (const [granularity, anchor] of [
  ["week", utc(2026, 0, 15)] as const,
  ["month", utc(2026, 0, 15)] as const,
  ["year", utc(2026, 0, 15)] as const,
]) {
  const base = resolvePeriod(granularity, anchor);
  const next = shiftPeriod(base, 1);
  const previous = shiftPeriod(base, -1);
  expect(`${granularity}: next period starts the ms after this one ends`, next.start.getTime() === base.end.getTime() + 1, `${base.end.toISOString()} -> ${next.start.toISOString()}`);
  expect(`${granularity}: this period starts the ms after the previous ends`, base.start.getTime() === previous.end.getTime() + 1);
  expect(`${granularity}: periods never overlap`, previous.end.getTime() < base.start.getTime());
}

// December must roll the year forward cleanly.
const dec2026 = resolvePeriod("month", utc(2026, 11, 10));
expect("stepping past December lands in January 2027", shiftPeriod(dec2026, 1).key === "2027-01", shiftPeriod(dec2026, 1).key);

// ---------------------------------------------------------------- aggregation

const [admin] = await db.insert(users).values({
  email: "periods@test.local",
  name: "Period Tester",
  passwordHash: await hashPassword("ProviBeans2026"),
  role: "ADMIN",
}).returning();

const [coop] = await db.insert(suppliers).values({ name: "Periods Cooperative" }).returning();

const [coffee] = await db.insert(products).values({
  sku: "PERIOD-250",
  name: "Period Test Coffee",
  originCountry: "Vietnam",
  weightGrams: 250,
  unitPrice: 400,
  lowStockLevel: 10,
  reorderPoint: 20,
}).returning();

const [lot] = await db.insert(lots).values({
  code: "PERIOD-2601-A",
  productId: coffee.id,
  receivedAt: "2026-01-05",
  bestBeforeDate: "2027-01-05",
}).returning();

// Anchor everything in March 2026 so the month boundaries are unambiguous.
const at = (iso: string) => new Date(iso).toISOString();
const marchStart = resolvePeriod("month", utc(2026, 2, 15));

await db.insert(movements).values([
  { lotId: lot.id, productId: coffee.id, type: "RECEIPT", quantity: 100, reason: "Opening", performedBy: admin.id, createdAt: at("2026-02-25T09:00:00.000Z") },
  { lotId: lot.id, productId: coffee.id, type: "RECEIPT", quantity: 50, reason: "In period", performedBy: admin.id, createdAt: at("2026-03-02T09:00:00.000Z") },
  { lotId: lot.id, productId: coffee.id, type: "ISSUE", quantity: 30, reason: "Out", performedBy: admin.id, createdAt: at("2026-03-10T09:00:00.000Z") },
  { lotId: lot.id, productId: coffee.id, type: "RESERVE", quantity: 10, reason: "Held", performedBy: admin.id, createdAt: at("2026-03-11T09:00:00.000Z") },
  { lotId: lot.id, productId: coffee.id, type: "DAMAGE", quantity: 5, reason: "Split seam", performedBy: admin.id, createdAt: at("2026-03-12T09:00:00.000Z") },
  { lotId: lot.id, productId: coffee.id, type: "RECEIPT", quantity: 999, reason: "Next month", performedBy: admin.id, createdAt: at("2026-04-01T09:00:00.000Z") },
]);

const report = await buildPeriodReport(marchStart);

expect("period label is the month and year", marchStart.label === "March 2026", marchStart.label);
expect("receipts inside the period are counted", report.totals.received === 50, String(report.totals.received));
expect("issues inside the period are counted", report.totals.issued === 30, String(report.totals.issued));
expect("damage inside the period is counted", report.totals.damaged === 5, String(report.totals.damaged));
expect("reservations inside the period are counted", report.totals.reserved === 10, String(report.totals.reserved));
expect("movements outside the period are excluded", report.totals.movementCount === 4, String(report.totals.movementCount));
expect("February is excluded from March", report.totals.received === 50 && report.totals.movementCount === 4);
expect("net on-hand change excludes reservations", report.totals.netOnHand === 50 - 30 - 5, String(report.totals.netOnHand));
expect("net reserved change counts holds", report.totals.netReserved === 10, String(report.totals.netReserved));
expect("opening balance includes prior-period receipts", report.openingOnHand === 100, String(report.openingOnHand));
expect("closing balance equals opening plus net change", report.closingOnHand === report.openingOnHand + report.totals.netOnHand, `${report.closingOnHand}`);
expect("closing reserved is 10", report.closingReserved === 10, String(report.closingReserved));
expect("per-product lines are produced", report.byProduct.length === 1, String(report.byProduct.length));
expect("per-product net matches the total", report.byProduct[0]?.netOnHand === report.totals.netOnHand, String(report.byProduct[0]?.netOnHand));

// The report must agree with the dashboard's own derivation — but only for the
// period that contains every movement. Comparing a historical period's closing
// balance to today's ledger would be meaningless.
const summaries = await productSummaries();
const summary = summaries.find((entry: { product: { id: number } }) => entry.product.id === coffee.id);
expect("March excludes April's later receipt", report.closingOnHand === 115, String(report.closingOnHand));

// April must pick up the 999-unit receipt and nothing from March.
const april = await buildPeriodReport(resolvePeriod("month", utc(2026, 3, 15)));
expect("April counts its own receipt", april.totals.received === 999, String(april.totals.received));
expect("April excludes March activity", april.totals.issued === 0 && april.totals.damaged === 0);
expect("April opening equals March closing", april.openingOnHand === report.closingOnHand, `${april.openingOnHand}`);
expect("report closing on-hand matches the ledger", april.closingOnHand === summary?.onHand, `report=${april.closingOnHand} ledger=${summary?.onHand}`);
expect("report closing reserved matches the ledger", april.closingReserved === summary?.reserved, `report=${april.closingReserved} ledger=${summary?.reserved}`);

// A week inside March must be a strict subset of the month.
const weekReport = await buildPeriodReport(resolvePeriod("week", utc(2026, 2, 11)));
expect("a weekly report covers fewer movements than the month", weekReport.totals.movementCount < report.totals.movementCount, `${weekReport.totals.movementCount} vs ${report.totals.movementCount}`);
expect("a weekly report's opening is not negative", weekReport.openingOnHand >= 0, String(weekReport.openingOnHand));

// An empty period must not invent activity.
const emptyYear = await buildPeriodReport(resolvePeriod("year", utc(2030, 0, 1)));
expect("an empty period reports no movements", emptyYear.totals.movementCount === 0, String(emptyYear.totals.movementCount));
expect("an empty period still carries a correct opening balance", emptyYear.openingOnHand === 1114, String(emptyYear.openingOnHand));

// ------------------------------------------------- switching granularity
// Regression: the chips used to carry `period.start`, so switching ISO week 1
// (which begins 29 Dec of the previous year) to "yearly" jumped to the previous,
// empty year and every figure read zero.

const crossoverWeek = resolvePeriod("week", utc(2026, 0, 1));
const crossoverAnchor = switchAnchor(crossoverWeek, utc(2026, 10, 15));
expect("switching out of ISO week 1 stays inside it", crossoverAnchor.getTime() >= crossoverWeek.start.getTime() && crossoverAnchor.getTime() <= crossoverWeek.end.getTime(), crossoverAnchor.toISOString());
expect("switching out of ISO week 1 does not jump to the previous year", resolvePeriod("year", crossoverAnchor).key === "2026", resolvePeriod("year", crossoverAnchor).key);

const pastYear = resolvePeriod("year", utc(2026, 0, 1));
const pastAnchor = switchAnchor(pastYear, utc(2026, 10, 15));
expect("switching out of 2026 narrows inside 2026", resolvePeriod("year", pastAnchor).key === "2026", resolvePeriod("year", pastAnchor).key);
expect("switching a year to a month lands on a month inside it", resolvePeriod("month", pastAnchor).start.getUTCFullYear() === 2026, resolvePeriod("month", pastAnchor).key);

// A period entirely in the future clamps to its own start (now < start).
const futureWeek = resolvePeriod("week", utc(2031, 4, 1));
const futureAnchor = switchAnchor(futureWeek, utc(2026, 10, 15));
expect("switching out of a future period clamps to its start", futureAnchor.getTime() === futureWeek.start.getTime(), futureAnchor.toISOString());

// A period entirely in the past clamps to its own end (now > end).
const ancientYear = resolvePeriod("year", utc(2019, 0, 1));
const ancientAnchor = switchAnchor(ancientYear, utc(2026, 10, 15));
expect("switching out of a past period clamps to its end", ancientAnchor.getTime() === ancientYear.end.getTime(), ancientAnchor.toISOString());

console.log("Provi Beans - periodic report suite");
console.log("====================================");
console.log("  period key          ", marchStart.key);
console.log("  March totals        ", JSON.stringify(report.totals));
console.log("  opening / closing   ", report.openingOnHand, "/", report.closingOnHand, "on hand");
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