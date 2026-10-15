import Link from "next/link";
import { requireUser, canViewReports } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { MOVEMENT_LABELS, auditLogs, lots, movements, products } from "@/lib/db/schema";
import type { MovementType } from "@/lib/db/schema";
import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { buildLotViews } from "@/lib/inventory/ledger";

export const dynamic = "force-dynamic";

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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;

  const conditions: SQL[] = [];
  if (filters.type) conditions.push(eq(movements.type, filters.type as MovementType));
  if (filters.from) conditions.push(gte(movements.createdAt, new Date(filters.from).toISOString()));
  if (filters.to) {
    const to = new Date(filters.to);
    to.setHours(23, 59, 59, 999);
    conditions.push(lte(movements.createdAt, to.toISOString()));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [movementRows, lotViews, activity, productRows] = await Promise.all([
    db
      .select({
        movement: movements,
        lotCode: lots.code,
        productSku: products.sku,
      })
      .from(movements)
      .innerJoin(lots, eq(movements.lotId, lots.id))
      .innerJoin(products, eq(movements.productId, products.id))
      .where(where)
      .orderBy(desc(movements.createdAt), desc(movements.id))
      .limit(200),
    buildLotViews(),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40),
    db.select({ sku: products.sku }).from(products).orderBy(asc(products.sku)),
  ]);

  const query = new URLSearchParams();
  if (filters.type) query.set("type", filters.type);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  const exportHref = `/reports/export${query.size > 0 ? `?${query}` : ""}`;

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
          <h2>Stock by lot</h2>
          <p>Derived balances with the date that drives FEFO.</p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Lot</th>
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
              <tr key={view.lot.id}>
                <td className="code">{view.lot.code}</td>
                <td>{view.product.sku}</td>
                <td className="muted">{view.lot.receivedAt.slice(0, 10)}</td>
                <td className="muted">{view.lot.roastDate ?? "—"}</td>
                <td className="muted">{view.lot.packDate ?? "—"}</td>
                <td className="muted">{view.lot.bestBeforeDate ?? "—"}</td>
                <td className="muted">{view.lot.expiryDate ?? "—"}</td>
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
                <a href={exportHref} download>
                  Export CSV
                </a>
              </>
            ) : null}
          </p>
        </header>

        <form className="panel-body" method="get">
          <div className="form-grid">
            <label className="field" htmlFor="type">
              <span>Movement type</span>
              <select id="type" name="type" defaultValue={filters.type ?? ""}>
                {MOVEMENT_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="from">
              <span>From</span>
              <input id="from" type="date" name="from" defaultValue={filters.from ?? ""} />
            </label>

            <label className="field" htmlFor="to">
              <span>To</span>
              <input id="to" type="date" name="to" defaultValue={filters.to ?? ""} />
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
              <th scope="col">Lot</th>
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
              movementRows.map(({ movement, lotCode, productSku }) => (
                <tr key={movement.id}>
                  <td className="faint">{movement.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{MOVEMENT_LABELS[movement.type]}</td>
                  <td className="code">{lotCode}</td>
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