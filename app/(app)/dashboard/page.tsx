import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { MOVEMENT_LABELS } from "@/lib/db/schema";
import { evaluateAlertsSafely, openAlerts } from "@/lib/inventory/alerts";
import { buildLotViews, productSummaries, recentMovements } from "@/lib/inventory/ledger";
import { productArtwork } from "@/lib/product-images";

export const dynamic = "force-dynamic";

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function LotStateBadge({
  isExpired,
  isNearExpiry,
  isQuarantined,
}: {
  isExpired: boolean;
  isNearExpiry: boolean;
  isQuarantined: boolean;
}) {
  if (isExpired) return <span className="badge badge-crit">Expired</span>;
  if (isQuarantined) return <span className="badge badge-warn">Quarantine</span>;
  if (isNearExpiry) return <span className="badge badge-warn">Near expiry</span>;
  return <span className="badge badge-ok">Issuable</span>;
}

export default async function DashboardPage() {
  await requireUser();

  await evaluateAlertsSafely();
  const [summaries, lotViews, alerts, movements] = await Promise.all([
    productSummaries(),
    buildLotViews(),
    openAlerts(),
    recentMovements(12),
  ]);

  const totalValue = summaries.reduce((sum, entry) => sum + entry.inventoryValue, 0);
  const totalAvailable = summaries.reduce((sum, entry) => sum + entry.available, 0);
  const totalReserved = summaries.reduce((sum, entry) => sum + entry.reserved, 0);
  const critical = alerts.filter((alert) => alert.severity === "CRITICAL").length;

  const fefoWatch = lotViews
    .filter((view) => view.isIssuable && view.available > 0)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
    .slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            Operational exceptions first, then stock. Every figure below is derived from the movement ledger
            rather than stored totals.
          </p>
        </div>
      </div>

      <dl className="stat-grid">
        <div className="stat">
          <dt>Inventory value</dt>
          <dd>{peso(totalValue)}</dd>
          <small>On-hand units at list price</small>
        </div>
        <div className="stat">
          <dt>Available</dt>
          <dd>{totalAvailable}</dd>
          <small>Issuable right now</small>
        </div>
        <div className="stat">
          <dt>Reserved</dt>
          <dd>{totalReserved}</dd>
          <small>Committed, not yet released</small>
        </div>
        <div className="stat">
          <dt>Open alerts</dt>
          <dd>{alerts.length}</dd>
          <small>
            {critical === 0 ? "Nothing critical" : `${critical} critical`}
          </small>
        </div>
      </dl>

      <section className="panel">
        <header>
          <h2>Alerts</h2>
          <p>Recomputed on every load; resolved automatically when the condition clears.</p>
        </header>
        {alerts.length === 0 ? (
          <p className="empty">No open alerts. Stock levels, expiry dates and quarantine are all clear.</p>
        ) : (
          alerts.slice(0, 8).map((alert) => (
            <div className="alert-row" key={alert.id}>
              <span
                className={`badge ${
                  alert.severity === "CRITICAL"
                    ? "badge-crit"
                    : alert.severity === "WARNING"
                      ? "badge-warn"
                      : "badge-info"
                }`}
              >
                {alert.type.replace(/_/g, " ").toLowerCase()}
              </span>
              <p>{alert.message}</p>
            </div>
          ))
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Stock by product</h2>
          <p>Available excludes reserved, quarantined, damaged, disposed and expired units.</p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col" className="thumb-col">Image</th>
              <th scope="col">SKU</th>
              <th scope="col">Product</th>
              <th scope="col" className="num">On hand</th>
              <th scope="col" className="num">Reserved</th>
              <th scope="col" className="num">Available</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.product.id}>
                <td className="thumb">
                  {(() => {
                    const art = productArtwork(summary.product.sku);
                    return art ? (
                      <Image
                        src={art.file}
                        alt={art.alt}
                        width={art.width}
                        height={art.height}
                        sizes="48px"
                      />
                    ) : null;
                  })()}
                </td>
                <td className="code">{summary.product.sku}</td>
                <td>
                  {summary.product.name}
                  <div className="faint">{summary.lotCount} lots</div>
                </td>
                <td className="num">{summary.onHand}</td>
                <td className="num">{summary.reserved}</td>
                <td className="num">{summary.available}</td>
                <td>
                  {summary.stockState === "OK" ? (
                    <span className="badge badge-ok">Above reorder point</span>
                  ) : summary.stockState === "REORDER" ? (
                    <span className="badge badge-warn">Reorder</span>
                  ) : summary.stockState === "LOW" ? (
                    <span className="badge badge-crit">Low stock</span>
                  ) : (
                    <span className="badge badge-crit">Expired hold</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="split">
        <section className="panel">
          <header>
            <h2>FEFO watchlist</h2>
            <p>Issuable lots ordered by earliest effective date.</p>
          </header>
          {fefoWatch.length === 0 ? (
            <p className="empty">No issuable lots.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Lot</th>
                  <th scope="col">Product</th>
                  <th scope="col">Effective date</th>
                  <th scope="col" className="num">Days</th>
                  <th scope="col" className="num">Available</th>
                </tr>
              </thead>
              <tbody>
                {fefoWatch.map((view) => (
                  <tr key={view.lot.id}>
                    <td className="code">{view.lot.code}</td>
                    <td>{view.product.sku}</td>
                    <td>{view.effectiveDate}</td>
                    <td className="num">{view.daysToExpiry}</td>
                    <td className="num">{view.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <header>
            <h2>Blocked lots</h2>
            <p>Excluded from issuance by policy.</p>
          </header>
          {lotViews.filter((view) => view.isExpired || view.isQuarantined).length === 0 ? (
            <p className="empty">No expired or quarantined lots.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Lot</th>
                  <th scope="col">State</th>
                  <th scope="col" className="num">On hand</th>
                  <th scope="col" className="num">Available</th>
                </tr>
              </thead>
              <tbody>
                {lotViews
                  .filter((view) => view.isExpired || view.isQuarantined)
                  .map((view) => (
                    <tr key={view.lot.id}>
                      <td className="code">{view.lot.code}</td>
                      <td>
                        <LotStateBadge
                          isExpired={view.isExpired}
                          isNearExpiry={view.isNearExpiry}
                          isQuarantined={view.isQuarantined}
                        />
                      </td>
                      <td className="num">{view.onHand}</td>
                      <td className="num">{view.available}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="panel">
        <header>
          <h2>Recent movements</h2>
          <p>
            Append-only. Corrections are made by reversal, never by editing history.{" "}
            <Link href="/reports">Full history →</Link>
          </p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Type</th>
              <th scope="col" className="num">Qty</th>
              <th scope="col">Reason</th>
              <th scope="col">Reference</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id}>
                <td className="faint">{movement.createdAt.slice(0, 10)}</td>
                <td>{MOVEMENT_LABELS[movement.type]}</td>
                <td className="num">{movement.quantity}</td>
                <td className="muted">{movement.reason ?? "—"}</td>
                <td className="code">{movement.reference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}