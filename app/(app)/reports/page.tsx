"use client";

import { buildBatchViews, useMockStore } from "@/lib/mock-store";

export default function ReportsPage() {
  const { state, user } = useMockStore();
  if (!user) return null;
  const lotViews = buildBatchViews(state);

  return (
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
  );
}
