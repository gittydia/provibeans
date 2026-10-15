import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { lots, movements, products } from "@/lib/db/schema";
import type { MovementType } from "@/lib/db/schema";
import { ON_HAND_EFFECT, RESERVED_EFFECT } from "./ledger";

export type PeriodGranularity = "week" | "month" | "year";

export type Period = {
  granularity: PeriodGranularity;
  start: Date;
  end: Date;
  label: string;
  key: string;
};

const DAY = 86_400_000;

/**
 * Resolves the period containing `anchor`. Every boundary is UTC because
 * `created_at` is stored as an ISO timestamp, and a local-midnight boundary would
 * silently drop or double-count movements either side of midnight.
 */
export function resolvePeriod(granularity: PeriodGranularity, anchor: Date): Period {
  if (granularity === "week") {
    const start = startOfIsoWeek(anchor);
    const end = new Date(start.getTime() + 7 * DAY - 1);
    const { week, year } = isoWeekParts(start);
    return {
      granularity,
      start,
      end,
      label: `Week ${week}, ${year}`,
      key: `${year}-W${String(week).padStart(2, "0")}`,
    };
  }

  if (granularity === "month") {
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1) - 1);
    const name = start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    return { granularity, start, end, label: `${name} ${year}`, key: `${year}-${String(month + 1).padStart(2, "0")}` };
  }

  const year = anchor.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1) - 1);
  return { granularity, start, end, label: String(year), key: String(year) };
}

/** The same period shifted forwards or backwards by `steps`. */
export function shiftPeriod(period: Period, steps: number): Period {
  const anchor = new Date(period.start.getTime() + steps * periodLength(period));
  return resolvePeriod(period.granularity, anchor);
}

function periodLength(period: Period): number {
  if (period.granularity === "week") return 7 * DAY;
  if (period.granularity === "month") return period.end.getTime() - period.start.getTime() + 1;
  return period.end.getTime() - period.start.getTime() + 1;
}

function startOfIsoWeek(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay();
  day.setUTCDate(day.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return day;
}

function isoWeekParts(monday: Date): { week: number; year: number } {
  const thursday = new Date(monday.getTime() + 3 * DAY);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(startOfIsoWeek(new Date(Date.UTC(year, 0, 4))));
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY));
  return { week, year };
}

export type PeriodTotals = {
  received: number;
  issued: number;
  returned: number;
  damaged: number;
  disposed: number;
  adjusted: number;
  counted: number;
  reserved: number;
  released: number;
  cancelled: number;
  quarantined: number;
  unquarantined: number;
  movementCount: number;
  netOnHand: number;
  netReserved: number;
};

export type ProductLine = {
  sku: string;
  name: string;
  received: number;
  issued: number;
  returned: number;
  damaged: number;
  disposed: number;
  netOnHand: number;
};

export type PeriodReport = {
  period: Period;
  openingOnHand: number;
  openingReserved: number;
  closingOnHand: number;
  closingReserved: number;
  totals: PeriodTotals;
  byProduct: ProductLine[];
};

type Row = {
  type: MovementType;
  quantity: number;
  createdAt: string;
  sku: string;
  name: string;
};

function emptyTotals(): PeriodTotals {
  return {
    received: 0,
    issued: 0,
    returned: 0,
    damaged: 0,
    disposed: 0,
    adjusted: 0,
    counted: 0,
    reserved: 0,
    released: 0,
    cancelled: 0,
    quarantined: 0,
    unquarantined: 0,
    movementCount: 0,
    netOnHand: 0,
    netReserved: 0,
  };
}

function apply(totals: PeriodTotals, row: Row): void {
  const qty = row.quantity;
  switch (row.type) {
    case "RECEIPT": totals.received += qty; break;
    case "ISSUE": totals.issued += qty; break;
    case "RETURN": totals.returned += qty; break;
    case "DAMAGE": totals.damaged += qty; break;
    case "DISPOSE": totals.disposed += qty; break;
    case "ADJUSTMENT": totals.adjusted += qty; break;
    case "COUNT": totals.counted += qty; break;
    case "RESERVE": totals.reserved += qty; break;
    case "RELEASE": totals.released += qty; break;
    case "CANCEL": totals.cancelled += qty; break;
    case "QUARANTINE": totals.quarantined += qty; break;
    case "UNQUARANTINE": totals.unquarantined += qty; break;
  }

  const onHandEffect = ON_HAND_EFFECT[row.type];
  if (onHandEffect !== undefined) totals.netOnHand += onHandEffect * qty;

  const reservedEffect = RESERVED_EFFECT[row.type];
  if (reservedEffect !== undefined) totals.netReserved += reservedEffect * qty;

  totals.movementCount += 1;
}

export async function buildPeriodReport(period: Period): Promise<PeriodReport> {
  const from = period.start.toISOString();
  const to = period.end.toISOString();

  const [prior, current] = await Promise.all([
    db
      .select({ type: movements.type, quantity: movements.quantity })
      .from(movements)
      .where(lte(movements.createdAt, from)),
    db
      .select({
        type: movements.type,
        quantity: movements.quantity,
        createdAt: movements.createdAt,
        sku: products.sku,
        name: products.name,
      })
      .from(movements)
      .innerJoin(lots, eq(movements.lotId, lots.id))
      .innerJoin(products, eq(movements.productId, products.id))
      .where(and(gte(movements.createdAt, from), lte(movements.createdAt, to)))
      .orderBy(movements.createdAt, movements.id),
  ]);

  let openingOnHand = 0;
  let openingReserved = 0;
  for (const row of prior) {
    const onHandEffect = ON_HAND_EFFECT[row.type];
    if (onHandEffect !== undefined) openingOnHand += onHandEffect * row.quantity;
    const reservedEffect = RESERVED_EFFECT[row.type];
    if (reservedEffect !== undefined) openingReserved += reservedEffect * row.quantity;
  }

  const totals = emptyTotals();
  const byProduct = new Map<string, ProductLine>();

  for (const row of current as Row[]) {
    apply(totals, row);

    let line = byProduct.get(row.sku);
    if (!line) {
      line = { sku: row.sku, name: row.name, received: 0, issued: 0, returned: 0, damaged: 0, disposed: 0, netOnHand: 0 };
      byProduct.set(row.sku, line);
    }
    if (row.type === "RECEIPT") line.received += row.quantity;
    if (row.type === "ISSUE") line.issued += row.quantity;
    if (row.type === "RETURN") line.returned += row.quantity;
    if (row.type === "DAMAGE") line.damaged += row.quantity;
    if (row.type === "DISPOSE") line.disposed += row.quantity;

    const onHandEffect = ON_HAND_EFFECT[row.type];
    if (onHandEffect !== undefined) line.netOnHand += onHandEffect * row.quantity;
  }

  return {
    period,
    openingOnHand,
    openingReserved,
    closingOnHand: openingOnHand + totals.netOnHand,
    closingReserved: openingReserved + totals.netReserved,
    totals,
    byProduct: [...byProduct.values()].sort((a, b) => a.sku.localeCompare(b.sku)),
  };
}

export function periodCoverage(period: Period): string {
  const format = (date: Date) =>
    date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return `${format(period.start)} – ${format(period.end)}`;
}

/**
 * Anchor to carry over when the reader switches granularity. Clamping "now" rather
 * than using `period.start` matters: ISO week 1 begins on 29 December of the previous
 * year, so a naive start-date would resolve that week to the previous, empty year.
 */
export function switchAnchor(period: Period, now: Date = new Date()): Date {
  const clamped = Math.min(Math.max(now.getTime(), period.start.getTime()), period.end.getTime());
  return new Date(clamped);
}