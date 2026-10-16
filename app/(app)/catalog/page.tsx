"use client";

import Image from "next/image";
import { canManageMasterData, useMockStore } from "@/lib/mock-store";
import { productArtwork } from "@/lib/product-images";
import { DeliveryForm, ProductForm, SupplierForm } from "./forms";

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export default function CatalogPage() {
  const { state, user } = useMockStore();
  if (!user) return null;
  const canEdit = canManageMasterData(user.role);
  const productRows = [...state.products].sort((a, b) => a.sku.localeCompare(b.sku));
  const supplierRows = [...state.suppliers].sort((a, b) => a.name.localeCompare(b.name));
  const deliveryRows = [...state.deliveries]
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((delivery) => ({ delivery, supplierName: state.suppliers.find((supplier) => supplier.id === delivery.supplierId)?.name ?? "Unknown supplier" }));
  const lotCounts = [...state.lots].sort((a, b) => a.code.localeCompare(b.code));
  const countFor = (productId: number) =>
    lotCounts.filter((lot) => lot.productId === productId).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Products &amp; suppliers</h1>
          <p>
            Master data. {canEdit ? "Your role may edit these records." : "Your role has read-only access here."}
          </p>
        </div>
      </div>

      <section className="panel">
        <header>
          <h2>Products</h2>
          <p>{productRows.length} SKUs</p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col" className="thumb-col">Image</th>
              <th scope="col">SKU</th>
              <th scope="col">Name</th>
              <th scope="col">Origin</th>
              <th scope="col">Blend</th>
              <th scope="col" className="num">Size</th>
              <th scope="col" className="num">Price</th>
              <th scope="col" className="num">Low / reorder</th>
              <th scope="col" className="num">Lots</th>
            </tr>
          </thead>
          <tbody>
            {productRows.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <p className="empty">No products yet.</p>
                </td>
              </tr>
            ) : (
              productRows.map((product) => (
                <tr key={product.id}>
                  <td className="thumb">
                    {(() => {
                      const art = productArtwork(product.sku);
                      return art ? (
                        <Image
                          src={art.file}
                          alt={art.alt}
                          width={art.width}
                          height={art.height}
                          sizes="48px"
                        />
                      ) : (
                        <span className="faint">—</span>
                      );
                    })()}
                  </td>
                  <td className="code">{product.sku}</td>
                  <td>{product.name}</td>
                  <td className="muted">
                    {product.originCountry}
                    {product.originRegion ? ` — ${product.originRegion}` : ""}
                  </td>
                  <td className="muted">{product.species ?? "—"}</td>
                  <td className="num">{product.weightGrams}g</td>
                  <td className="num">{peso(product.unitPrice)}</td>
                  <td className="num">
                    {product.lowStockLevel} / {product.reorderPoint}
                  </td>
                  <td className="num">{countFor(product.id)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <header>
          <h2>Suppliers</h2>
          <p>{supplierRows.length} on record</p>
        </header>
        <table>
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
        <div className="split">
          <section className="panel">
            <header>
              <h2>Add a product</h2>
              <p>SKU must be unique.</p>
            </header>
            <div className="panel-body">
              <ProductForm />
            </div>
          </section>

          <section className="panel">
            <header>
              <h2>Add a supplier</h2>
              <p>Name must be unique.</p>
            </header>
            <div className="panel-body">
              <SupplierForm />
            </div>
          </section>
        </div>
      ) : (
        <p className="notice notice-crit" role="note">
          Only an administrator or the owner may add products, suppliers and deliveries.
        </p>
      )}

      {canEdit ? (
        <section className="panel">
          <header>
            <h2>Record a delivery</h2>
            <p>Link the delivery to a lot when you receive stock.</p>
          </header>
          <div className="panel-body">
            <DeliveryForm
              suppliers={supplierRows.map((supplier) => ({ id: supplier.id, label: supplier.name }))}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
