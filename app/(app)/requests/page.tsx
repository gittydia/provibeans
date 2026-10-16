"use client";

import { useMockStore } from "@/lib/mock-store";
import { RequestRow } from "./row";

function statusBadge(status: string) {
  if (status === "NEW") return <span className="badge badge-info">New</span>;
  if (status === "CONFIRMED") return <span className="badge badge-warn">Confirmed</span>;
  if (status === "FULFILLED") return <span className="badge badge-ok">Fulfilled</span>;
  if (status === "CANCELLED") return <span className="badge badge-mute">Cancelled</span>;
  return <span className="badge badge-mute">{status}</span>;
}

export default function RequestsPage() {
  const { state } = useMockStore();
  const requests = [...state.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = {
    NEW: requests.filter((request) => request.status === "NEW").length,
    CONFIRMED: requests.filter((request) => request.status === "CONFIRMED").length,
    FULFILLED: requests.filter((request) => request.status === "FULFILLED").length,
  };
  const withDetails = requests.map((request) => ({
    request,
    lines: request.lines.map((line) => ({ line, product: state.products.find((product) => product.id === line.productId)! })),
    reservations: request.lines.flatMap((line) => line.allocations.map((allocation, index) => ({
      reservation: { id: index, orderRequestLineId: line.id, quantity: allocation.quantity },
      batch: state.batches.find((batch) => batch.id === allocation.batchId)!,
    }))),
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Order requests</h1>
          <p>
            Requests come from the public site and hold stock the moment they are submitted. Cancelling
            releases the hold; fulfilling issues it.
          </p>
        </div>
      </div>

      <dl className="stat-grid">
        <div className="stat">
          <dt>New requests</dt>
          <dd>{counts.NEW}</dd>
          <small>Awaiting confirmation</small>
        </div>
        <div className="stat">
          <dt>Confirmed</dt>
          <dd>{counts.CONFIRMED}</dd>
          <small>Stock held, not yet issued</small>
        </div>
        <div className="stat">
          <dt>Fulfilled</dt>
          <dd>{counts.FULFILLED}</dd>
          <small>Issued and closed</small>
        </div>
      </dl>

      <section className="panel">
        <header>
          <h2>Order requests</h2>
          <p>{withDetails.length} received</p>
        </header>

        {withDetails.length === 0 ? (
          <p className="empty">No order requests yet. They will appear here from the public order page.</p>
        ) : (
          withDetails.map((entry) => (
            <div className="request-card" key={entry!.request.id}>
              <div className="request-head">
                <div>
                  <span className="code">{entry!.request.reference}</span>
                  <strong>{entry!.request.customerName}</strong>
                  {entry!.request.business ? <span className="muted"> · {entry!.request.business}</span> : null}
                  <div className="faint">
                    {entry!.request.email}
                    {entry!.request.phone ? ` · ${entry!.request.phone}` : ""} ·{" "}
                    {entry!.request.createdAt.slice(0, 10)}
                  </div>
                </div>
                <div className="request-status">
                  {statusBadge(entry!.request.status)}
                  <RequestRow requestId={entry!.request.id} />
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th scope="col">Coffee</th>
                    <th scope="col" className="num">Requested</th>
                    <th scope="col" className="num">Reserved</th>
                    <th scope="col">Batches held</th>
                    <th scope="col">Line</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {entry!.lines.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <p className="empty">This request has no lines.</p>
                      </td>
                    </tr>
                  ) : (
                    entry!.lines.map(({ line, product }) => (
                      <tr key={line.id}>
                        <td>
                          {product.sku}
                          <div className="faint">{product.name}</div>
                        </td>
                        <td className="num">{line.quantityRequested}</td>
                        <td className="num">{line.quantityReserved}</td>
                        <td className="code">
                          {entry!.reservations
                            .filter((reservation) => reservation.reservation.orderRequestLineId === line.id)
                            .map((reservation) => `${reservation.batch.code} ×${reservation.reservation.quantity}`)
                            .join(", ") || "—"}
                        </td>
                        <td>
                          {line.status === "RESERVED" ? (
                            <span className="badge badge-ok">Held</span>
                          ) : line.status === "PARTIAL" ? (
                            <span className="badge badge-warn">Partial</span>
                          ) : line.status === "SHORT" ? (
                            <span className="badge badge-crit">Short</span>
                          ) : (
                            <span className="badge badge-mute">Cancelled</span>
                          )}
                        </td>
                        <td className="muted">{line.note ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {entry!.request.notes ? (
                <p className="muted request-note">
                  <strong>Customer note:</strong> {entry!.request.notes}
                </p>
              ) : null}
            </div>
          ))
        )}
      </section>
    </>
  );
}
