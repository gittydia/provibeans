import Link from "next/link";
import { notFound } from "next/navigation";
import { getCart } from "@/lib/cart";
import { slugForProduct } from "@/lib/cart";
import { COMMERCE_ENABLED } from "@/lib/features";
import { CheckoutForm, QuantityControl, RemoveButton } from "./cart-forms";

export const dynamic = "force-dynamic";

function peso(value: number): string {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export default async function CartPage() {
  if (!COMMERCE_ENABLED) notFound();
  const cart = await getCart();

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

      <div className="order-head">
        <p className="eyebrow">Your basket</p>
        <h1>
          The <em>cart.</em>
        </h1>
      </div>

      {cart.itemCount === 0 ? (
        <div className="order-columns">
          <div className="panel">
            <div className="panel-body">
              <p className="empty">
                Your cart is empty. <Link href="/#collection">Browse the coffees →</Link>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="order-columns">
          <section className="panel">
            <header>
              <h2>Items</h2>
              <p>
                {cart.itemCount} bag{cart.itemCount === 1 ? "" : "s"}
              </p>
            </header>
            <table>
              <thead>
                <tr>
                  <th scope="col">Coffee</th>
                  <th scope="col" className="num">Price</th>
                  <th scope="col">Quantity</th>
                  <th scope="col" className="num">Total</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((line) => (
                  <tr key={line.product.id}>
                    <td>
                      <Link href={`/coffee/${slugForProduct(line.product)}`}>
                        {line.product.name}
                      </Link>
                      <div className="faint code">{line.product.sku}</div>
                      {line.exceedsAvailable ? (
                        <span className="badge badge-crit" style={{ marginTop: 6 }}>
                          Only {line.available} available
                        </span>
                      ) : null}
                    </td>
                    <td className="num">{peso(line.product.unitPrice)}</td>
                    <td>
                      <div className="qty-control">
                        <QuantityControl productId={line.product.id} quantity={line.quantity} />
                      </div>
                    </td>
                    <td className="num">{peso(line.lineTotal)}</td>
                    <td>
                      <RemoveButton productId={line.product.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <header>
              <h2>Summary</h2>
            </header>
            <div className="panel-body">
              <div className="cart-summary">
                <div>
                  <span>Subtotal</span>
                  <strong>{peso(cart.subtotal)}</strong>
                </div>
                <p className="faint">
                  Delivery and payment are arranged with you directly. No charge is made here.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {cart.itemCount > 0 ? (
        <section className="panel" style={{ margin: "0 clamp(24px, 5vw, 96px) 60px" }}>
          <header>
            <h2>Where should we send the confirmation?</h2>
            <p>Placing the request holds your stock straight away.</p>
          </header>
          <div className="panel-body">
            <CheckoutForm />
          </div>
        </section>
      ) : null}
    </main>
  );
}