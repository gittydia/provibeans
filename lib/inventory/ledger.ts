import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { lots, movements, products } from "@/lib/db/schema";
import type { Lot, MovementType, Product } from "@/lib/db/schema";

/**
 * How each movement type moves the two separate balances.
 *
 * onHand   physical units present, regardless of whether they may be issued
 * reserved units committed to an approved request but not yet released
 *
 * Quarantine is deliberately absent from both: quarantining is a status
 * transition on the lot, not a change in how much stock physically exists.
 * It removes the units from `available` without pretending they vanished.
 */
export const ON_HAND_EFFECT: Partial<Record<MovementType, -1 | 1>> = {
  RECEIPT: 1,
  ISSUE: -1,
  RETURN: 1,
  DAMAGE: -1,
  DISPOSE: -1,
  ADJUSTMENT: 1,
  COUNT: 1,
};

export const RESERVED_EFFECT: Partial<Record<MovementType, -1 | 1>> = {
  RESERVE: 1,
  RELEASE: -1,
  CANCEL: -1,
};

export type LotBalance = {
  onHand: number;
  reserved: number;
};

export async function balancesForLots(lotIds: number[]): Promise<Map<number, LotBalance>> {
  const result = new Map<number, LotBalance>();
  if (lotIds.length === 0) return result;

  for (const id of lotIds) result.set(id, { onHand: 0, reserved: 0 });

  const rows = await db
    .select({
      lotId: movements.lotId,
      type: movements.type,
      quantity: movements.quantity,
    })
    .from(movements)
    .where(inArray(movements.lotId, lotIds));

  for (const row of rows) {
    const entry = result.get(row.lotId);
    if (!entry) continue;

    const onHandEffect = ON_HAND_EFFECT[row.type];
    if (onHandEffect !== undefined) {
      entry.onHand += onHandEffect * row.quantity;
      continue;
    }

    const reservedEffect = RESERVED_EFFECT[row.type];
    if (reservedEffect !== undefined) {
      entry.reserved += reservedEffect * row.quantity;
    }
  }

  return result;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** FEFO reads expiry first, then best-before, then falls back to receipt date. */
export function effectiveDate(lot: Lot): string {
  return lot.expiryDate ?? lot.bestBeforeDate ?? lot.receivedAt.slice(0, 10);
}

export type LotView = {
  lot: Lot;
  product: Product;
  onHand: number;
  reserved: number;
  available: number;
  effectiveDate: string;
  daysToExpiry: number;
  isExpired: boolean;
  isNearExpiry: boolean;
  isQuarantined: boolean;
  isIssuable: boolean;
};

export async function buildLotViews(
  lotFilter?: { productId?: number; status?: Lot["status"][] },
): Promise<LotView[]> {
  const conditions = [];
  if (lotFilter?.productId !== undefined) conditions.push(eq(lots.productId, lotFilter.productId));
  if (lotFilter?.status && lotFilter.status.length > 0) {
    conditions.push(inArray(lots.status, lotFilter.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({ lot: lots, product: products })
    .from(lots)
    .innerJoin(products, eq(lots.productId, products.id))
    .where(where)
    .orderBy(asc(lots.code));

  const balances = await balancesForLots(rows.map((row) => row.lot.id));
  const now = today();

  return rows.map(({ lot, product }) => {
    const { onHand, reserved } = balances.get(lot.id) ?? { onHand: 0, reserved: 0 };
    const eff = effectiveDate(lot);
    const daysToExpiry = daysBetween(now, eff);
    const isExpired = daysToExpiry < 0;
    const isNearExpiry = !isExpired && daysToExpiry <= product.nearExpiryDays;
    const isQuarantined = lot.status === "QUARANTINE";
    const isIssuable = lot.status === "ACTIVE" && !isExpired;

    return {
      lot,
      product,
      onHand,
      reserved,
      available: isIssuable ? Math.max(0, onHand - reserved) : 0,
      effectiveDate: eff,
      daysToExpiry,
      isExpired,
      isNearExpiry,
      isQuarantined,
      isIssuable,
    };
  });
}

export type FefoSuggestion = {
  lotId: number;
  lotCode: string;
  productId: number;
  effectiveDate: string;
  daysToExpiry: number;
  available: number;
};

/**
 * First-Expired, First-Out. Returns the lots that may legally be issued for a
 * product, ordered by their effective date so the caller can allocate greedily.
 * Expired and quarantined lots are excluded rather than filtered later, so an
 * operator can never accidentally pick one from a stale list.
 */
export async function fefoPlan(productId: number): Promise<FefoSuggestion[]> {
  const views = await buildLotViews({ productId });

  return views
    .filter((view) => view.isIssuable && view.available > 0)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
    .map((view) => ({
      lotId: view.lot.id,
      lotCode: view.lot.code,
      productId,
      effectiveDate: view.effectiveDate,
      daysToExpiry: view.daysToExpiry,
      available: view.available,
    }));
}

export type FefoAllocation = {
  lotId: number;
  lotCode: string;
  quantity: number;
  effectiveDate: string;
};

/**
 * Allocate a requested quantity across lots in FEFO order.
 * Returns the shortfall when the valid stock cannot cover the request.
 */
export async function allocateFefo(
  productId: number,
  quantity: number,
): Promise<{ allocations: FefoAllocation[]; shortfall: number }> {
  const plan = await fefoPlan(productId);
  const allocations: FefoAllocation[] = [];
  let remaining = quantity;

  for (const suggestion of plan) {
    if (remaining <= 0) break;
    const take = Math.min(suggestion.available, remaining);
    if (take <= 0) continue;
    allocations.push({
      lotId: suggestion.lotId,
      lotCode: suggestion.lotCode,
      quantity: take,
      effectiveDate: suggestion.effectiveDate,
    });
    remaining -= take;
  }

  return { allocations, shortfall: Math.max(0, remaining) };
}

export type ProductSummary = {
  product: Product;
  onHand: number;
  reserved: number;
  available: number;
  inventoryValue: number;
  lotCount: number;
  nextExpiry: string | null;
  stockState: "OK" | "LOW" | "REORDER" | "EXPIRED_HOLD";
};

export async function productSummaries(): Promise<ProductSummary[]> {
  const productRows = await db.select().from(products).orderBy(asc(products.sku));
  const views = await buildLotViews();

  return productRows.map((product) => {
    const own = views.filter((view) => view.lot.productId === product.id);
    const onHand = own.reduce((sum, view) => sum + view.onHand, 0);
    const reserved = own.reduce((sum, view) => sum + view.reserved, 0);
    const available = own.reduce((sum, view) => sum + view.available, 0);

    const liveExpiry = own
      .filter((view) => view.isIssuable && view.available > 0)
      .map((view) => view.effectiveDate)
      .sort()[0] ?? null;

    const hasExpiredHold = own.some((view) => view.isExpired && view.onHand > 0);

    let stockState: ProductSummary["stockState"] = "OK";
    if (hasExpiredHold) stockState = "EXPIRED_HOLD";
    else if (available <= product.lowStockLevel) stockState = "LOW";
    else if (available <= product.reorderPoint) stockState = "REORDER";

    return {
      product,
      onHand,
      reserved,
      available,
      inventoryValue: onHand * product.unitPrice,
      lotCount: own.length,
      nextExpiry: liveExpiry,
      stockState,
    };
  });
}

export async function recentMovements(limit = 25) {
  return db
    .select()
    .from(movements)
    .orderBy(desc(movements.createdAt), desc(movements.id))
    .limit(limit);
}

export async function auditSummary() {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(movements);
  return row?.total ?? 0;
}