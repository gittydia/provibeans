"use client";

import { buildBatchViews, useMockStore } from "@/lib/mock-store";
import { AdjustForm, ReverseForm } from "../forms";

export default function MovementsPage() {
  const { state } = useMockStore();
  const views = buildBatchViews(state);
  const lotOptions = views.map((view) => ({
    id: view.batch.id,
    label: `${view.batch.code} — ${view.product.sku} (${view.available} available)`,
    available: view.available,
    issuable: view.isIssuable,
  }));

  const recentIssues = [...state.movements]
    .filter((movement) => movement.type === "ISSUE" && movement.quantity > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .slice(0, 8);

  return (
    <>
      <section className="panel">
        <header>
          <h2>Record a stock change</h2>
          <p>Reserve, release, return, damage, dispose or count.</p>
        </header>
        <div className="panel-body">
          <AdjustForm batches={lotOptions} />
        </div>
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
