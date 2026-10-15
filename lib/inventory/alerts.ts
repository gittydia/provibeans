import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { alerts, movements } from "@/lib/db/schema";
import type { Alert } from "@/lib/db/schema";
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
  const stale = existing.filter((alert) => !active.has(identity(alert)));
  if (stale.length === 0) return 0;

  const now = new Date().toISOString();
  for (const alert of stale) {
    await db
      .update(alerts)
      .set({ resolvedAt: now })
      .where(eq(alerts.id, alert.id));
  }
  return stale.length;
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
    );

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
  const existing = await currentAlerts();
  const resolved = await resolveStale(existing, active);

  const existingIdentities = new Set(existing.filter((a) => !a.resolvedAt).map(identity));
  const toInsert = drafts.filter((draft) => !existingIdentities.has(identity(draft)));

  if (toInsert.length > 0) {
    await db.insert(alerts).values(toInsert);
  }

  return { raised: toInsert.length, resolved };
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