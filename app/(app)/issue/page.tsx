"use client";

import { buildBatchViews, fefoPlan, useMockStore } from "@/lib/mock-store";
import { IssueForm } from "./forms";

export default function IssuePage() {
  const { state } = useMockStore();
  const views = buildBatchViews(state);
  const productRows = [...state.products]
    .filter((product) => product.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));

  const productOptions = productRows.map((product) => ({
    id: product.id,
    label: `${product.sku} — ${product.name}`,
  }));

  const lotOptions = views.map((view) => ({
    id: view.batch.id,
    label: `${view.batch.code} — ${view.product.sku} (${view.available} available)`,
    available: view.available,
    issuable: view.isIssuable,
  }));

  const recommendations: { product: (typeof productRows)[number]; first: ReturnType<typeof fefoPlan>[number]; total: number; spread: number }[] = [];
  for (const product of productRows) {
    const plan = fefoPlan(state, product.id);
    if (plan.length === 0) continue;
    recommendations.push({
      product,
      first: plan[0],
      total: plan.reduce((sum, entry) => sum + entry.available, 0),
      spread: plan.length,
    });
  }

  return (
    <>
      <section className="panel">
        <header>
          <h2>Issue stock</h2>
          <p>FEFO allocation when no batch is named.</p>
        </header>
        <div className="panel-body">
          <IssueForm products={productOptions} batches={lotOptions} />
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>FEFO recommendation</h2>
          <p>The batch that should leave first, per product.</p>
        </header>
        {recommendations.length === 0 ? (
          <p className="empty">No issuable stock. Every batch is expired, quarantined or depleted.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Issue first</th>
                <th scope="col">Effective date</th>
                <th scope="col" className="num">Days</th>
                <th scope="col" className="num">Batches in play</th>
                <th scope="col" className="num">Issuable total</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((row) => (
                <tr key={row.product.id}>
                  <td>
                    {row.product.sku}
                    <div className="faint">{row.product.name}</div>
                  </td>
                  <td className="code">{row.first.batchCode}</td>
                  <td>{row.first.effectiveDate}</td>
                  <td className="num">{row.first.daysToExpiry}</td>
                  <td className="num">{row.spread}</td>
                  <td className="num">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
