"use client";

import { canManageMasterData, useMockStore } from "@/lib/mock-store";
import { DeliveryForm } from "../forms";

export default function DeliveriesPage() {
  const { state, user } = useMockStore();
  if (!user) return null;
  const canEdit = canManageMasterData(user.role);
  const supplierRows = [...state.suppliers].sort((a, b) => a.name.localeCompare(b.name));
  const deliveryRows = [...state.deliveries]
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((delivery) => ({ delivery, supplierName: state.suppliers.find((supplier) => supplier.id === delivery.supplierId)?.name ?? "Unknown supplier" }));

  return (
    <>
      <section className="panel">
        <header>
          <h2>Supplier deliveries</h2>
          <p>{deliveryRows.length} recorded</p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Supplier</th>
              <th scope="col">Received</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {deliveryRows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <p className="empty">No deliveries recorded.</p>
                </td>
              </tr>
            ) : (
              deliveryRows.map((row) => (
                <tr key={row.delivery.id}>
                  <td className="code">{row.delivery.reference ?? `#${row.delivery.id}`}</td>
                  <td>{row.supplierName}</td>
                  <td className="muted">{row.delivery.receivedAt.slice(0, 10)}</td>
                  <td className="muted">{row.delivery.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {canEdit ? (
        <section className="panel">
          <header>
            <h2>Record a delivery</h2>
            <p>Link the delivery to a batch when you receive stock.</p>
          </header>
          <div className="panel-body">
            <DeliveryForm
              suppliers={supplierRows.map((supplier) => ({ id: supplier.id, label: supplier.name }))}
            />
          </div>
        </section>
      ) : (
        <p className="notice notice-crit" role="note">
          Only an administrator or the owner may record deliveries.
        </p>
      )}
    </>
  );
}
