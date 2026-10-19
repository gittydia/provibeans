"use client";

import { buildBatchViews, useMockStore } from "@/lib/mock-store";
import { useRowFocus } from "@/lib/row-focus";

function stateBadge(view: { isExpired: boolean; isQuarantined: boolean; isNearExpiry: boolean }) {
  if (view.isExpired) return <span className="badge badge-crit">Expired</span>;
  if (view.isQuarantined) return <span className="badge badge-warn">Quarantine</span>;
  if (view.isNearExpiry) return <span className="badge badge-warn">Near expiry</span>;
  return <span className="badge badge-ok">Ready to issue</span>;
}

export default function LotsPage() {
  const { state } = useMockStore();
  const focus = useRowFocus();
  const views = buildBatchViews(state);

  return (
    <section className="panel">
      <header>
        <h2>All batches</h2>
        <p>{views.length} batches on record</p>
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">Batch</th>
            <th scope="col">Product</th>
            <th scope="col">Use-by date</th>
            <th scope="col" className="num">Days</th>
            <th scope="col" className="num">In stock</th>
            <th scope="col" className="num">Reserved</th>
            <th scope="col" className="num">Available</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {views.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <p className="empty">No batches yet. Use the Receive tab to start tracking stock.</p>
              </td>
            </tr>
          ) : (
            views.map((view) => (
              <tr
                key={view.batch.id}
                data-focus-key={view.batch.code}
                className={focus === view.batch.code ? "row-focus" : undefined}
              >
                <td className="code">{view.batch.code}</td>
                <td>
                  {view.product.sku}
                  <div className="faint">{view.product.name}</div>
                </td>
                <td className="date">{view.effectiveDate}</td>
                <td className="num">{view.daysToExpiry}</td>
                <td className="num">{view.onHand}</td>
                <td className="num">{view.reserved}</td>
                <td className="num">{view.available}</td>
                <td>{stateBadge(view)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
