import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { alerts, movements } from "@/lib/db/schema";
import type { Alert } from "@/lib/db/schema";
import { reconcileAlertNotifications } from "@/lib/notifications/service";
import { buildLotViews, productSummaries } from "./ledger";

export type AlertDraft = {
  type: Alert["type"];
  severity: Alert["severity"];
  productId: number | null;
  lotId: number | null;
  message: string;
};

async function currentAlerts(): Promise<Alert[]> {
  return db.select().from(alerts).where(isNull(alerts.resolvedAt));
}

function identity(alert: AlertDraft): string {
  return `${alert.type}:${alert.lotId ?? "product-${alert.productId}"}`;
}

async function resolveStale(existing: Alert[], active: Map<string, AlertDraft>) {
  const staleIds = existing.filter((alert) => !active.has(identity(alert))).map((alert) => alert.id);
  if (staleIds.length === 0) return 0;

  await db
    .update(alerts)
    .set({ resolvedAt: new Date().toISOString() })
    .where(inArray(alerts.id, staleIds));

  return staleIds.length;
}

/**
 * Recomputes the whole exception set from current stock.
 *
 * Alerts are derived state, never hand-written rows: every run re-derives what
 * is true, inserts what has newly become true, and resolves what has stopped
 * being true. That keeps the dashboard honest without anyone maintaining it.
 */
export async function evaluateAlerts(): Promise<{ raised: number; resolved: number }> {
  const drafts: AlertDraft[] = [];

  const summaries = await productSummaries();
  for (const summary of summaries) {
    if (summary.stockState === "REORDER") {
      drafts.push({
        type: "REORDER",
        severity: "WARNING",
        productId: summary.product.id,
        lotId: null,
        message: `${summary.product.sku} is at its reorder point: ${summary.available} available against a reorder point of ${summary.product.reorderPoint}.`,
      });
    } else if (summary.stockState === "LOW") {
      drafts.push({
        type: "LOW_STOCK",
        severity: "CRITICAL",
        productId: summary.product.id,
        lotId: null,
        message: `${summary.product.sku} is below its low-stock level: ${summary.available} available against a low-stock level of ${summary.product.lowStockLevel}.`,
      });
    }
  }

  const views = await buildLotViews();
  for (const view of views) {
    if (view.isExpired && view.onHand > 0) {
      drafts.push({
        type: "EXPIRED",
        severity: "CRITICAL",
        productId: view.product.id,
        lotId: view.lot.id,
        message: `Lot ${view.lot.code} expired ${Math.abs(view.daysToExpiry)} day(s) ago and still holds ${view.onHand} unit(s). It cannot be issued.`,
      });
    }

    if (view.isNearExpiry && view.available > 0) {
      drafts.push({
        type: "NEAR_EXPIRY",
        severity: "WARNING",
        productId: view.product.id,
        lotId: view.lot.id,
        message: `Lot ${view.lot.code} reaches its effective date in ${view.daysToExpiry} day(s). Issue it first.`,
      });
    }

    if (view.isQuarantined) {
      drafts.push({
        type: "QUARANTINE",
        severity: "WARNING",
        productId: view.product.id,
        lotId: view.lot.id,
        message: `Lot ${view.lot.code} is quarantined: ${view.lot.quarantineReason ?? "no reason recorded"}.`,
      });
    }
  }

  const variances = await db
    .select({
      id: movements.id,
      lotId: movements.lotId,
      productId: movements.productId,
      quantity: movements.quantity,
      createdAt: movements.createdAt,
    })
    .from(movements)
    .where(
      and(
        eq(movements.type, "COUNT"),
        sql`${movements.quantity} <> 0`,
        // Cutoff built in JS so it matches the stored ISO-8601 text shape; a SQL
        // date function would not compare correctly against it.
        sql`${movements.createdAt} >= ${new Date(Date.now() - 30 * 86_400_000).toISOString()}`,
      ),
    )
    // Newest first so that when several counts for one lot collapse onto a
    // single identity below, the most recent count is the one that survives.
    .orderBy(desc(movements.createdAt));

  for (const variance of variances) {
    drafts.push({
      type: "COUNT_VARIANCE",
      severity: "INFO",
      productId: variance.productId,
      lotId: variance.lotId,
      message: `Physical count on lot #${variance.lotId} found a variance of ${variance.quantity > 0 ? "+" : ""}${variance.quantity} unit(s) on ${variance.createdAt.slice(0, 10)}.`,
    });
  }

  const active = new Map(drafts.map((draft) => [identity(draft), draft]));
  // The apply phase runs inside a transaction holding an advisory lock, so two
  // overlapping evaluations cannot interleave "read what is open" with "resolve
  // what is no longer true". Without it, one run could resolve an alert another
  // had just opened from a fresher snapshot. The derivation above still runs
  // outside the lock, so the worst a loser can do is apply a slightly stale
  // view; the next evaluation converges it.
  const { raised, resolved } = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7834501)`);

    const existing = await tx
      .select()
      .from(alerts)
      .where(isNull(alerts.resolvedAt));
    const staleIds = existing.filter((alert) => !active.has(identity(alert))).map((a) => a.id);
    if (staleIds.length > 0) {
      await tx
        .update(alerts)
        .set({ resolvedAt: new Date().toISOString() })
        .where(inArray(alerts.id, staleIds));
    }

    const openIdentities = new Set(existing.map(identity));
    // From `active`, not `drafts`: several COUNT movements on one lot collapse
    // onto a single identity, and inserting the uncollapsed list would rely on
    // `alerts_open_unique` to discard duplicates whose surviving message would
    // then depend on which row the database happened to keep.
    const toInsert = [...active.values()].filter((draft) => !openIdentities.has(identity(draft)));

    const inserted =
      toInsert.length > 0
        ? await tx.insert(alerts).values(toInsert).onConflictDoNothing().returning({ id: alerts.id })
        : [];

    await reconcileAlertNotifications(tx);

    return { raised: inserted.length, resolved: staleIds.length };
  });

  return { raised, resolved };
}

/**
 * Every caller runs this after its business mutation has already committed, so
 * an escaping exception would report a successful stock movement as a failure.
 * Failures are therefore logged and swallowed; notification creation is a
 * reconciliation, so the next run repairs the gap instead of losing it.
 *
 * Returns whether the evaluation completed, because the daily sweep must not
 * treat a failed attempt as the day's work done.
 */
export async function evaluateAlertsSafely(): Promise<boolean> {
  try {
    await evaluateAlerts();
    return true;
  } catch (error) {
    console.error("[alerts] evaluation failed; notifications will retry on next run", error);
    return false;
  }
}

const sweepState = globalThis as unknown as { proviAlertSweepDay?: string };

/**
 * Expiry becomes true with the passage of time alone, so a client polling for
 * notifications must still discover a lot that expired overnight. Bounded to once
 * per calendar day per process to keep the full ledger fold off the poll path.
 */
export async function maybeRunDailySweep(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (sweepState.proviAlertSweepDay === today) return;
  // Recorded only on success: marking the day done before the work succeeds
  // would suppress every later attempt until tomorrow, hiding an overnight
  // expiry for the rest of the UTC day.
  if (await evaluateAlertsSafely()) sweepState.proviAlertSweepDay = today;
}

export async function openAlerts(): Promise<Alert[]> {
  return db
    .select()
    .from(alerts)
    .where(isNull(alerts.resolvedAt))
    .orderBy(sql`case ${alerts.severity} when 'CRITICAL' then 0 when 'WARNING' then 1 else 2 end`, alerts.id);
}

export async function resolveAlert(id: number, actorId: number | null, actorName: string) {
  await db
    .update(alerts)
    .set({ resolvedAt: new Date().toISOString() })
    .where(eq(alerts.id, id));
}

export async function alertCounts() {
  const rows = await db
    .select({
      severity: alerts.severity,
      count: sql<number>`count(*)`,
    })
    .from(alerts)
    .where(isNull(alerts.resolvedAt))
    .groupBy(alerts.severity);

  return {
    CRITICAL: rows.find((row) => row.severity === "CRITICAL")?.count ?? 0,
    WARNING: rows.find((row) => row.severity === "WARNING")?.count ?? 0,
    INFO: rows.find((row) => row.severity === "INFO")?.count ?? 0,
  };
}

export { or };