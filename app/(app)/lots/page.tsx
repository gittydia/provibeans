"use client";

import { buildLotViews, useMockStore } from "@/lib/mock-store";
import { CreateLotForm, QuarantineForm, ReleaseForm } from "./forms";

function stateBadge(view: { isExpired: boolean; isQuarantined: boolean; isNearExpiry: boolean }) {
  if (view.isExpired) return <span className="badge badge-crit">Expired</span>;
  if (view.isQuarantined) return <span className="badge badge-warn">Quarantine</span>;
  if (view.isNearExpiry) return <span className="badge badge-warn">Near expiry</span>;
  return <span className="badge badge-ok">Issuable</span>;
}

export default function LotsPage() {
  const { state } = useMockStore();
  const views = buildLotViews(state);
  const productRows = [...state.products].sort((a, b) => a.name.localeCompare(b.name));
  const deliveryRows = [...state.deliveries]
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    .map((delivery) => ({ delivery, supplierName: state.suppliers.find((supplier) => supplier.id === delivery.supplierId)?.name ?? "Unknown supplier" }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lots &amp; receiving</h1>
          <p>
            Every lot carries its own dates. Receiving writes a receipt movement rather than editing a stored
            total, so the ledger stays the single source of truth.
          </p>
        </div>
      </div>

      <section className="panel">
        <header>
          <h2>Receive a lot</h2>
          <p>Dates are validated on entry: expiry cannot precede best-before, packing, roasting or receipt.</p>
        </header>
        <div className="panel-body">
          <CreateLotForm
            products={productRows.map((product) => ({
              id: product.id,
              label: `${product.sku} — ${product.name}`,
            }))}
            deliveries={deliveryRows.map((row) => ({
              id: row.delivery.id,
              label: `${row.delivery.reference ?? "Delivery #" + row.delivery.id} — ${row.supplierName}`,
            }))}
          />
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>All lots</h2>
          <p>{views.length} lots on record</p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Lot</th>
              <th scope="col">Product</th>
              <th scope="col">Effective date</th>
              <th scope="col" className="num">Days</th>
              <th scope="col" className="num">On hand</th>
              <th scope="col" className="num">Reserved</th>
              <th scope="col" className="num">Available</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {views.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <p className="empty">No lots yet. Receive one above to start tracking stock.</p>
                </td>
              </tr>
            ) : (
              views.map((view) => (
                <tr key={view.lot.id}>
                  <td className="code">{view.lot.code}</td>
                  <td>
                    {view.product.sku}
                    <div className="faint">{view.product.name}</div>
                  </td>
                  <td>{view.effectiveDate}</td>
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

      <section className="panel">
        <header>
          <h2>Quarantine</h2>
          <p>Quarantined stock stays on the books but cannot be issued or reserved.</p>
        </header>
        {views.filter((view) => view.isQuarantined).length === 0 ? (
          <p className="empty">No lots are currently quarantined.</p>
        ) : (
          views
            .filter((view) => view.isQuarantined)
            .map((view) => (
              <div className="alert-row" key={view.lot.id}>
                <div>
                  <span className="badge badge-warn">Held</span>
                  <p className="faint row-note">
                    {view.lot.code}
                    <br />
                    {view.onHand} on hand
                  </p>
                </div>
                <div>
                  <p className="muted">{view.lot.quarantineReason ?? "No reason recorded."}</p>
                  <div className="row-form">
                    <ReleaseForm lotId={view.lot.id} />
                  </div>
                </div>
              </div>
            ))
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Hold a lot</h2>
          <p>Quarantine requires a reason and is always reversible.</p>
        </header>
        <div className="panel-body">
          {views.filter((view) => !view.isQuarantined && view.lot.status === "ACTIVE").length === 0 ? (
            <p className="empty">No issuable lots to hold.</p>
          ) : (
            <div className="split">
              {views
                .filter((view) => !view.isQuarantined && view.lot.status === "ACTIVE")
                .map((view) => (
                  <div key={view.lot.id}>
                    <p className="code row-label">
                      {view.lot.code}
                    </p>
                    <QuarantineForm lotId={view.lot.id} />
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
