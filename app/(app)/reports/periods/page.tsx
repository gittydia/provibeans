"use client";

import Link from "next/link";
import { canViewReports, downloadCsv, useMockStore } from "@/lib/mock-store";
import {
  buildPeriodReport,
  periodCoverage,
  resolvePeriod,
  shiftPeriod,
  switchAnchor,
  type PeriodGranularity,
} from "@/lib/inventory/periods";

const GRANULARITIES: { value: PeriodGranularity; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

function parseGranularity(value: string | null): PeriodGranularity {
  return value === "week" || value === "year" ? value : "month";
}

function parseAnchor(value: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function PeriodReportsPage() {
  const { state, user, hydrated } = useMockStore();
  if (!user) return null;
  const searchParams = hydrated ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const mayExport = canViewReports(user.role);
  const granularity = parseGranularity(searchParams.get("g"));
  const anchor = parseAnchor(searchParams.get("d"));
  const period = resolvePeriod(granularity, anchor);

  const report = buildPeriodReport(state, period);
  const previous = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const todayPeriod = resolvePeriod(granularity, new Date());

  const query = (gran: PeriodGranularity, per: typeof period) =>
    `/reports/periods?g=${gran}&d=${per.start.toISOString().slice(0, 10)}`;

  const chipQuery = (gran: PeriodGranularity) =>
    `/reports/periods?g=${gran}&d=${switchAnchor(period).toISOString().slice(0, 10)}`;

  const totals = report.totals;
  const onHandMoved = totals.received + totals.issued + totals.returned + totals.damaged + totals.disposed;

  return (
    <>
      <div className="panel">
        <header>
          <h2>{period.label}</h2>
          <p>{periodCoverage(period)}</p>
        </header>

        <div className="panel-body">
          <div className="filter-bar">
            <div className="filter-group" role="group" aria-label="Report period">
              {GRANULARITIES.map((option) => (
                <Link
                  key={option.value}
                  href={chipQuery(option.value)}
                  className={option.value === granularity ? "chip chip-on" : "chip"}
                  aria-current={option.value === granularity ? "page" : undefined}
                >
                  {option.label}
                </Link>
              ))}
            </div>

            <div className="filter-group">
              <Link className="btn btn-quiet" href={query(granularity, previous)}>
                ← Previous
              </Link>
              <Link className="btn btn-quiet" href={query(granularity, next)}>
                Next →
              </Link>
              {period.key !== todayPeriod.key ? (
                <Link className="btn btn-quiet" href={`/reports/periods?g=${granularity}`}>
                  Current {granularity}
                </Link>
              ) : null}
            </div>
          </div>

          <dl className="stat-grid">
            <div className="stat">
              <dt>Opening on hand</dt>
              <dd>{report.openingOnHand}</dd>
            </div>
            <div className="stat">
              <dt>Closing on hand</dt>
              <dd>{report.closingOnHand}</dd>
            </div>
            <div className="stat">
              <dt>Net change</dt>
              <dd>
                {totals.netOnHand > 0 ? `+${totals.netOnHand}` : totals.netOnHand}
              </dd>
            </div>
            <div className="stat">
              <dt>Movements</dt>
              <dd>{totals.movementCount}</dd>
            </div>
          </dl>

          <p className="muted">
            Reserved at close: <strong>{report.closingReserved}</strong> (opened at{" "}
            {report.openingReserved}).
          </p>

          {totals.movementCount === 0 ? (
            <p className="empty">
              No stock movements were recorded in this period, so every figure above is zero. The
              closing balance carries forward from {report.openingOnHand} units. Use ← Previous and
              Next → to move to a period that has activity.
            </p>
          ) : null}
        </div>
      </div>

      <section className="panel">
        <header>
          <h2>Movement summary</h2>
          <p>Units recorded in this period, by movement type</p>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Movement</th>
              <th scope="col" className="num">Units</th>
              <th scope="col">Effect</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Receipts</td>
              <td className="num">{totals.received}</td>
              <td className="muted">Adds to on hand</td>
            </tr>
            <tr>
              <td>Issues</td>
              <td className="num">{totals.issued}</td>
              <td className="muted">Removes from on hand</td>
            </tr>
            <tr>
              <td>Returns</td>
              <td className="num">{totals.returned}</td>
              <td className="muted">Adds to on hand</td>
            </tr>
            <tr>
              <td>Damage</td>
              <td className="num">{totals.damaged}</td>
              <td className="muted">Removes from on hand</td>
            </tr>
            <tr>
              <td>Disposal</td>
              <td className="num">{totals.disposed}</td>
              <td className="muted">Removes from on hand</td>
            </tr>
            <tr>
              <td>Adjustments</td>
              <td className="num">{totals.adjusted}</td>
              <td className="muted">Adds to on hand</td>
            </tr>
            <tr>
              <td>Physical counts</td>
              <td className="num">{totals.counted}</td>
              <td className="muted">Adds to on hand</td>
            </tr>
            <tr>
              <td>Reservations made</td>
              <td className="num">{totals.reserved}</td>
              <td className="muted">Holds stock, leaves it on hand</td>
            </tr>
            <tr>
              <td>Releases</td>
              <td className="num">{totals.released}</td>
              <td className="muted">Lifts a hold</td>
            </tr>
            <tr>
              <td>Cancellations</td>
              <td className="num">{totals.cancelled}</td>
              <td className="muted">Lifts a hold</td>
            </tr>
            <tr>
              <td>Quarantines</td>
              <td className="num">{totals.quarantined}</td>
              <td className="muted">Blocks issue, does not move stock</td>
            </tr>
            <tr>
              <td>Releases from quarantine</td>
              <td className="num">{totals.unquarantined}</td>
              <td className="muted">Unblocks issue</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Net change in on hand</th>
              <td className="num">{totals.netOnHand > 0 ? `+${totals.netOnHand}` : totals.netOnHand}</td>
              <td className="muted">{onHandMoved} units physically handled</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="panel">
        <header>
          <h2>By product</h2>
          <p>{report.byProduct.length} product{report.byProduct.length === 1 ? "" : "s"} moved</p>
        </header>
        {report.byProduct.length === 0 ? (
          <p className="empty">No movements were recorded in this period.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Product</th>
                <th scope="col" className="num">In</th>
                <th scope="col" className="num">Out</th>
                <th scope="col" className="num">Returned</th>
                <th scope="col" className="num">Lost</th>
                <th scope="col" className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {report.byProduct.map((line) => (
                <tr key={line.sku}>
                  <td className="code">{line.sku}</td>
                  <td>{line.name}</td>
                  <td className="num">{line.received}</td>
                  <td className="num">{line.issued}</td>
                  <td className="num">{line.returned}</td>
                  <td className="num">{line.damaged + line.disposed}</td>
                  <td className="num">{line.netOnHand > 0 ? `+${line.netOnHand}` : line.netOnHand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {mayExport ? (
        <p>
          <button
            type="button"
            className="btn"
            onClick={() => downloadCsv(`provi-beans-${period.key}.csv`, [
              ["Period", period.label],
              ["Opening on hand", report.openingOnHand],
              ["Closing on hand", report.closingOnHand],
              [],
              ["SKU", "Product", "Received", "Issued", "Returned", "Damaged", "Disposed", "Net"],
              ...report.byProduct.map((line) => [line.sku, line.name, line.received, line.issued, line.returned, line.damaged, line.disposed, line.netOnHand]),
            ])}
          >
            Download this period as CSV
          </button>
        </p>
      ) : null}

      <p className="muted">
        <Link href="/reports">← Back to reports and activity</Link>
      </p>
    </>
  );
}
