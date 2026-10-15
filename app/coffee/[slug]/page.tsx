import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { findProductBySlug, listActiveProducts, slugForProduct } from "@/lib/cart";
import { productSummaries } from "@/lib/inventory/ledger";
import { buildLotViews } from "@/lib/inventory/ledger";
import { COMMERCE_ENABLED } from "@/lib/features";
import { AddToCartForm } from "../add-to-cart-form";

export const dynamic = "force-dynamic";

const PACK_IMAGES: Record<string, { file: string; width: number; height: number; alt: string }> = {
  "PB-HN-250": {
    file: "/images/hanoi.png",
    width: 156,
    height: 296,
    alt: "Hà Nội coffee pouch in deep green with an illustrated city scene and a cream lower band.",
  },
  "PB-HUE-250": {
    file: "/images/hue.png",
    width: 185,
    height: 296,
    alt: "Huế coffee pouch in violet and indigo with a haloed figure and a dark lower band.",
  },
  "PB-SGN-250": {
    file: "/images/saigon.png",
    width: 180,
    height: 299,
    alt: "Saigon coffee pouch in cyan and orange with a raised-arm figure and a red lower band.",
  },
};

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export default async function CoffeeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await findProductBySlug(slug);
  if (!product) notFound();

  const [summaries, views, others] = await Promise.all([
    productSummaries(),
    buildLotViews({ productId: product.id }),
    listActiveProducts(),
  ]);

  const summary = summaries.find((entry) => entry.product.id === product.id);
  const liveLots = views.filter((view) => view.isIssuable && view.available > 0);
  const image = PACK_IMAGES[product.sku];
  const related = others.filter((entry) => entry.id !== product.id);

  return (
    <main className="detail-page">
      <div className="grain" aria-hidden="true" />

      <nav aria-label="Primary" className="order-nav">
        <Link className="wordmark" href="/">
          PROVI<span>BEANS</span>
        </Link>
        <div className="nav-links">
          <Link href="/#collection">Coffee</Link>
          {COMMERCE_ENABLED ? <Link href="/cart">Cart</Link> : null}
          <Link href="/login">Staff sign in</Link>
        </div>
      </nav>

      <div className="detail-grid">
        <div className="detail-art">
          {image ? (
            <Image
              src={image.file}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(max-width: 900px) 40vw, 320px"
              priority
            />
          ) : (
            <div className="detail-art-fallback" aria-hidden="true">
              {product.sku}
            </div>
          )}
        </div>

        <div className="detail-body">
          <p className="eyebrow">{product.sku}</p>
          <h1>{product.name}</h1>

          <p className="detail-price">{peso(product.unitPrice)} per {product.weightGrams}g bag</p>

          <dl className="detail-specs">
            <div>
              <dt>Origin</dt>
              <dd>
                {product.originCountry}
                {product.originRegion ? ` — ${product.originRegion}` : ""}
              </dd>
            </div>
            <div>
              <dt>Blend</dt>
              <dd>{product.species ?? "—"}</dd>
            </div>
            <div>
              <dt>Process</dt>
              <dd>{product.process ?? "—"}</dd>
            </div>
            <div>
              <dt>Roast</dt>
              <dd>{product.roastLevel ?? "—"}</dd>
            </div>
            <div>
              <dt>Pack size</dt>
              <dd>{product.weightGrams} g</dd>
            </div>
            <div>
              <dt>Lots on record</dt>
              <dd>{summary?.lotCount ?? 0}</dd>
            </div>
          </dl>

          <div className="detail-stock">
            <div>
              <span className="faint">Available now</span>
              <strong>{summary?.available ?? 0} bags</strong>
            </div>
            <div>
              <span className="faint">Reserved</span>
              <strong>{summary?.reserved ?? 0}</strong>
            </div>
            <div>
              <span className="faint">Next lot expires</span>
              <strong>{summary?.nextExpiry ?? "—"}</strong>
            </div>
          </div>

          {COMMERCE_ENABLED ? (
            <div className="detail-cart">
              <AddToCartForm
                productId={product.id}
                available={summary?.available ?? 0}
                sku={product.sku}
              />
            </div>
          ) : null}

          {liveLots.length > 0 ? (
            <table className="detail-lots">
              <thead>
                <tr>
                  <th scope="col">Lot</th>
                  <th scope="col">Expires</th>
                  <th scope="col" className="num">Days</th>
                  <th scope="col" className="num">Available</th>
                </tr>
              </thead>
              <tbody>
                {liveLots.map((view) => (
                  <tr key={view.lot.id}>
                    <td className="code">{view.lot.code}</td>
                    <td>{view.effectiveDate}</td>
                    <td className="num">{view.daysToExpiry}</td>
                    <td className="num">{view.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="detail-related">
          <p className="eyebrow">Also available</p>
          <div className="detail-related-row">
            {related.map((entry) => (
              <Link
                key={entry.id}
                className="detail-related-card"
                href={`/coffee/${slugForProduct(entry)}`}
              >
                <span className="code">{entry.sku}</span>
                <strong>{entry.name}</strong>
                <span className="faint">{peso(entry.unitPrice)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}