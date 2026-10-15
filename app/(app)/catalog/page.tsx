import { requireUser, canManageMasterData } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deliveries, lots, products, suppliers } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { DeliveryForm, ProductForm, SupplierForm } from "./forms";

export const dynamic = "force-dynamic";

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export default async function CatalogPage() {
  const user = await requireUser();
  const canEdit = canManageMasterData(user.role);

  const [productRows, supplierRows, deliveryRows] = await Promise.all([
    db.select().from(products).orderBy(asc(products.sku)),
    db.select().from(suppliers).orderBy(asc(suppliers.name)),
    db
      .select({ delivery: deliveries, supplierName: suppliers.name })
      .from(deliveries)
      .innerJoin(suppliers, eq(deliveries.supplierId, suppliers.id))
      .orderBy(desc(deliveries.receivedAt)),
  ]);

  const lotCounts = await db.select().from(lots).orderBy(asc(lots.code));
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
            {productRows.map((product) => (
              <tr key={product.id}>
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
            ))}
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
            {supplierRows.map((supplier) => (
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
            ))}
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
            {deliveryRows.map((row) => (
              <tr key={row.delivery.id}>
                <td className="code">{row.delivery.reference ?? `#${row.delivery.id}`}</td>
                <td>{row.supplierName}</td>
                <td className="muted">{row.delivery.receivedAt.slice(0, 10)}</td>
                <td className="muted">{row.delivery.notes ?? "—"}</td>
              </tr>
            ))}
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