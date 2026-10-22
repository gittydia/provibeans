"use client";

import { canManageMasterData, useMockStore } from "@/lib/mock-store";
import { SupplierForm } from "../forms";

export default function SuppliersPage() {
  const { state, user } = useMockStore();
  if (!user) return null;
  const canEdit = canManageMasterData(user.role);
  const supplierRows = [...state.suppliers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <section className="panel">
        <header>
          <h2>Suppliers</h2>
          <p>{supplierRows.length} on record</p>
        </header>
        <table className="compact">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Contact</th>
              <th scope="col">Country</th>
              <th scope="col">Address</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {supplierRows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <p className="empty">No suppliers on record.</p>
                </td>
              </tr>
            ) : (
              supplierRows.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.name}</td>
                  <td className="muted">
                    {supplier.contactName ?? "—"}
                    {supplier.email ? (
                      <>
                        <br />
                        <span className="faint">{supplier.email}</span>
                      </>
                    ) : null}
                  </td>
                  <td className="muted">{supplier.country}</td>
                  <td className="muted">{supplier.address ?? "—"}</td>
                  <td className="muted">{supplier.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {canEdit ? (
        <section className="panel">
          <header>
            <h2>Add a supplier</h2>
            <p>Name must be unique.</p>
          </header>
          <div className="panel-body">
            <SupplierForm />
          </div>
        </section>
      ) : (
        <p className="notice" role="note">
          Your role has read-only access. Only an administrator may add suppliers.
        </p>
      )}
    </>
  );
}
