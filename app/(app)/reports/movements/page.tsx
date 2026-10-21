"use client";

import Link from "next/link";
import { MOVEMENT_LABELS, canViewReports, downloadCsv, useMockStore, type MovementType } from "@/lib/mock-store";

const MOVEMENT_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All change types" },
  { value: "RECEIPT", label: "Receipts" },
  { value: "ISSUE", label: "Issues" },
  { value: "RESERVE", label: "Reservations" },
  { value: "RELEASE", label: "Releases" },
  { value: "CANCEL", label: "Cancellations" },
  { value: "RETURN", label: "Returns" },
  { value: "DAMAGE", label: "Damage" },
  { value: "QUARANTINE", label: "Quarantine" },
  { value: "UNQUARANTINE", label: "Quarantine releases" },
  { value: "DISPOSE", label: "Disposals" },
  { value: "ADJUSTMENT", label: "Adjustments" },
  { value: "COUNT", label: "Counts" },
];

export default function MovementHistoryPage() {
  const { state, user, hydrated } = useMockStore();
  if (!user) return null;

  if (!canViewReports(user.role)) {
    return (
      <section className="panel">
        <header>
          <h2>Stock history</h2>
          <p>The append-only ledger of every stock change.</p>
        </header>
        <p className="notice notice-crit" role="note">
          The full stock history is available to administrators and owners. Record your own stock changes from
          the issue and movement screens.
        </p>
      </section>
    );
  }

  const searchParams = hydrated ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const filters = {
    type: searchParams.get("type") ?? "",
    product: searchParams.get("product") ?? "",
    q: searchParams.get("q") ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  };
  const from = filters.from ? new Date(filters.from).toISOString() : null;
  const toDate = filters.to ? new Date(filters.to) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);
  const needle = filters.q.trim().toLowerCase();

  /* Every match is reported. A cap here used to silently drop older movements
     from both the screen and the export, which made the ledger lie. */
  const movementRows = [...state.movements]
    .filter((movement) => !filters.type || movement.type === (filters.type as MovementType))
    .filter((movement) => !from || movement.createdAt >= from)
    .filter((movement) => !toDate || movement.createdAt <= toDate.toISOString())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .flatMap((movement) => {
      const batch = state.batches.find((entry) => entry.id === movement.batchId);
      const product = state.products.find((entry) => entry.id === movement.productId);
      if (!batch || !product) return [];
      if (filters.product && product.sku !== filters.product) return [];
      if (
        needle &&
        !`${batch.code} ${product.sku} ${movement.reason ?? ""} ${movement.reference ?? ""}`
          .toLowerCase()
          .includes(needle)
      ) {
        return [];
      }
      return [{ movement, batchCode: batch.code, productSku: product.sku }];
    });

  return (
    <section className="panel">
      <header>
        <h2>Stock history</h2>
        <p>
          {movementRows.length} of {state.movements.length} entr{state.movements.length === 1 ? "y" : "ies"}
          {" · "}
          <button
            type="button"
            className="notif-link"
            onClick={() =>
              downloadCsv("provi-beans-stock-changes.csv", [
                ["When", "Type", "Batch", "SKU", "Quantity", "Reason", "Reference", "Reverses"],
                ...movementRows.map(({ movement, batchCode, productSku }) => [
                  movement.createdAt,
                  MOVEMENT_LABELS[movement.type],
                  batchCode,
                  productSku,
                  movement.quantity,
                  movement.reason,
                  movement.reference,
                  movement.reversesId,
                ]),
              ])
            }
          >
            Export CSV
          </button>
        </p>
      </header>

      <form className="panel-body" method="get">
        <div className="form-grid">
          <label className="field" htmlFor="type">
            <span>Change type</span>
            <select id="type" name="type" defaultValue={filters.type}>
              {MOVEMENT_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="product">
            <span>Product</span>
            <select id="product" name="product" defaultValue={filters.product}>
              <option value="">All products</option>
              {[...state.products]
                .sort((a, b) => a.sku.localeCompare(b.sku))
                .map((product) => (
                  <option key={product.id} value={product.sku}>
                    {product.sku} — {product.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="field" htmlFor="q">
            <span>Search</span>
            <input
              id="q"
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Batch, SKU, reason, reference"
            />
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
          <Link href="/reports/movements" className="btn btn-quiet">
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
                <p className="empty">No stock changes match those filters.</p>
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
                <td className="code muted">{movement.reversesId ? `#${movement.reversesId}` : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
