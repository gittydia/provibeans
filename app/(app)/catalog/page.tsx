"use client";

import Image from "next/image";
import { canManageMasterData, useMockStore } from "@/lib/mock-store";
import { productArtwork } from "@/lib/product-images";
import { ProductForm, ProductStateControl } from "./forms";

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export default function CatalogPage() {
  const { state, user } = useMockStore();
  if (!user) return null;
  const canEdit = canManageMasterData(user.role);
  const productRows = [...state.products].sort((a, b) => a.sku.localeCompare(b.sku));
  const lotCounts = [...state.batches].sort((a, b) => a.code.localeCompare(b.code));
  const countFor = (productId: number) =>
    lotCounts.filter((batch) => batch.productId === productId).length;

  return (
    <>
      <section className="panel">
        <header>
          <h2>Products</h2>
          <p>{productRows.length} SKUs</p>
        </header>
        <table className="compact">
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
              <th scope="col" className="num">Batches</th>
              {canEdit ? <th scope="col">State</th> : null}
            </tr>
          </thead>
          <tbody>
            {productRows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 10 : 9}>
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
                  <td>
                    {product.name}
                    {product.isActive ? null : (
                      <div>
                        <span className="badge badge-mute">Inactive</span>
                      </div>
                    )}
                  </td>
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
                  {canEdit ? (
                    <td>
                      <ProductStateControl
                        productId={product.id}
                        sku={product.sku}
                        isActive={product.isActive}
                      />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="panel-body muted">
          Deactivating keeps a product&apos;s batches and movement history. It only stops the product being
          received or issued.
        </p>
      </section>

      {canEdit ? (
        <section className="panel">
          <header>
            <h2>Add a product</h2>
            <p>SKU must be unique.</p>
          </header>
          <div className="panel-body">
            <ProductForm />
          </div>
        </section>
      ) : (
        <p className="notice notice-crit" role="note">
          Only an administrator or the owner may add products.
        </p>
      )}
    </>
  );
}
