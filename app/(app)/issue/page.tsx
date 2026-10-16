"use client";

import { buildLotViews, fefoPlan, useMockStore } from "@/lib/mock-store";
import { AdjustForm, IssueForm, ReverseForm } from "./forms";

export default function IssuePage() {
  const { state } = useMockStore();
  const views = buildLotViews(state);
  const productRows = [...state.products].sort((a, b) => a.name.localeCompare(b.name));

  const productOptions = productRows.map((product) => ({
    id: product.id,
    label: `${product.sku} — ${product.name}`,
  }));

  const lotOptions = views.map((view) => ({
    id: view.lot.id,
    label: `${view.lot.code} — ${view.product.sku} (${view.available} available)`,
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

  const recentIssues = [...state.movements]
    .filter((movement) => movement.type === "ISSUE" && movement.quantity > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .slice(0, 8);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Issue &amp; movements</h1>
          <p>
            Leave the lot empty to let FEFO allocate across valid lots. Expired and quarantined stock is excluded
            automatically and can never be issued.
          </p>
        </div>
      </div>

      <div className="split">
        <section className="panel">
          <header>
            <h2>Issue stock</h2>
            <p>FEFO allocation when no lot is named.</p>
          </header>
          <div className="panel-body">
            <IssueForm products={productOptions} lots={lotOptions} />
          </div>
        </section>

        <section className="panel">
          <header>
            <h2>Record a movement</h2>
            <p>Reserve, release, return, damage, dispose or count.</p>
          </header>
          <div className="panel-body">
            <AdjustForm lots={lotOptions} />
          </div>
        </section>
      </div>

      <section className="panel">
        <header>
          <h2>FEFO recommendation</h2>
          <p>The lot that should leave first, per product.</p>
        </header>
        {recommendations.length === 0 ? (
          <p className="empty">No issuable stock. Every lot is expired, quarantined or depleted.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Issue first</th>
                <th scope="col">Effective date</th>
                <th scope="col" className="num">Days</th>
                <th scope="col" className="num">Lots in play</th>
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
                  <td className="code">{row.first.lotCode}</td>
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

      <section className="panel">
        <header>
          <h2>Recent issues</h2>
          <p>Corrections are made by reversal, never by editing history.</p>
        </header>
        {recentIssues.length === 0 ? (
          <p className="empty">Nothing has been issued yet.</p>
        ) : (
          recentIssues.map((movement) => (
            <div className="alert-row" key={movement.id}>
              <div>
                <span className="badge badge-info">
                  {movement.quantity} unit{movement.quantity === 1 ? "" : "s"}
                </span>
                <p className="faint row-note">
                  {movement.createdAt.slice(0, 10)}
                  <br />#{movement.id}
                </p>
              </div>
              <div>
                <p className="muted">
                  {movement.reason ?? "No reason recorded"}
                  {movement.reference ? ` · ${movement.reference}` : ""}
                </p>
                <div className="row-form">
                  <ReverseForm movementId={movement.id} />
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
