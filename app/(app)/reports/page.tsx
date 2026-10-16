"use client";

import Link from "next/link";
import { MOVEMENT_LABELS, buildBatchViews, canViewReports, downloadCsv, useMockStore, type MovementType } from "@/lib/mock-store";

const MOVEMENT_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All movement types" },
  { value: "RECEIPT", label: "Receipts" },
  { value: "ISSUE", label: "Issues" },
  { value: "RESERVE", label: "Reservations" },
  { value: "RELEASE", label: "Releases" },
  { value: "CANCEL", label: "Cancellations" },
  { value: "RETURN", label: "Returns" },
  { value: "DAMAGE", label: "Damage" },
  { value: "QUARANTINE", label: "Quarantine" },
  { value: "DISPOSE", label: "Disposals" },
  { value: "ADJUSTMENT", label: "Adjustments" },
  { value: "COUNT", label: "Counts" },
];

export default function ReportsPage() {
  const { state, user, hydrated } = useMockStore();
  if (!user) return null;
  const searchParams = hydrated ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const filters = { type: searchParams.get("type") ?? "", from: searchParams.get("from") ?? "", to: searchParams.get("to") ?? "" };
  const from = filters.from ? new Date(filters.from).toISOString() : null;
  const toDate = filters.to ? new Date(filters.to) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);
  const movementRows = [...state.movements]
    .filter((movement) => !filters.type || movement.type === filters.type as MovementType)
    .filter((movement) => !from || movement.createdAt >= from)
    .filter((movement) => !toDate || movement.createdAt <= toDate.toISOString())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .slice(0, 200)
    .flatMap((movement) => {
      const batch = state.batches.find((entry) => entry.id === movement.batchId);
      const product = state.products.find((entry) => entry.id === movement.productId);
      return batch && product ? [{ movement, batchCode: batch.code, productSku: product.sku }] : [];
    });
  const lotViews = buildBatchViews(state);
  const activity = [...state.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports &amp; activity</h1>
          <p>
            The movement ledger is append-only. Corrections are recorded as reversals, so the history of what
            happened always stays readable.
          </p>
        </div>
        <Link className="btn" href="/reports/periods">
          Periodic reports
        </Link>
      </div>

      <section className="panel">
        <header>
          <h2>Stock by batch</h2>
          <p>Derived balances with the date that drives FEFO.</p>
        </header>
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
              <th scope="col" className="num">On hand</th>
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
      </section>

      <section className="panel">
        <header>
          <h2>Movement history</h2>
          <p>
            {movementRows.length} entr{movementRows.length === 1 ? "y" : "ies"}
            {canViewReports(user.role) ? (
              <>
                {" · "}
                <button type="button" className="notif-link" onClick={() => downloadCsv("provi-beans-movements.csv", [
                  ["When", "Type", "Batch", "SKU", "Quantity", "Reason", "Reference", "Reverses"],
                  ...movementRows.map(({ movement, batchCode, productSku }) => [movement.createdAt, MOVEMENT_LABELS[movement.type], batchCode, productSku, movement.quantity, movement.reason, movement.reference, movement.reversesId]),
                ])}>
                  Export CSV
                </button>
              </>
            ) : null}
          </p>
        </header>

        <form className="panel-body" method="get">
          <div className="form-grid">
            <label className="field" htmlFor="type">
              <span>Movement type</span>
              <select id="type" name="type" defaultValue={filters.type}>
                {MOVEMENT_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="from">
              <span>From</span>
              <input id="from" type="date" name="from" defaultValue={filters.from} />
            </label>

            <label className="field" htmlFor="to">
              <span>To</span>
              <input id="to" type="date" name="to" defaultValue={filters.to} />
            </label>
          </div>

          <div className="actions">
            <button type="submit" className="btn btn-quiet">
              Apply filters
            </button>
            <Link href="/reports" className="btn btn-quiet">
              Clear
            </Link>
          </div>
        </form>

        <table>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Type</th>
              <th scope="col">Batch</th>
              <th scope="col">SKU</th>
              <th scope="col" className="num">Qty</th>
              <th scope="col">Reason</th>
              <th scope="col">Reference</th>
              <th scope="col">Reverses</th>
            </tr>
          </thead>
          <tbody>
            {movementRows.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <p className="empty">No movements match those filters.</p>
                </td>
              </tr>
            ) : (
              movementRows.map(({ movement, batchCode, productSku }) => (
                <tr key={movement.id}>
                  <td className="faint">{movement.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{MOVEMENT_LABELS[movement.type]}</td>
                  <td className="code">{batchCode}</td>
                  <td>{productSku}</td>
                  <td className="num">{movement.quantity}</td>
                  <td className="muted">{movement.reason ?? "—"}</td>
                  <td className="code">{movement.reference ?? "—"}</td>
                  <td className="code muted">
                    {movement.reversesId ? `#${movement.reversesId}` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <header>
          <h2>Activity log</h2>
          <p>Who acted, when, and on what.</p>
        </header>
        {activity.length === 0 ? (
          <p className="empty">No activity recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Reference</th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((entry) => (
                <tr key={entry.id}>
                  <td className="faint">{entry.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{entry.actorName}</td>
                  <td>{entry.action}</td>
                  <td className="muted">
                    {entry.entity}
                    {entry.entityId ? ` ${entry.entityId}` : ""}
                  </td>
                  <td className="code">{entry.entityId ?? "—"}</td>
                  <td className="faint">{entry.after ?? entry.before ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
