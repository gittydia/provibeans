import "./env.mjs";
export {};

// This suite truncates every table, so it must never run against the
// application's own database. Neon branches are isolated copies, which makes
// DATABASE_URL_VERIFY the safe target. Set before @/lib/db is imported below.
if (process.env.DATABASE_URL_VERIFY) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_VERIFY;
}

const [
  { eq, sql },
  { db, raw, ensureSchema },
  schema,
  { hashPassword },
  ledger,
  record,
  alertsModule,
  ordersModule,
] = await Promise.all([
  import("drizzle-orm"),
  import("@/lib/db"),
  import("@/lib/db/schema"),
  import("@/lib/auth/password"),
  import("@/lib/inventory/ledger"),
  import("@/lib/inventory/record"),
  import("@/lib/inventory/alerts"),
  import("@/lib/inventory/orders"),
]);

const {
  cancelOrderRequest,
  loadOrderRequest,
  submitOrderRequest,
} = ordersModule;

await ensureSchema();

const { lots, products, suppliers, users } = schema;
const { allocateFefo, buildLotViews, fefoPlan, productSummaries } = ledger;
const { adjustLotStock, issueStock, quarantineLot, releaseQuarantine } = record;
const { evaluateAlerts, openAlerts } = alertsModule;
type Actor = { id: number; name: string };

function days(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

const results: { label: string; ok: boolean; detail: string }[] = [];

function expect(label: string, condition: boolean, detail = "") {
  results.push({ label, ok: condition, detail });
}

const cleanup = async () => {
  await db.execute(
sql`truncate table
      notifications, audit_logs, alerts, sessions,
      order_reservations, order_request_lines, order_requests,
      stock_movements, lots, deliveries, products, suppliers, users
      restart identity cascade`,
  );
};

async function main() {
  await cleanup();

  const passwordHash = await hashPassword("VerifyScript123");

  const [admin] = await db
    .insert(users)
    .values({ email: "verify@provibeans.ph", name: "Verifier", passwordHash, role: "ADMIN" })
    .returning();

  const actor: Actor = { id: admin.id, name: admin.name };

  const [supplier] = await db
    .insert(suppliers)
    .values({ name: "Verification Supplier" })
    .returning();

  const [product] = await db
    .insert(products)
    .values({
      sku: "PB-VERIFY",
      name: "Verification Coffee",
      weightGrams: 250,
      unitPrice: 250,
      lowStockLevel: 20,
      reorderPoint: 40,
      nearExpiryDays: 30,
    })
    .returning();

  const made = await db
    .insert(lots)
    .values(
      (
        [
          {
            code: "V-EXPIRED",
            offset: -90,
            bestBeforeDate: days(-20),
            expiryDate: days(-5),
          },
          {
            code: "V-SOON",
            offset: -40,
            bestBeforeDate: days(10),
            expiryDate: days(25),
          },
          {
            code: "V-LATER",
            offset: -10,
            bestBeforeDate: days(80),
            expiryDate: days(120),
          },
          {
            code: "V-HELD",
            offset: -10,
            bestBeforeDate: days(80),
            expiryDate: days(120),
          },
        ] as const
      ).map((spec) => ({
        code: spec.code,
        productId: product.id,
        deliveryId: null,
        receivedAt: new Date(Date.now() + spec.offset * 86_400_000).toISOString(),
        bestBeforeDate: spec.bestBeforeDate,
        expiryDate: spec.expiryDate,
        status: "ACTIVE" as const,
      })),
    )
    .returning();

  const byCode = new Map(made.map((lot) => [lot.code, lot]));

  const insertMovement = async (lotCode: string, type: string, quantity: number) => {
    await raw(
      "insert into stock_movements (lot_id, product_id, type, quantity, performed_by) values ($1,$2,$3,$4,$5)",
      [byCode.get(lotCode)!.id, product.id, type, quantity, admin.id],
    );
  };

  await insertMovement("V-EXPIRED", "RECEIPT", 50);
  await insertMovement("V-SOON", "RECEIPT", 40);
  await insertMovement("V-LATER", "RECEIPT", 100);
  await insertMovement("V-HELD", "RECEIPT", 60);

  // ---- FEFO ordering -------------------------------------------------
  const plan = await fefoPlan(product.id);
  expect(
    "FEFO excludes the expired lot",
    !plan.some((entry) => entry.lotCode === "V-EXPIRED"),
    plan.map((entry) => entry.lotCode).join(","),
  );
  expect(
    "FEFO orders earliest effective date first",
    plan[0]?.lotCode === "V-SOON",
    plan.map((entry) => `${entry.lotCode}(${entry.daysToExpiry}d)`).join(", "),
  );

  // ---- expired stock is not issuable ---------------------------------
  const expiredIssue = await issueStock({
    actor,
    productId: product.id,
    quantity: 1,
    lotId: byCode.get("V-EXPIRED")!.id,
  });
  expect("issuing an expired lot is blocked", !expiredIssue.ok, expiredIssue.ok ? "" : expiredIssue.error);

  // ---- available excludes quarantined -------------------------------
  await quarantineLot(actor, byCode.get("V-HELD")!.id, "Damaged in transit");
  const heldIssue = await issueStock({
    actor,
    productId: product.id,
    quantity: 1,
    lotId: byCode.get("V-HELD")!.id,
  });
  expect("issuing a quarantined lot is blocked", !heldIssue.ok, heldIssue.ok ? "" : heldIssue.error);

  const viewsAfterHold = await buildLotViews({ productId: product.id });
  const heldView = viewsAfterHold.find((view) => view.lot.code === "V-HELD")!;
  expect(
    "quarantined stock reports zero available",
    heldView.available === 0 && heldView.onHand === 60,
    `onHand=${heldView.onHand} available=${heldView.available}`,
  );

  // ---- FEFO spreads across lots in order -----------------------------
  const allocation = await allocateFefo(product.id, 50);
  expect(
    "allocation draws from the earliest lot first",
    allocation.allocations[0]?.lotCode === "V-SOON" &&
      allocation.allocations[0]?.quantity === 40,
    allocation.allocations.map((a) => `${a.lotCode}:${a.quantity}`).join(", "),
  );
  expect(
    "allocation continues into the next lot for the remainder",
    allocation.allocations[1]?.lotCode === "V-LATER" && allocation.allocations[1]?.quantity === 10,
    allocation.allocations.map((a) => `${a.lotCode}:${a.quantity}`).join(", "),
  );
  expect("no shortfall when valid stock covers the request", allocation.shortfall === 0);

  // ---- over-issue is refused -----------------------------------------
  const overIssue = await issueStock({ actor, productId: product.id, quantity: 1000 });
  expect("issuing beyond valid stock is blocked", !overIssue.ok, overIssue.ok ? "" : overIssue.error);

  // ---- damage cannot exceed on hand ----------------------------------
  const badDamage = await adjustLotStock({
    actor,
    lotId: byCode.get("V-LATER")!.id,
    quantity: 5000,
    reason: "verification",
    type: "DAMAGE",
    successVerb: "Damaged",
  });
  expect("damage beyond on-hand is blocked", !badDamage.ok, badDamage.ok ? "" : badDamage.error);

  // ---- quarantine blocks reservation, release restores ---------------
  const heldReserve = await adjustLotStock({
    actor,
    lotId: byCode.get("V-HELD")!.id,
    quantity: 5,
    reason: "verification",
    type: "RESERVE",
    successVerb: "Reserved",
  });
  expect("reserving quarantined stock is blocked", !heldReserve.ok, heldReserve.ok ? "" : heldReserve.error);

  await releaseQuarantine(actor, byCode.get("V-HELD")!.id);
  const releasedViews = await buildLotViews({ productId: product.id });
  const released = releasedViews.find((view) => view.lot.code === "V-HELD")!;
  expect(
    "released lot becomes issuable again",
    released.available === 60 && !released.isQuarantined,
    `available=${released.available}`,
  );

  // ---- reserved stock is excluded from available ---------------------
  await adjustLotStock({
    actor,
    lotId: byCode.get("V-LATER")!.id,
    quantity: 25,
    reason: "held for an order",
    type: "RESERVE",
    successVerb: "Reserved",
  });
  const reservedViews = await buildLotViews({ productId: product.id });
  const laterView = reservedViews.find((view) => view.lot.code === "V-LATER")!;
  expect(
    "reserved units are removed from available",
    laterView.onHand === 100 && laterView.reserved === 25 && laterView.available === 75,
    `onHand=${laterView.onHand} reserved=${laterView.reserved} available=${laterView.available}`,
  );

  const overReserve = await adjustLotStock({
    actor,
    lotId: byCode.get("V-SOON")!.id,
    quantity: 41,
    reason: "too much",
    type: "RESERVE",
    successVerb: "Reserved",
  });
  expect("reserving beyond available is blocked", !overReserve.ok, overReserve.ok ? "" : overReserve.error);

  // ---- a successful issue actually moves stock -----------------------
  const goodIssue = await issueStock({
    actor,
    productId: product.id,
    quantity: 10,
    reason: "verification issue",
  });
  expect("a valid issue succeeds", goodIssue.ok, goodIssue.ok ? "" : goodIssue.error);

  const afterViews = await buildLotViews({ productId: product.id });
  const soonAfter = afterViews.find((view) => view.lot.code === "V-SOON")!;
  expect(
    "issue is taken from the FEFO lot",
    soonAfter.onHand === 30,
    `V-SOON onHand=${soonAfter.onHand}`,
  );

  // ---- summaries and alerts ------------------------------------------
  const summaries = await productSummaries();
  const summary = summaries.find((entry) => entry.product.id === product.id)!;
  expect(
    "inventory value uses on-hand quantity",
    summary.inventoryValue === summary.onHand * product.unitPrice,
    `value=${summary.inventoryValue}`,
  );

  const alertRun = await evaluateAlerts();
  const alertsNow = await openAlerts();
  const types = new Set(alertsNow.map((alert) => alert.type));
  expect("expired stock raises an alert", types.has("EXPIRED"), [...types].join(","));
  expect("near-expiry stock raises an alert", types.has("NEAR_EXPIRY"), [...types].join(","));

const secondRun = await evaluateAlerts();
  expect(
    "re-running does not duplicate alerts",
    secondRun.raised === 0,
    `first run raised ${alertRun.raised}, second raised ${secondRun.raised}`,
  );

  // ---- public order requests reserve stock through FEFO --------------
  const availableBeforeOrder = (await buildLotViews({ productId: product.id })).reduce(
    (sum, view) => sum + view.available,
    0,
  );

  const order = await submitOrderRequest({
    customerName: "Verification Cafe",
    business: "Verification Cafe",
    email: "orders@verification.test",
    notes: "logic suite",
    lines: [{ productId: product.id, quantity: 25 }],
  });

  expect("an order request is accepted", order.ok, order.ok ? "" : order.error);

  if (order.ok) {
    const line = order.lines[0];
    expect(
      "the request is fully reserved",
      line.status === "RESERVED" && line.reserved === 25,
      `status=${line.status} reserved=${line.reserved}`,
    );
    expect(
      "reservation is taken from the FEFO lot",
      line.allocations[0]?.lotCode === "V-SOON",
      line.allocations.map((a) => `${a.lotCode}:${a.quantity}`).join(", "),
    );
    expect(
      "no expired or quarantined lot is reserved",
      !line.allocations.some((a) => a.lotCode === "V-EXPIRED" || a.lotCode === "V-HELD"),
      line.allocations.map((a) => a.lotCode).join(", "),
    );

    const afterOrder = (await buildLotViews({ productId: product.id })).reduce(
      (sum, view) => sum + view.available,
      0,
    );
    expect(
      "reserved units leave available stock",
      availableBeforeOrder - afterOrder === 25,
      `before=${availableBeforeOrder} after=${afterOrder}`,
    );

    const loaded = await loadOrderRequest(
      (await db.query.orderRequests.findFirst({ where: eq(schema.orderRequests.reference, order.reference) }))!
        .id,
    );
    expect(
      "the request lists the lots it holds",
      (loaded?.reservations.length ?? 0) === 1,
      `reservations=${loaded?.reservations.length}`,
    );

    const cancelResult = await cancelOrderRequest(loaded!.request.id, "verifier");
    expect("cancelling a request succeeds", cancelResult.ok, cancelResult.message);

    const afterCancel = (await buildLotViews({ productId: product.id })).reduce(
      (sum, view) => sum + view.available,
      0,
    );
    expect(
      "cancelling releases the reserved stock",
      afterCancel === availableBeforeOrder,
      `expected=${availableBeforeOrder} got=${afterCancel}`,
    );
  }

  const overOrder = await submitOrderRequest({
    customerName: "Verification Cafe",
    email: "orders@verification.test",
    lines: [{ productId: product.id, quantity: 100000 }],
  });
  expect("an oversized request is still accepted", overOrder.ok, overOrder.ok ? "" : overOrder.error);
  if (overOrder.ok) {
    const line = overOrder.lines[0];
    expect(
      "an oversized request is recorded SHORT or PARTIAL, not silently fulfilled",
      line.status === "SHORT" || line.status === "PARTIAL",
      `status=${line.status} reserved=${line.reserved}/${line.requested}`,
    );
    expect(
      "a short line explains itself",
      typeof line.note === "string" && line.note.length > 0,
      String(line.note),
    );
  }

  const badOrder = await submitOrderRequest({
    customerName: "",
    email: "not-an-email",
    lines: [{ productId: product.id, quantity: 5 }],
  });
  expect("a malformed request is refused", !badOrder.ok);

  const emptyOrder = await submitOrderRequest({
    customerName: "Verification Cafe",
    email: "orders@verification.test",
    lines: [],
  });
  expect("a request with no lines is refused", !emptyOrder.ok);

  for (const row of await raw<{ id: number }>("select id from order_requests")) {
    await cancelOrderRequest(row.id, "verifier");
  }

cleanup();

  console.log("Provi Beans - inventory logic verification");
  console.log("=========================================");
  for (const result of results) {
    const verdict = result.ok ? "PASS" : "FAIL";
    const suffix = result.detail && !result.ok ? `  (${result.detail})` : "";
    console.log(`  [${verdict}] ${result.label}${suffix}`);
  }
  const failed = results.filter((result) => !result.ok);
  console.log("=========================================");
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Verification crashed:", error);
  process.exit(1);
});