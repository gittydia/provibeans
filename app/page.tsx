import Image from "next/image";
import Link from "next/link";
import { cartItemCount, slugForProduct } from "@/lib/cart";
import { COMMERCE_ENABLED } from "@/lib/features";

type Product = {
  slug: string;
city: string;
  spec: string;
  note: string;
  width: number;
  height: number;
  alt: string;
  sku: string;
};

const products: Product[] = [
  {
    slug: "hanoi",
    sku: "PB-HN-250",
    city: "Hà Nội",
    spec: "City blend",
    note: "The everyday bag. Roasted to sit well in a long, unhurried filter.",
    width: 156,
    height: 296,
    alt: "Hà Nội coffee pouch in deep green with an illustrated city scene and a cream lower band.",
  },
  {
    slug: "hue",
    sku: "PB-HUE-250",
    city: "Huế",
    spec: "60% Robusta · 40% Arabica",
    note: "Weight and sweetness in balance, for shops that brew it all day.",
    width: 185,
    height: 296,
    alt: "Huế coffee pouch in violet and indigo with a haloed figure and a dark lower band.",
  },
  {
    slug: "saigon",
    sku: "PB-SGN-250",
    city: "Saigon",
    spec: "100% Robusta",
    note: "Full-bodied and dark. The one our regulars come back for.",
    width: 180,
    height: 299,
    alt: "Saigon coffee pouch in cyan and orange with a raised-arm figure and a red lower band.",
  },
];

const controls = [
  {
    number: "01",
    title: "Every lot, dated",
    body: "Roast, packing, best-before and expiry dates are recorded per lot — never lumped into a single product total.",
  },
  {
    number: "02",
    title: "First out is first expiring",
    body: "When several valid lots exist, the earliest expiry is recommended for issue, so nothing ages on the shelf.",
  },
  {
    number: "03",
    title: "Warnings before problems",
    body: "Low stock, reorder points, near-expiry, expired and quarantined stock surface as alerts instead of surprises.",
  },
  {
    number: "04",
    title: "A record you can read back",
    body: "Receipts, issues, returns, damage and adjustments are logged with who acted, when, and why.",
  },
];

function ArrowLink({ children, href = "#collection" }: { children: React.ReactNode; href?: string }) {
  return (
    <a className="arrow-link" href={href}>
      {children}
      <span aria-hidden="true">→</span>
    </a>
  );
}

export default async function Home() {
  const cartCount = COMMERCE_ENABLED ? await cartItemCount() : 0;

  return (
    <main>
      <div className="grain" aria-hidden="true" />

      <section className="hero" id="top">
        <nav aria-label="Primary">
          <a className="wordmark" href="#top">
            PROVI<span>BEANS</span>
          </a>
<div className="nav-links">
            <a href="#collection">Coffee</a>
            <a href="#ledger">System</a>
            <a href="#practice">Practice</a>
            <a href="#contact">Contact</a>
            {COMMERCE_ENABLED ? (
              <a className="nav-login" href="/cart">
                Cart{cartCount > 0 ? <span className="cart-count">{cartCount}</span> : null}
              </a>
            ) : null}
            <a className="nav-login" href="/login">
              Staff sign in
            </a>
          </div>
        </nav>

        <div className="hero-copy">
          <p className="eyebrow">Vietnamese specialty coffee · distributed in the Philippines</p>
          <div className="outline" aria-hidden="true">
            BEANS
          </div>
          <h1>
            Slow roasted,
            <br />
            <em>clearly</em> traced.
          </h1>
          <p className="hero-note">
            Hà Nội, Huế and Saigon, sourced from Vietnamese suppliers and accounted for lot by lot — so what
            leaves our shelves is always the right one.
          </p>
          <ArrowLink>See the three coffees</ArrowLink>
        </div>

        <div className="hero-still">
          <div className="sun-disc" aria-hidden="true" />
          <div className="pouch pouch--left">
            <Image
              src="/images/hue.png"
              alt={products[1].alt}
              width={products[1].width}
              height={products[1].height}
              unoptimized
            />
          </div>
          <div className="pouch pouch--center">
            <Image
              src="/images/hanoi.png"
              alt={products[0].alt}
              width={products[0].width}
              height={products[0].height}
              unoptimized
            />
          </div>
          <div className="pouch pouch--right">
            <Image
              src="/images/saigon.png"
              alt={products[2].alt}
              width={products[2].width}
              height={products[2].height}
              unoptimized
            />
          </div>
          <span className="script" aria-hidden="true">
            slowly
          </span>
          <p className="still-note">
            01 / Three origins
            <br />
            One honest ledger
          </p>
        </div>
      </section>

      <section className="manifesto" id="practice">
        <p className="eyebrow">A quieter kind of roastery</p>
        <h2>
          Coffee roasts well.
          <br />
          Records keep it
          <br />
          <em>worth keeping.</em>
        </h2>
        <div className="manifesto-note">
          <span>02</span>
          <p>
            We are a small distributor, not a marketplace. What we sell is Vietnamese coffee; what we owe our
            customers is certainty about where a lot came from, how fresh it is, and how much of it is left.
          </p>
        </div>
      </section>

      <section className="collection" id="collection">
        <header>
          <p className="eyebrow">The current range</p>
          <h2>
            Three cities.
            <br />
            Three distinct cups.
          </h2>
          <ArrowLink href="#practice">How we keep track</ArrowLink>
        </header>

        <div className="coffee-grid">
{products.map((product, index) => {
            const detailHref = `/coffee/${slugForProduct({ sku: product.sku })}`;
            return (
            <article className="coffee-card" key={product.slug}>
              <Link className="card-art" href={detailHref} aria-label={`View details for ${product.city}`}>
                <Image
                  src={`/images/${product.slug}.png`}
                  alt={product.alt}
                  width={product.width}
                  height={product.height}
                  unoptimized
                />
                <span className="card-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
              <div className="card-body">
                <p className="card-spec">{product.spec}</p>
                <h3>
                  <Link href={detailHref}>{product.city}</Link>
                </h3>
                <p className="card-note">{product.note}</p>
                <div className="card-actions">
                  <a className="card-link" href={detailHref}>
                    Details <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      <section className="ledger" id="ledger">
        <div className="ledger-copy">
          <p className="eyebrow">Behind the counter</p>
          <h2>
            The part
            <br />
            you don't
            <br />
            <em>see.</em>
          </h2>
          <p className="ledger-lead">
            Behind every bag is a small inventory system that refuses to let a date, a quantity or a name slip
            through. It is what lets a two-person business answer &ldquo;do you still have it?&rdquo; honestly.
          </p>
          <ArrowLink href="#collection">See the range</ArrowLink>
        </div>

        <ol className="ledger-list">
          {controls.map((control) => (
            <li key={control.number}>
              <span className="ledger-number">{control.number}</span>
              <div>
                <h3>{control.title}</h3>
                <p>{control.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="origin">
        <div className="origin-image">
          <div className="origin-sun" aria-hidden="true" />
          <div className="mountain one" aria-hidden="true" />
          <div className="mountain two" aria-hidden="true" />
          <p className="origin-stamp">
            Central Highlands
            <br />
            Vietnam → Philippines
          </p>
        </div>
        <div className="origin-copy">
          <p className="eyebrow">From the highlands</p>
          <h2>
            There is
            <br />
            a landscape
            <br />
            in every cup.
          </h2>
          <p>
            Robusta and arabica from small Vietnamese suppliers, roasted and packed to order, then carried across
            to coffee shops and enthusiasts who want to know exactly what is in their grinder.
          </p>
          <ArrowLink href="#collection">Back to the range</ArrowLink>
        </div>
      </section>

      <section className="closing" id="contact">
<p className="eyebrow">Lot dates, traceability, and honest availability</p>
        <h2>
          Bring the
          <br />
          next lot
          <br />
          <em>in.</em>
        </h2>
        <ArrowLink href="#collection">Back to the range</ArrowLink>
      </section>

      <footer>
        <a className="footer-mark" href="#top">
          PROVI
          <br />
          BEANS
        </a>
<div className="footer-links">
          <a href="#collection">Coffee</a>
          <a href="#ledger">System</a>
          <a href="#practice">Our practice</a>
          <a href="#contact">Contact</a>
          <a href="/login">Staff sign in</a>
        </div>
        <p className="footer-meta">
          Vietnamese specialty coffee, distributed in the Philippines
          <br />© 2026 Provi Beans
        </p>
      </footer>
    </main>
  );
}