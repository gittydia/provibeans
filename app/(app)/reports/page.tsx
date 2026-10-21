"use client";

import {
  buildBatchViews,
  canViewReports,
  downloadCsv,
  useMockStore,
} from "@/lib/mock-store";
import {
  countVarianceRows,
  damagedDisposedRows,
  expiryRows,
  reorderRows,
  stockByProductRows,
} from "@/lib/inventory/reports";

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

const STOCK_STATE_LABEL = {
  OK: "In stock",
  REORDER: "At reorder point",
  LOW: "Low stock",
  EXPIRED_HOLD: "Expired stock held",
} as const;

const STOCK_STATE_BADGE = {
  OK: "badge-ok",
  REORDER: "badge-warn",
  LOW: "badge-crit",
  EXPIRED_HOLD: "badge-crit",
} as const;

export default function ReportsPage() {
  const { state, user } = useMockStore();
  if (!user) return null;

  if (!canViewReports(user.role)) {
    return (
      <section className="panel">
        <header>
          <h2>Inventory reports</h2>
          <p>Balances, exposure, and count history for purchasing and operations.</p>
        </header>
        <p className="notice notice-crit" role="note">
          Inventory reports are available to administrators and owners. Your role can still search the stock
          history from the day-to-day screens.
        </p>
      </section>
    );
  }

  const lotViews = buildBatchViews(state);
  const productRows = stockByProductRows(state);
  const reorder = reorderRows(state);
  const expiry = expiryRows(state);
  const damaged = damagedDisposedRows(state);
  const variances = countVarianceRows(state);

  return (
    <>
      <section className="panel">
        <header>
          <h2>Stock by product</h2>
          <p>
            {productRows.length} product{productRows.length === 1 ? "" : "s"} ·{" "}
            <button
              type="button"
              className="notif-link"
              onClick={() =>
                downloadCsv("provi-beans-stock-by-product.csv", [
                  ["SKU", "Product", "On hand", "Reserved", "Available", "Reorder point", "Inventory value", "State"],
                  ...productRows.map((row) => [
                    row.sku,
                    row.name,
                    row.onHand,
                    row.reserved,
                    row.available,
                    row.reorderPoint,
                    row.inventoryValue,
                    STOCK_STATE_LABEL[row.stockState],
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          </p>
        </header>
        {productRows.length === 0 ? (
          <p className="empty">No products recorded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Product</th>
                <th scope="col" className="num">On hand</th>
                <th scope="col" className="num">Reserved</th>
                <th scope="col" className="num">Available</th>
                <th scope="col" className="num">Reorder pt</th>
                <th scope="col" className="num">Value</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map((row) => (
                <tr key={row.sku}>
                  <td className="code">{row.sku}</td>
                  <td>{row.name}</td>
                  <td className="num">{row.onHand}</td>
                  <td className="num">{row.reserved}</td>
                  <td className="num">{row.available}</td>
                  <td className="num">{row.reorderPoint}</td>
                  <td className="num">{peso(row.inventoryValue)}</td>
                  <td>
                    <span className={`badge ${STOCK_STATE_BADGE[row.stockState]}`}>
                      {STOCK_STATE_LABEL[row.stockState]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Stock by batch</h2>
          <p>
            Balances, with the date that decides what to issue first.{" "}
            <button
              type="button"
              className="notif-link"
              onClick={() =>
                downloadCsv("provi-beans-stock-by-batch.csv", [
                  ["Batch", "SKU", "Received", "Roasted", "Packed", "Best before", "Expires", "In stock", "Available"],
                  ...lotViews.map((view) => [
                    view.batch.code,
                    view.product.sku,
                    view.batch.receivedAt.slice(0, 10),
                    view.batch.roastDate,
                    view.batch.packDate,
                    view.batch.bestBeforeDate,
                    view.batch.expiryDate,
                    view.onHand,
                    view.available,
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          </p>
        </header>
        {lotViews.length === 0 ? (
          <p className="empty">No batches recorded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Batch</th>
                <th scope="col">SKU</th>
                <th scope="col">Received</th>
                <th scope="col">Roasted</th>
                <th scope="col">Packed</th>
                <th scope="col">Best before</th>
                <th scope="col">Expires</th>
                <th scope="col" className="num">In stock</th>
                <th scope="col" className="num">Available</th>
              </tr>
            </thead>
            <tbody>
              {lotViews.map((view) => (
                <tr key={view.batch.id}>
                  <td className="code">{view.batch.code}</td>
                  <td>{view.product.sku}</td>
                  <td className="muted">{view.batch.receivedAt.slice(0, 10)}</td>
                  <td className="muted">{view.batch.roastDate ?? "—"}</td>
                  <td className="muted">{view.batch.packDate ?? "—"}</td>
                  <td className="muted">{view.batch.bestBeforeDate ?? "—"}</td>
                  <td className="muted">{view.batch.expiryDate ?? "—"}</td>
                  <td className="num">{view.onHand}</td>
                  <td className="num">{view.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Reorder list</h2>
          <p>
            Products at or below their reorder point, largest shortfall first.{" "}
            <button
              type="button"
              className="notif-link"
              onClick={() =>
                downloadCsv("provi-beans-reorder-list.csv", [
                  ["SKU", "Product", "Available", "Reorder point", "Shortfall", "Low-stock level"],
                  ...reorder.map((row) => [row.sku, row.name, row.available, row.reorderPoint, row.shortfall, row.lowStockLevel]),
                ])
              }
            >
              Export CSV
            </button>
          </p>
        </header>
        {reorder.length === 0 ? (
          <p className="empty">Every product is above its reorder point.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Product</th>
                <th scope="col" className="num">Available</th>
                <th scope="col" className="num">Reorder pt</th>
                <th scope="col" className="num">Shortfall</th>
                <th scope="col" className="num">Low-stock level</th>
              </tr>
            </thead>
            <tbody>
              {reorder.map((row) => (
                <tr key={row.sku}>
                  <td className="code">{row.sku}</td>
                  <td>{row.name}</td>
                  <td className="num">{row.available}</td>
                  <td className="num">{row.reorderPoint}</td>
                  <td className="num">{row.shortfall}</td>
                  <td className="num">{row.lowStockLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Near-expiry and expired lots</h2>
          <p>
            Lots that still hold stock and are close to, or past, their use-by date.{" "}
            <button
              type="button"
              className="notif-link"
              onClick={() =>
                downloadCsv("provi-beans-expiry-exposure.csv", [
                  ["Batch", "SKU", "Product", "State", "Use-by", "Days", "On hand", "Available"],
                  ...expiry.map((row) => [
                    row.batchCode,
                    row.sku,
                    row.productName,
                    row.state === "EXPIRED" ? "Expired" : "Near expiry",
                    row.effectiveDate,
                    row.daysToExpiry,
                    row.onHand,
                    row.available,
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          </p>
        </header>
        {expiry.length === 0 ? (
          <p className="empty">No lot is near or past its use-by date.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Batch</th>
                <th scope="col">SKU</th>
                <th scope="col">Product</th>
                <th scope="col">State</th>
                <th scope="col">Use-by</th>
                <th scope="col" className="num">Days</th>
                <th scope="col" className="num">On hand</th>
                <th scope="col" className="num">Available</th>
              </tr>
            </thead>
            <tbody>
              {expiry.map((row) => (
                <tr key={row.batchCode}>
                  <td className="code">{row.batchCode}</td>
                  <td>{row.sku}</td>
                  <td>{row.productName}</td>
                  <td>
                    <span className={`badge ${row.state === "EXPIRED" ? "badge-crit" : "badge-warn"}`}>
                      {row.state === "EXPIRED" ? "Expired" : "Near expiry"}
                    </span>
                  </td>
                  <td className="muted">{row.effectiveDate}</td>
                  <td className="num">{row.daysToExpiry}</td>
                  <td className="num">{row.onHand}</td>
                  <td className="num">{row.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Damaged and disposed stock</h2>
          <p>
            Every unit written off by batch, as recorded in the ledger.{" "}
            <button
              type="button"
              className="notif-link"
              onClick={() =>
                downloadCsv("provi-beans-damaged-disposed.csv", [
                  ["Batch", "SKU", "Damaged", "Disposed", "Last change"],
                  ...damaged.map((row) => [row.batchCode, row.sku, row.damaged, row.disposed, row.lastMovementAt]),
                ])
              }
            >
              Export CSV
            </button>
          </p>
        </header>
        {damaged.length === 0 ? (
          <p className="empty">No damaged or disposed stock recorded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Batch</th>
                <th scope="col">SKU</th>
                <th scope="col" className="num">Damaged</th>
                <th scope="col" className="num">Disposed</th>
                <th scope="col">Last change</th>
              </tr>
            </thead>
            <tbody>
              {damaged.map((row) => (
                <tr key={row.batchCode}>
                  <td className="code">{row.batchCode}</td>
                  <td>{row.sku}</td>
                  <td className="num">{row.damaged}</td>
                  <td className="num">{row.disposed}</td>
                  <td className="faint">{row.lastMovementAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Physical count variances</h2>
          <p>
            Each reconciliation, the counted quantity, and what it changed.{" "}
            <button
              type="button"
              className="notif-link"
              onClick={() =>
                downloadCsv("provi-beans-count-variances.csv", [
                  ["When", "Counted by", "Batch", "Counted quantity", "Variance"],
                  ...variances.map((row) => [row.createdAt, row.actorName, row.batchCode, row.countedQuantity, row.variance]),
                ])
              }
            >
              Export CSV
            </button>
          </p>
        </header>
        {variances.length === 0 ? (
          <p className="empty">No physical counts recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Counted by</th>
                <th scope="col">Batch</th>
                <th scope="col" className="num">Counted</th>
                <th scope="col" className="num">Variance</th>
              </tr>
            </thead>
            <tbody>
              {variances.map((row, index) => (
                <tr key={`${row.createdAt}-${row.batchCode}-${index}`}>
                  <td className="faint">{row.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{row.actorName}</td>
                  <td className="code">{row.batchCode}</td>
                  <td className="num">{row.countedQuantity}</td>
                  <td className="num">{row.variance > 0 ? `+${row.variance}` : row.variance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
