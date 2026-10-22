"use client";

import { buildBatchViews, canWriteStock, useMockStore } from "@/lib/mock-store";
import { AdjustForm, ReverseForm } from "../forms";

export default function MovementsPage() {
  const { state, user } = useMockStore();
  if (!user) return null;
  const canWrite = canWriteStock(user.role);
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
          <p>Reserve, release, return, damage, dispose, adjust or reconcile a count.</p>
        </header>
        <div className="panel-body">
          {canWrite ? (
            <AdjustForm batches={lotOptions} />
          ) : (
            <p className="notice" role="note">
              Your role has read-only access. Only an administrator or inventory staff may record stock
              changes.
            </p>
          )}
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
                  {canWrite ? (
                    <div className="row-form">
                      <ReverseForm movementId={movement.id} />
                    </div>
                  ) : null}
                </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
