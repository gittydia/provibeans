"use client";

import { useMockStore } from "@/lib/mock-store";
import { CreateLotForm } from "../forms";

export default function ReceiveBatchPage() {
  const { state } = useMockStore();
  const productRows = [...state.products]
    .filter((product) => product.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
  const deliveryRows = [...state.deliveries]
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    .map((delivery) => ({ delivery, supplierName: state.suppliers.find((supplier) => supplier.id === delivery.supplierId)?.name ?? "Unknown supplier" }));

  return (
    <section className="panel">
      <header>
        <h2>Receive a batch</h2>
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
  );
}
