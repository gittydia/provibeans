import { requireUser } from "@/lib/auth/session";
import { evaluateAlerts } from "@/lib/inventory/alerts";
import { buildLotViews } from "@/lib/inventory/ledger";
import { fefoPlan } from "@/lib/inventory/ledger";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { AdjustForm, IssueForm, ReverseForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function IssuePage() {
  await requireUser();
  await evaluateAlerts();

  const views = await buildLotViews();
  const productRows = await db.select().from(products).orderBy(asc(products.name));

  const productOptions = productRows.map((product) => ({
    id: product.id,
    label: `${product.sku} — ${product.name}`,
  }));

  const lotOptions = views.map((view) => ({
    id: view.lot.id,
    label: `${view.lot.code} — ${view.product.sku} (${view.available} available)`,
    available: view.available,
    issuable: view.isIssuable,
  }));

  const recommendations = [];
  for (const product of productRows) {
    const plan = await fefoPlan(product.id);
    if (plan.length === 0) continue;
    recommendations.push({
      product,
      first: plan[0],
      total: plan.reduce((sum, entry) => sum + entry.available, 0),
      spread: plan.length,
    });
  }

  const recentIssues = await db.query.movements.findMany({
    where: (movement, { eq }) => eq(movement.type, "ISSUE"),
    orderBy: (movement, { desc }) => [desc(movement.createdAt), desc(movement.id)],
    limit: 8,
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Issue &amp; movements</h1>
          <p>
            Leave the lot empty to let FEFO allocate across valid lots. Expired and quarantined stock is excluded
            automatically and can never be issued.
          </p>
        </div>
      </div>

      <div className="split">
        <section className="panel">
          <header>
            <h2>Issue stock</h2>
            <p>FEFO allocation when no lot is named.</p>
          </header>
          <div className="panel-body">
            <IssueForm products={productOptions} lots={lotOptions} />
          </div>
        </section>

        <section className="panel">
          <header>
            <h2>Record a movement</h2>
            <p>Reserve, release, return, damage, dispose or count.</p>
          </header>
          <div className="panel-body">
            <AdjustForm lots={lotOptions} />
          </div>
        </section>
      </div>

      <section className="panel">
        <header>
          <h2>FEFO recommendation</h2>
          <p>The lot that should leave first, per product.</p>
        </header>
        {recommendations.length === 0 ? (
          <p className="empty">No issuable stock. Every lot is expired, quarantined or depleted.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Issue first</th>
                <th scope="col">Effective date</th>
                <th scope="col" className="num">Days</th>
                <th scope="col" className="num">Lots in play</th>
                <th scope="col" className="num">Issuable total</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((row) => (
                <tr key={row.product.id}>
                  <td>
                    {row.product.sku}
                    <div className="faint">{row.product.name}</div>
                  </td>
                  <td className="code">{row.first.lotCode}</td>
                  <td>{row.first.effectiveDate}</td>
                  <td className="num">{row.first.daysToExpiry}</td>
                  <td className="num">{row.spread}</td>
                  <td className="num">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Recent issues</h2>
          <p>Corrections are made by reversal, never by editing history.</p>
        </header>
        {recentIssues.length === 0 ? (
          <p className="empty">Nothing has been issued yet.</p>
        ) : (
          recentIssues.map((movement) => (
            <div className="alert-row" key={movement.id}>
              <div>
                <span className="badge badge-info">
                  {movement.quantity} unit{movement.quantity === 1 ? "" : "s"}
                </span>
                <p className="faint" style={{ marginTop: 6 }}>
                  {movement.createdAt.slice(0, 10)}
                  <br />#{movement.id}
                </p>
              </div>
              <div>
                <p className="muted">
                  {movement.reason ?? "No reason recorded"}
                  {movement.reference ? ` · ${movement.reference}` : ""}
                </p>
                <div style={{ marginTop: 10 }}>
                  <ReverseForm movementId={movement.id} />
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}