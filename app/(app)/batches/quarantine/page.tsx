"use client";

import { buildBatchViews, useMockStore } from "@/lib/mock-store";
import { QuarantineForm, ReleaseForm } from "../forms";

export default function QuarantinePage() {
  const { state } = useMockStore();
  const views = buildBatchViews(state);

  return (
    <>
      <section className="panel">
        <header>
          <h2>Quarantine</h2>
          <p>Quarantined stock stays on the books but cannot be issued or reserved.</p>
        </header>
        {views.filter((view) => view.isQuarantined).length === 0 ? (
          <p className="empty">No batches are currently quarantined.</p>
        ) : (
          views
            .filter((view) => view.isQuarantined)
            .map((view) => (
              <div className="alert-row" key={view.batch.id}>
                <div>
                  <span className="badge badge-warn">Held</span>
                  <p className="faint row-note">
                    {view.batch.code}
                    <br />
                    {view.onHand} on hand
                  </p>
                </div>
                <div>
                  <p className="muted">{view.batch.quarantineReason ?? "No reason recorded."}</p>
                  <div className="row-form">
                    <ReleaseForm batchId={view.batch.id} />
                  </div>
                </div>
              </div>
            ))
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Hold a batch</h2>
          <p>Quarantine requires a reason and is always reversible.</p>
        </header>
        <div className="panel-body">
          {views.filter((view) => !view.isQuarantined && view.batch.status === "ACTIVE").length === 0 ? (
            <p className="empty">No issuable batches to hold.</p>
          ) : (
            <div className="split">
              {views
                .filter((view) => !view.isQuarantined && view.batch.status === "ACTIVE")
                .map((view) => (
                  <div key={view.batch.id}>
                    <p className="code row-label">
                      {view.batch.code}
                    </p>
                    <QuarantineForm batchId={view.batch.id} />
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
