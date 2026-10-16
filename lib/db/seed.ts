import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  alerts,
  auditLogs,
  cartItems,
  carts,
  deliveries,
  lots,
  movements,
  orderRequestLines,
  orderRequests,
  orderReservations,
  products,
  sessions,
  suppliers,
  users,
} from "./schema";
import { hashPassword } from "../auth/password";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function timestampDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const DEMO_PASSWORD = "ProviBeans2026";

async function main() {
  console.log("Seeding Provi Beans inventory...");

  // `cascade` handles referential order; `restart identity` keeps serial ids at 1 on every seed.
  await db.execute(
    sql`truncate table
      notifications,
      cart_items, carts,
      order_reservations, order_request_lines, order_requests,
      audit_logs, alerts, stock_movements, lots, deliveries,
      products, sessions, suppliers, users
      restart identity cascade`,
  );

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@provibeans.ph",
      name: "Ariel Mendoza",
      passwordHash,
      role: "ADMIN",
    })
    .returning();

  const [staff] = await db
    .insert(users)
    .values({
      email: "staff@provibeans.ph",
      name: "Jenna Cruz",
      passwordHash,
      role: "INVENTORY_STAFF",
    })
    .returning();

  const [owner] = await db
    .insert(users)
    .values({
      email: "owner@provibeans.ph",
      name: "Rowan Provi",
      passwordHash,
      role: "OWNER",
    })
    .returning();

  console.log(`  users      ${admin.email}, ${staff.email}, ${owner.email}`);

  const [coop] = await db
    .insert(suppliers)
    .values({
      name: "Central Highlands Cooperative",
      contactName: "Nguyen Thi Lan",
      email: "orders@chighlands.vn",
      phone: "+84 263 3820 117",
      country: "Vietnam",
      address: "12 Nguyen Trai, Da Lat, Lam Dong",
      notes: "Primary supplier. Delivers monthly, wet-milled robusta.",
    })
    .returning();

  const [northwind] = await db
    .insert(suppliers)
    .values({
      name: "Northwind Export House",
      contactName: "Tran Bao",
      email: "sales@northwindexport.vn",
      phone: "+84 4 3936 1188",
      country: "Vietnam",
      address: "88 Hang Giay, Hanoi",
      notes: "Secondary supplier for arabica blends.",
    })
    .returning();

  console.log(`  suppliers ${coop.name}, ${northwind.name}`);

  const [hanoi] = await db
    .insert(products)
    .values({
      sku: "PB-HN-250",
      name: "Hà Nội Say Hi City Blend",
      originCountry: "Vietnam",
      originRegion: "Hanoi Province",
      species: "Robusta / Arabica",
      process: "Washed",
      roastLevel: "Medium",
      weightGrams: 250,
      unitPrice: 285,
      lowStockLevel: 24,
      reorderPoint: 60,
      nearExpiryDays: 30,
    })
    .returning();

  const [hue] = await db
    .insert(products)
    .values({
      sku: "PB-HUE-250",
      name: "Huế Say Hi 60/40",
      originCountry: "Vietnam",
      originRegion: "Thừa Thiên Huế",
      species: "60% Robusta · 40% Arabica",
      process: "Washed",
      roastLevel: "Medium-dark",
      weightGrams: 250,
      unitPrice: 310,
      lowStockLevel: 24,
      reorderPoint: 60,
      nearExpiryDays: 30,
    })
    .returning();

  const [saigon] = await db
    .insert(products)
    .values({
      sku: "PB-SGN-250",
      name: "Saigon Say Hi 100% Robusta",
      originCountry: "Vietnam",
      originRegion: "Ho Chi Minh City",
      species: "Robusta",
      process: "Natural",
      roastLevel: "Dark",
      weightGrams: 250,
      unitPrice: 265,
      lowStockLevel: 30,
      reorderPoint: 80,
      nearExpiryDays: 30,
    })
    .returning();

  console.log(`  products  ${hanoi.sku}, ${hue.sku}, ${saigon.sku}`);

  const [d1] = await db
    .insert(deliveries)
    .values({
      supplierId: coop.id,
      reference: "CH-2026-018",
      receivedAt: timestampDaysAgo(120),
      notes: "Full monthly allocation.",
      recordedBy: staff.id,
    })
    .returning();

  const [d2] = await db
    .insert(deliveries)
    .values({
      supplierId: northwind.id,
      reference: "NE-2026-044",
      receivedAt: timestampDaysAgo(45),
      notes: "Partial receipt, second pallet short by 20 bags.",
      recordedBy: staff.id,
    })
    .returning();

  const [d3] = await db
    .insert(deliveries)
    .values({
      supplierId: coop.id,
      reference: "CH-2026-022",
      receivedAt: timestampDaysAgo(12),
      notes: "Restock for Huế and Saigon.",
      recordedBy: admin.id,
    })
    .returning();

  console.log(`  deliveries ${d1.reference}, ${d2.reference}, ${d3.reference}`);

  const lotSpecs = [
    {
      code: "HN-2601-A",
      productId: hanoi.id,
      deliveryId: d1.id,
      receivedAt: timestampDaysAgo(120),
      roastDate: daysFromNow(-115),
      packDate: daysFromNow(-110),
      bestBeforeDate: daysFromNow(60),
      expiryDate: daysFromNow(95),
      status: "ACTIVE" as const,
      notes: "Opening lot.",
    },
    {
      code: "HN-2602-B",
      productId: hanoi.id,
      deliveryId: d3.id,
      receivedAt: timestampDaysAgo(12),
      roastDate: daysFromNow(-8),
      packDate: daysFromNow(-6),
      bestBeforeDate: daysFromNow(11),
      expiryDate: daysFromNow(26),
      status: "ACTIVE" as const,
      notes: "Will trip the near-expiry threshold.",
    },
    {
      code: "HUE-2510-A",
      productId: hue.id,
      deliveryId: d1.id,
      receivedAt: timestampDaysAgo(120),
      roastDate: daysFromNow(-118),
      packDate: daysFromNow(-114),
      bestBeforeDate: daysFromNow(-30),
      expiryDate: daysFromNow(-9),
      status: "ACTIVE" as const,
      notes: "Already expired, must not issue.",
    },
    {
      code: "HUE-2602-B",
      productId: hue.id,
      deliveryId: d2.id,
      receivedAt: timestampDaysAgo(45),
      roastDate: daysFromNow(-40),
      packDate: daysFromNow(-37),
      bestBeforeDate: daysFromNow(38),
      expiryDate: daysFromNow(74),
      status: "ACTIVE" as const,
      notes: "Healthy replacement stock.",
    },
    {
      code: "HUE-2603-DMG",
      productId: hue.id,
      deliveryId: d3.id,
      receivedAt: timestampDaysAgo(12),
      roastDate: daysFromNow(-9),
      packDate: daysFromNow(-7),
      bestBeforeDate: daysFromNow(40),
      expiryDate: daysFromNow(76),
      status: "ACTIVE" as const,
      notes: "Suffered transit damage, held for review.",
    },
    {
      code: "SGN-2601-A",
      productId: saigon.id,
      deliveryId: d1.id,
      receivedAt: timestampDaysAgo(120),
      roastDate: daysFromNow(-114),
      packDate: daysFromNow(-109),
      bestBeforeDate: daysFromNow(52),
      expiryDate: daysFromNow(88),
      status: "ACTIVE" as const,
      notes: "Bulk stock, heavily issued.",
    },
    {
      code: "SGN-2602-B",
      productId: saigon.id,
      deliveryId: d3.id,
      receivedAt: timestampDaysAgo(12),
      roastDate: daysFromNow(-7),
      packDate: daysFromNow(-5),
      bestBeforeDate: daysFromNow(43),
      expiryDate: daysFromNow(79),
      status: "ACTIVE" as const,
      notes: "Latest arrival.",
    },
  ];

  const insertedLots = await db.insert(lots).values(lotSpecs).returning();
  const lotByCode = new Map(insertedLots.map((lot) => [lot.code, lot]));

  const lotsFor = (productId: number) => insertedLots.filter((lot) => lot.productId === productId);

  const movementSpecs = [
    { code: "HN-2601-A", type: "RECEIPT" as const, quantity: 300, reason: "Full delivery", by: staff.id, ago: 120 },
    { code: "HN-2601-A", type: "ISSUE" as const, quantity: 120, reason: "Reyes Coffee", reference: "SO-1041", by: staff.id, ago: 40 },
    { code: "HN-2601-A", type: "ISSUE" as const, quantity: 45, reason: "Morning Brew PH", reference: "SO-1058", by: staff.id, ago: 9 },
    { code: "HN-2602-B", type: "RECEIPT" as const, quantity: 150, reason: "Restock", by: admin.id, ago: 12 },
    { code: "HN-2602-B", type: "ISSUE" as const, quantity: 26, reason: "Kape Manila", reference: "SO-1102", by: staff.id, ago: 5 },

    { code: "HUE-2510-A", type: "RECEIPT" as const, quantity: 240, reason: "Full delivery", by: staff.id, ago: 120 },
    { code: "HUE-2510-A", type: "ISSUE" as const, quantity: 180, reason: "Issued before expiry window closed", by: staff.id, ago: 30 },
    { code: "HUE-2602-B", type: "RECEIPT" as const, quantity: 200, reason: "Partial receipt", by: staff.id, ago: 45 },
    { code: "HUE-2602-B", type: "ISSUE" as const, quantity: 65, reason: "Studio Nine", reference: "SO-1063", by: staff.id, ago: 20 },
    { code: "HUE-2603-DMG", type: "RECEIPT" as const, quantity: 80, reason: "Restock", by: admin.id, ago: 12 },
    { code: "HUE-2603-DMG", type: "DAMAGE" as const, quantity: 14, reason: "Split seams on transit", by: staff.id, ago: 10 },

    { code: "SGN-2601-A", type: "RECEIPT" as const, quantity: 400, reason: "Full delivery", by: staff.id, ago: 120 },
    { code: "SGN-2601-A", type: "ISSUE" as const, quantity: 372, reason: "Consistent supply", by: staff.id, ago: 60 },
    { code: "SGN-2601-A", type: "RETURN" as const, quantity: 8, reason: "Customer return, intact", by: staff.id, ago: 18 },
    { code: "SGN-2602-B", type: "RECEIPT" as const, quantity: 220, reason: "Restock", by: admin.id, ago: 12 },
    { code: "SGN-2602-B", type: "ISSUE" as const, quantity: 64, reason: "Cafe Adriatico", reference: "SO-1101", by: staff.id, ago: 4 },
    { code: "SGN-2602-B", type: "RESERVE" as const, quantity: 30, reason: "Held for confirmed order", by: staff.id, ago: 2 },
  ];

  const lotProduct = new Map(insertedLots.map((lot) => [lot.code, lot.productId]));
  await db.insert(movements).values(
    movementSpecs.map((spec) => ({
      lotId: lotByCode.get(spec.code)!.id,
      productId: lotProduct.get(spec.code)!,
      type: spec.type,
      quantity: spec.quantity,
      reason: spec.reason,
      reference: spec.reference ?? null,
      performedBy: spec.by,
      createdAt: timestampDaysAgo(spec.ago),
    })),
  );

  console.log(`  lots      ${insertedLots.length} lots`);
  console.log(`  movements ${movementSpecs.length} entries`);

  await db
    .update(lots)
    .set({ status: "QUARANTINE", quarantineReason: "Transit damage pending supplier claim" })
    .where(eq(lots.code, "HUE-2603-DMG"));

  await db.insert(auditLogs).values([
    {
      actorId: staff.id,
      actorName: staff.name,
      action: "RECEIVE",
      entity: "delivery",
      entityId: String(d1.id),
      after: JSON.stringify({ reference: d1.reference, lots: 3 }),
      createdAt: timestampDaysAgo(120),
    },
    {
      actorId: admin.id,
      actorName: admin.name,
      action: "QUARANTINE",
      entity: "lot",
      entityId: "HUE-2603-DMG",
      before: JSON.stringify({ status: "ACTIVE" }),
      after: JSON.stringify({ status: "QUARANTINE" }),
      createdAt: timestampDaysAgo(10),
    },
  ]);

  const totalMovements = await db.select({ n: sql<number>`count(*)` }).from(movements);
  console.log("--------------------------------------------------");
  console.log(`Seeded. Movement ledger rows: ${totalMovements[0].n}`);
  console.log(`Sign in with any of these (password: ${DEMO_PASSWORD})`);
  console.log("  admin@provibeans.ph  - Administrator");
  console.log("  staff@provibeans.ph  - Inventory staff");
  console.log("  owner@provibeans.ph  - Owner / manager");
  console.log("--------------------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });