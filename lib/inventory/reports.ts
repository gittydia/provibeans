import {
  buildBatchViews,
  productSummaries,
  type MockState,
} from "@/lib/mock-store";

/* Derived report rows. Nothing here is stored: every figure is recomputed from
   the movement ledger so a report can never drift from the stock balances. */

export type StockByProductRow = {
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  lowStockLevel: number;
  inventoryValue: number;
  stockState: "OK" | "REORDER" | "LOW" | "EXPIRED_HOLD";
};

function normalizeStockState(value: string): StockByProductRow["stockState"] {
  if (value === "REORDER" || value === "LOW" || value === "EXPIRED_HOLD") return value;
  return "OK";
}

export function stockByProductRows(state: MockState): StockByProductRow[] {
  return productSummaries(state).map((summary): StockByProductRow => ({
    sku: summary.product.sku,
    name: summary.product.name,
    onHand: summary.onHand,
    reserved: summary.reserved,
    available: summary.available,
    reorderPoint: summary.product.reorderPoint,
    lowStockLevel: summary.product.lowStockLevel,
    inventoryValue: summary.inventoryValue,
    stockState: normalizeStockState(summary.stockState),
  }));
}

export type ReorderRow = StockByProductRow & { shortfall: number };

export function reorderRows(state: MockState): ReorderRow[] {
  return stockByProductRows(state)
    .filter((row) => row.available <= row.reorderPoint)
    .map((row) => ({ ...row, shortfall: Math.max(0, row.reorderPoint - row.available) }))
    .sort((left, right) => right.shortfall - left.shortfall || left.sku.localeCompare(right.sku));
}

export type ExpiryRow = {
  batchCode: string;
  sku: string;
  productName: string;
  state: "EXPIRED" | "NEAR_EXPIRY";
  effectiveDate: string;
  daysToExpiry: number;
  onHand: number;
  available: number;
};

export function expiryRows(state: MockState): ExpiryRow[] {
  return buildBatchViews(state)
    .filter((view) => (view.isExpired || view.isNearExpiry) && view.onHand > 0)
    .map((view): ExpiryRow => ({
      batchCode: view.batch.code,
      sku: view.product.sku,
      productName: view.product.name,
      state: view.isExpired ? "EXPIRED" : "NEAR_EXPIRY",
      effectiveDate: view.effectiveDate,
      daysToExpiry: view.daysToExpiry,
      onHand: view.onHand,
      available: view.available,
    }))
    .sort((left, right) => left.daysToExpiry - right.daysToExpiry || left.batchCode.localeCompare(right.batchCode));
}

export type DamagedDisposedRow = {
  batchCode: string;
  sku: string;
  damaged: number;
  disposed: number;
  lastMovementAt: string;
};

export function damagedDisposedRows(state: MockState): DamagedDisposedRow[] {
  const rows = new Map<number, DamagedDisposedRow>();
  for (const movement of state.movements) {
    if (movement.type !== "DAMAGE" && movement.type !== "DISPOSE") continue;
    const batch = state.batches.find((entry) => entry.id === movement.batchId);
    const product = state.products.find((entry) => entry.id === movement.productId);
    if (!batch || !product) continue;
    const row = rows.get(batch.id) ?? {
      batchCode: batch.code,
      sku: product.sku,
      damaged: 0,
      disposed: 0,
      lastMovementAt: movement.createdAt,
    };
    if (movement.type === "DAMAGE") row.damaged += movement.quantity;
    else row.disposed += movement.quantity;
    if (movement.createdAt > row.lastMovementAt) row.lastMovementAt = movement.createdAt;
    rows.set(batch.id, row);
  }
  return [...rows.values()].sort(
    (left, right) => right.lastMovementAt.localeCompare(left.lastMovementAt) || left.batchCode.localeCompare(right.batchCode),
  );
}

export type CountVarianceRow = {
  createdAt: string;
  actorName: string;
  batchCode: string;
  countedQuantity: number;
  variance: number;
};

/* A count's recorded movement carries only the variance, so the counted
   quantity and the person who reconciled it are read from the audit entry the
   same transaction wrote. Entries that cannot be parsed are skipped rather than
   shown with invented figures. */
export function countVarianceRows(state: MockState): CountVarianceRow[] {
  const rows: CountVarianceRow[] = [];
  for (const entry of state.audit) {
    if (entry.action !== "COUNT" || !entry.after) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(entry.after);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const record = parsed as Record<string, unknown>;
    const countedQuantity = record.countedQuantity;
    const variance = record.variance;
    if (typeof countedQuantity !== "number" || typeof variance !== "number") continue;
    rows.push({
      createdAt: entry.createdAt,
      actorName: entry.actorName,
      batchCode: entry.entityId ?? "—",
      countedQuantity,
      variance,
    });
  }
  return rows.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.batchCode.localeCompare(right.batchCode));
}
