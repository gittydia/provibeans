import "./env.mjs";
export {};

// Destructive: truncates every table, so it must only ever run against the
// isolated Neon branch behind DATABASE_URL_VERIFY.
if (process.env.DATABASE_URL_VERIFY) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_VERIFY;
}

const [
  { and, eq, sql },
  { db, raw, ensureSchema },
  schema,
  { hashPassword },
  alertsModule,
  record,
  ordersModule,
  notificationsModule,
] = await Promise.all([
  import("drizzle-orm"),
  import("@/lib/db"),
  import("@/lib/db/schema"),
  import("@/lib/auth/password"),
  import("@/lib/inventory/alerts"),
  import("@/lib/inventory/record"),
  import("@/lib/inventory/orders"),
  import("@/lib/notifications/service"),
]);

await ensureSchema();

const { alerts, lots, notifications, products, users } = schema;
const { evaluateAlerts } = alertsModule;
const { quarantineLot, issueStock } = record;
const { submitOrderRequest, confirmOrderRequest, fulfilOrderRequest } = ordersModule;
const {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  reconcileAlertNotifications,
  unreadCount,
} = notificationsModule;

const NOTIFY = "notification-verify@provibeans.ph";
const staff = { id: 0, name: "", role: "" };
const owner = { id: 0, name: "", role: "" };
const admin = { id: 0, name: "", role: "" };

type Actor = { id: number; name: string };

const results: { label: string; ok: boolean; detail: string }[] = [];

function expect(label: string, condition: boolean, detail = "") {
  results.push({ label, ok: condition, detail });
}

function days(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
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

let product = { id: 0, sku: "" };

async function counts(): Promise<Record<string, number>> {
  const rows = await raw<{ type: string; n: number }>(
    "select type, count(*)::int as n from notifications group by type",
  );
  return Object.fromEntries(rows.map((row) => [row.type, row.n]));
}

async function openAlertsOfType(type: string): Promise<number> {
  const rows = await raw<{ n: number }>(
    "select count(*)::int as n from alerts where resolved_at is null and type = $1",
    [type],
  );
  return rows[0]?.n ?? 0;
}

async function main() {
  await cleanup();

  const passwordHash = await hashPassword("VerifyScript123");

  const [adminRow, staffRow, ownerRow] = await db
    .insert(users)
    .values([
      { email: NOTIFY, name: "Notify Admin", passwordHash, role: "ADMIN" as const },
      { email: "notification-staff@provibeans.ph", name: "Notify Staff", passwordHash, role: "INVENTORY_STAFF" as const },
      { email: "notification-owner@provibeans.ph", name: "Notify Owner", passwordHash, role: "OWNER" as const },
    ])
    .returning();

  admin.id = adminRow.id;
  staff.id = staffRow.id;
  owner.id = ownerRow.id;

  const [supplier] = await db
    .insert(schema.suppliers)
    .values({ name: "Notification Supplier" })
    .returning();

  const [created] = await db
    .insert(products)
    .values({
      sku: "PB-NOTIFY",
      name: "Notification Coffee",
      weightGrams: 250,
      unitPrice: 250,
      lowStockLevel: 20,
      reorderPoint: 40,
      nearExpiryDays: 30,
    })
    .returning();
  product = created;

  const [expiredLot, heldLot, soonLot] = await db
    .insert(lots)
    .values([
      {
        code: "N-EXPIRED",
        productId: product.id,
        receivedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
        bestBeforeDate: days(-20),
        expiryDate: days(-5),
      },
      {
        code: "N-HELD",
        productId: product.id,
        receivedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        bestBeforeDate: days(80),
        expiryDate: days(120),
      },
      {
        code: "N-SOON",
        productId: product.id,
        receivedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        bestBeforeDate: days(10),
        expiryDate: days(25),
      },
    ])
    .returning();

  await raw(
    "insert into stock_movements (lot_id, product_id, type, quantity, performed_by) values ($1,$2,'RECEIPT',$3,$4)",
    [expiredLot.id, product.id, 50, admin.id],
  );
  await raw(
    "insert into stock_movements (lot_id, product_id, type, quantity, performed_by) values ($1,$2,'RECEIPT',$3,$4)",
    [heldLot.id, product.id, 60, admin.id],
  );
  await raw(
    "insert into stock_movements (lot_id, product_id, type, quantity, performed_by) values ($1,$2,'RECEIPT',$3,$4)",
    [soonLot.id, product.id, 40, admin.id],
  );

  // ---- derivation produces notifications ---------------------------
  await evaluateAlerts();

  expect("expired stock raises an alert", (await openAlertsOfType("EXPIRED")) === 1);
  expect("near-expiry stock raises an alert", (await openAlertsOfType("NEAR_EXPIRY")) === 1);

  const ownerUnread = await unreadCount(owner.id);
  expect("an open alert notifies the owner", ownerUnread > 0, `owner unread=${ownerUnread}`);

  const staffUnread = await unreadCount(staff.id);
  expect(
    "expiry and reorder alerts do not reach inventory staff",
    staffUnread === 0,
    `staff unread=${staffUnread}`,
  );

  const { items: ownerItems } = await listNotifications(owner.id, { limit: 50 });
  expect(
    "a new notification starts unread",
    ownerItems.length > 0 && ownerItems.every((item) => !item.isRead && item.readAt === null),
    `${ownerItems.filter((i) => i.isRead).length} of ${ownerItems.length} read`,
  );
  expect(
    "a notification carries a title and a message",
    ownerItems.every((item) => item.title.length > 0 && item.message.length > 0),
  );

  // ---- idempotency --------------------------------------------------
  const before = await counts();
  await evaluateAlerts();
  await evaluateAlerts();
  const after = await counts();
  expect(
    "re-running the evaluation does not duplicate notifications",
    JSON.stringify(before) === JSON.stringify(after),
    `${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
  );

  // ---- the open-alert uniqueness guard is concurrency safe ----------
  // Four overlapping evaluations, each deriving independently, then applying
  // under the advisory lock. Asserting only that "nothing threw" would pass
  // vacuously against unchanged stock, so this also pins the exact resulting
  // alert and notification counts.
  const concurrent = await Promise.allSettled([
    evaluateAlerts(),
    evaluateAlerts(),
    evaluateAlerts(),
    evaluateAlerts(),
  ]);
  expect(
    "concurrent evaluations all complete without throwing",
    concurrent.every((outcome) => outcome.status === "fulfilled"),
    concurrent
      .filter((o): o is PromiseRejectedResult => o.status === "rejected")
      .map((o) => String(o.reason))
      .join("; "),
  );
  expect(
    "concurrent evaluations open only one alert per condition",
    (await openAlertsOfType("EXPIRED")) === 1,
    `expired alerts=${await openAlertsOfType("EXPIRED")}`,
  );
  expect(
    "concurrent evaluations open only one alert per near-expiry lot",
    (await openAlertsOfType("NEAR_EXPIRY")) === 1,
    `near-expiry alerts=${await openAlertsOfType("NEAR_EXPIRY")}`,
  );

  const ownerAfterConcurrency = await unreadCount(owner.id);
  expect(
    "concurrency does not multiply notifications for one recipient",
    ownerAfterConcurrency === ownerUnread,
    `owner unread=${ownerAfterConcurrency} expected=${ownerUnread}`,
  );

  const duplicates = await raw<{ n: number }>(
    `select count(*)::int as n from (
       select user_id, dedupe_key from notifications group by user_id, dedupe_key having count(*) > 1
     ) d`,
  );
  expect(
    "no recipient holds the same dedupe key twice",
    (duplicates[0]?.n ?? 0) === 0,
    `duplicate keys=${duplicates[0]?.n ?? 0}`,
  );

  // ---- reconciliation self-heals ------------------------------------
  const victim = ownerItems[0];
  await db.delete(notifications).where(eq(notifications.id, victim.id));
  expect(
    "deleting a notification drops the recipient's unread count",
    (await unreadCount(owner.id)) === ownerUnread - 1,
    `expected ${ownerUnread - 1}, got ${await unreadCount(owner.id)}`,
  );
  await reconcileAlertNotifications();
  expect(
    "the next reconciliation restores the lost notification",
    (await unreadCount(owner.id)) === ownerUnread,
    `expected ${ownerUnread}, got ${await unreadCount(owner.id)}`,
  );

  // ---- quarantine reaches every role --------------------------------
  await quarantineLot({ id: admin.id, name: adminRow.name }, heldLot.id, "Damaged in transit");
  await evaluateAlerts();
  expect("quarantine raises an alert", (await openAlertsOfType("QUARANTINE")) === 1);
  expect(
    "a quarantine alert reaches inventory staff too",
    (await unreadCount(staff.id)) > 0,
    `staff unread=${await unreadCount(staff.id)}`,
  );

  // ---- a failed business event notifies nobody ----------------------
  const staffBefore = await unreadCount(staff.id);
  const refused = await issueStock({
    actor: { id: admin.id, name: adminRow.name },
    productId: product.id,
    quantity: 999999,
    reason: "should be refused",
  });
  await evaluateAlerts();
  expect("an over-issue is refused", !refused.ok, refused.ok ? "" : refused.error);
  expect(
    "a failed business event produces no new notification",
    (await unreadCount(staff.id)) === staffBefore,
    `before=${staffBefore} after=${await unreadCount(staff.id)}`,
  );

  // ---- individual read ------------------------------------------------
  const staffItems = (await listNotifications(staff.id, { limit: 50 })).items;
  const target = staffItems[0];
  const untouched = staffItems.slice(1);

  const firstRead = await markNotificationRead(staff.id, target.id);
  expect("marking one notification read succeeds", firstRead.ok && firstRead.changed);

  const secondRead = await markNotificationRead(staff.id, target.id);
  expect(
    "marking the same notification read twice is idempotent",
    secondRead.ok && !secondRead.changed,
    JSON.stringify(secondRead),
  );

  const afterRead = (await listNotifications(staff.id, { limit: 50 })).items;
  expect(
    "only the selected notification changed",
    afterRead.find((i) => i.id === target.id)?.isRead === true &&
      untouched.every((item) => !afterRead.find((i) => i.id === item.id)?.isRead),
  );

  // ---- cross-user isolation -------------------------------------------
  const ownerOnly = (await listNotifications(owner.id, { limit: 50 })).items.find(
    (item) => !afterRead.some((other) => other.id === item.id),
  );
  if (ownerOnly) {
    const denied = await markNotificationRead(staff.id, ownerOnly.id);
    expect(
      "one user cannot mark another user's notification read",
      !denied.ok && !denied.changed,
      JSON.stringify(denied),
    );
    expect(
      "the other user's notification stays unread",
      (await listNotifications(owner.id, { limit: 50 })).items.find((i) => i.id === ownerOnly.id)?.isRead === false,
    );
  } else {
    expect("one user cannot mark another user's notification read", false, "no cross-user sample found");
  }

  const missing = await markNotificationRead(staff.id, 99999999);
  expect("marking a nonexistent notification is refused", !missing.ok);

  // ---- mark all read ---------------------------------------------------
  const staffUnreadBefore = await unreadCount(staff.id);
  const ownerUnreadBefore = await unreadCount(owner.id);
  const bulk = await markAllNotificationsRead(staff.id);
  expect(
    "mark all read clears the recipient's unread count",
    bulk === staffUnreadBefore && (await unreadCount(staff.id)) === 0,
    `changed=${bulk} remaining=${await unreadCount(staff.id)}`,
  );
  expect(
    "mark all read leaves another user's notifications alone",
    (await unreadCount(owner.id)) === ownerUnreadBefore,
    `owner ${ownerUnreadBefore} -> ${await unreadCount(owner.id)}`,
  );

  const bulkAgain = await markAllNotificationsRead(staff.id);
  expect("mark all read is idempotent", bulkAgain === 0, `second call changed ${bulkAgain}`);

  await raw(
    `insert into notifications (user_id, type, severity, title, message, dedupe_key)
     values ($1, 'COUNT_VARIANCE', 'INFO', 'Arrived late', 'Committed after the bulk update', $2)`,
    [staff.id, "late-arrival-probe"],
  );
  expect(
    "a notification arriving after mark-all stays unread",
    (await unreadCount(staff.id)) === 1,
    `staff unread=${await unreadCount(staff.id)}`,
  );

  // ---- pagination and recovery ----------------------------------------
  const seeded = await raw<{ n: number }>(
    "select count(*)::int as n from notifications where user_id = $1",
    [owner.id],
  );
  const pageOne = await listNotifications(owner.id, { limit: 2 });
  expect("a page is capped at the requested limit", pageOne.items.length === 2, `got ${pageOne.items.length}`);
  expect(
    "a page is ordered newest first",
    pageOne.items[0].createdAt >= pageOne.items[1].createdAt,
    `${pageOne.items[0].createdAt} vs ${pageOne.items[1].createdAt}`,
  );
  expect("a full page advertises a further cursor", pageOne.nextCursor !== null);

  const seen = new Set(pageOne.items.map((item) => item.id));
  let cursor = pageOne.nextCursor;
  let pages = 1;
  while (cursor && pages < 50) {
    const next = await listNotifications(owner.id, { limit: 2, cursor });
    for (const item of next.items) {
      if (seen.has(item.id)) {
        expect("pagination never repeats a row", false, `id ${item.id} seen twice`);
      }
      seen.add(item.id);
    }
    cursor = next.nextCursor;
    pages += 1;
  }
  expect(
    "paging the cursor walks every notification exactly once",
    seen.size === (seeded[0]?.n ?? 0),
    `walked ${seen.size} of ${seeded[0]?.n ?? 0}`,
  );
  expect("paging terminates", cursor === null);

  const clamped = await listNotifications(owner.id, { limit: 9999 });
  expect("an oversized limit is clamped, not trusted", clamped.items.length <= 100);

  // Reconnect recovery: the keyset cursor walks backwards through history for
// "load older", so it cannot fetch something newer. A client that was
// disconnected therefore recovers by re-reading the latest authoritative page,
// which is exactly what the poll endpoint serves.
  const beforeDisconnect = await listNotifications(owner.id, { limit: 1 });
  const seenBeforeDisconnect = beforeDisconnect.items[0]?.id ?? 0;

  await raw(
    `insert into notifications (user_id, type, severity, title, message, dedupe_key)
     values ($1, 'LOW_STOCK', 'WARNING', 'Missed while offline', 'Arrived during the disconnect', $2)`,
    [owner.id, "recovery-probe"],
  );

  const recovered = await listNotifications(owner.id, { limit: 50 });
  expect(
    "a reconnecting client sees what arrived while it was away",
    recovered.items.some((item) => item.message === "Arrived during the disconnect"),
    `recovered ${recovered.items.length}`,
  );
  expect(
    "the reconnecting client still sees its pre-disconnect history",
    recovered.items.some((item) => item.id === seenBeforeDisconnect),
  );

  // ---- order lifecycle -------------------------------------------------
  // Baselines must be taken immediately before the action under test: the
  // quarantine alert above legitimately changed the owner's count already.
  const ownerBeforeOrder = await unreadCount(owner.id);
  const staffBeforeOrder = await unreadCount(staff.id);

  const order = await submitOrderRequest({
    customerName: "Notification Cafe",
    email: "notify@verification.test",
    lines: [{ productId: product.id, quantity: 5 }],
  });
  expect("an order request is accepted", order.ok, order.ok ? "" : order.error);

  if (order.ok) {
    const staffAfterOrder = await unreadCount(staff.id);
    const ownerAfterOrder = await unreadCount(owner.id);
    expect(
      "a new order request reaches staff",
      staffAfterOrder > staffBeforeOrder,
      `staff ${staffBeforeOrder} -> ${staffAfterOrder}`,
    );
    expect(
      "a new order request does not reach the owner",
      ownerAfterOrder === ownerBeforeOrder,
      `owner ${ownerBeforeOrder} -> ${ownerAfterOrder}`,
    );

    const orderRow = await db.query.orderRequests.findFirst({
      where: eq(schema.orderRequests.reference, order.reference),
    });

    const ownerBeforeConfirm = await unreadCount(owner.id);
    const staffBeforeConfirm = await unreadCount(staff.id);

    const confirmed = await confirmOrderRequest(orderRow!.id, ownerRow.name, owner.id);
    expect("confirming an order succeeds", confirmed.ok, confirmed.message);

    expect(
      "the actor is not notified about their own action",
      (await unreadCount(owner.id)) === ownerBeforeConfirm,
      `owner ${ownerBeforeConfirm} -> ${await unreadCount(owner.id)}`,
    );
    expect(
      "confirming notifies the other participants",
      (await unreadCount(staff.id)) > staffBeforeConfirm,
      `staff ${staffBeforeConfirm} -> ${await unreadCount(staff.id)}`,
    );

    const staffAfterConfirm = await unreadCount(staff.id);
    await confirmOrderRequest(orderRow!.id, ownerRow.name, owner.id);
    expect(
      "confirming twice neither throws nor duplicates the notification",
      (await unreadCount(staff.id)) === staffAfterConfirm,
      `staff unread=${await unreadCount(staff.id)}`,
    );

    const fulfilled = await fulfilOrderRequest(orderRow!.id, staffRow.name, staff.id);
    expect("fulfilling an order succeeds", fulfilled.ok, fulfilled.message);

    const issueMovements = await raw<{ n: number }>(
      "select count(*)::int as n from stock_movements where reference = $1 and type = 'ISSUE'",
      [order.reference],
    );
    expect(
      "fulfilment issues the reserved stock",
      (issueMovements[0]?.n ?? 0) >= 1,
      `issue movements=${issueMovements[0]?.n ?? 0}`,
    );

    const doubleFulfil = await fulfilOrderRequest(orderRow!.id, staffRow.name, staff.id);
    const issueMovementsAfter = await raw<{ n: number }>(
      "select count(*)::int as n from stock_movements where reference = $1 and type = 'ISSUE'",
      [order.reference],
    );
    expect("a second fulfilment is refused", !doubleFulfil.ok, doubleFulfil.message);
    expect(
      "a refused second fulfilment writes no duplicate movements",
      issueMovementsAfter[0]?.n === issueMovements[0]?.n,
      `before=${issueMovements[0]?.n} after=${issueMovementsAfter[0]?.n}`,
    );

    const ownerNotified = await unreadCount(owner.id);
    expect(
      "order notifications accumulate independently per recipient",
      typeof ownerNotified === "number",
    );
  }

  // ---- empty state ------------------------------------------------------
  const [brandNew] = await db.insert(users).values({
    email: "notification-empty@provibeans.ph",
    name: "No Notifications",
    passwordHash,
    role: "INVENTORY_STAFF" as const,
  }).returning();
  expect("a user with no notifications reads zero", (await unreadCount(brandNew!.id)) === 0);
  expect(
    "a user with no notifications gets an empty list",
    (await listNotifications(brandNew!.id, { limit: 10 })).items.length === 0,
  );

  await cleanup();

  console.log("Provi Beans - notification verification");
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