import { canViewReports, getCurrentUser } from "@/lib/auth/session";
import {
  buildPeriodReport,
  periodCoverage,
  resolvePeriod,
  type PeriodGranularity,
} from "@/lib/inventory/periods";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function parseGranularity(value: string | null): PeriodGranularity {
  return value === "week" || value === "year" ? value : "month";
}

function parseAnchor(value: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canViewReports(user.role)) {
    return new Response("Not permitted", { status: 403 });
  }

  const url = new URL(request.url);
  const period = resolvePeriod(parseGranularity(url.searchParams.get("g")), parseAnchor(url.searchParams.get("d")));
  const report = await buildPeriodReport(period);

  const rows: (string | number)[][] = [
    ["Provi Beans periodic report"],
    ["period", period.label],
    ["period_key", period.key],
    ["granularity", period.granularity],
    ["coverage_utc", periodCoverage(period)],
    ["starts_utc", period.start.toISOString()],
    ["ends_utc", period.end.toISOString()],
    [],
    ["opening_on_hand", report.openingOnHand],
    ["closing_on_hand", report.closingOnHand],
    ["net_on_hand", report.totals.netOnHand],
    ["opening_reserved", report.openingReserved],
    ["closing_reserved", report.closingReserved],
    ["net_reserved", report.totals.netReserved],
    ["movements", report.totals.movementCount],
    [],
    ["movement", "units"],
    ["receipts", report.totals.received],
    ["issues", report.totals.issued],
    ["returns", report.totals.returned],
    ["damage", report.totals.damaged],
    ["disposal", report.totals.disposed],
    ["adjustments", report.totals.adjusted],
    ["physical_counts", report.totals.counted],
    ["reservations", report.totals.reserved],
    ["releases", report.totals.released],
    ["cancellations", report.totals.cancelled],
    ["quarantines", report.totals.quarantined],
    ["unquarantines", report.totals.unquarantined],
    [],
    ["sku", "product", "received", "issued", "returned", "damaged", "disposed", "net_on_hand"],
    ...report.byProduct.map((line) => [
      line.sku,
      line.name,
      line.received,
      line.issued,
      line.returned,
      line.damaged,
      line.disposed,
      line.netOnHand,
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="provi-beans-${period.key}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}