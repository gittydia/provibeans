# Inventory reporting

Reporting turns the existing products, batches, and movements into the six views an
administrator or owner needs to run the shop: stock by product, stock by batch, reorder
work, expiry work, loss, and count accuracy. Everything is derived at render time from
browser-local state. No report is stored, scheduled, or sent anywhere.

## What changed

`/reports` is now a hub of six panels instead of a batch listing:

| Panel | Answers | Source |
|---|---|---|
| Stock by product | What do we hold, what is reserved, what can be issued? | `stockByProductRows` |
| Stock by batch | Which lots remain, and in what state? | batch views with `buildBatchViews` |
| Reorder list | What is at or below its reorder point? | `reorderRows` |
| Near-expiry and expired | Which lots need action, and how soon? | `expiryRows` |
| Damaged and disposed | What did we write off, and why? | `damagedDisposedRows` |
| Physical count variances | Where did counted stock disagree with the ledger? | `countVarianceRows` |

The derived rows live in `lib/inventory/reports.ts` so the pages stay presentational and
the arithmetic is testable in one place:

- Shortfall is `max(0, reorderPoint - available)`, so a negative shortfall is never shown.
- Expiry buckets use the same day offsets as the batch views, so `0` days means today,
  and a lot that expired yesterday is not counted as "near expiry".
- Damaged and disposed totals read the signed movement ledger, so reversals reduce them.
- Count variance reads `COUNT` audit entries and skips any change payload it cannot parse.

## Filters and exports

Every report accepts the same shape of filter: a browser `GET` form read through
`window.location.search` after hydration, so a filtered view is a shareable URL and the
static export keeps working. Exports are generated in the browser with `downloadCsv` and
contain the full filtered result, not just the visible page.

The 200-row movement cap and the 40-row activity cap are gone. Both screens now show every
matching row inside a scrolling panel and print `N of M entries` in the panel header, which
is what the layout contract expects instead of silent truncation.

The `/reports` tab label changed from "Stock by batch" to "Inventory reports" because the
route stopped being a single report.

## Access

Every report checks `canViewReports` both in navigation and inside the page. A signed-in
inventory-staff account sees no reports entry and gets the same refusal panel if it reaches
a report URL directly. This mirrors the accounts and catalog screens; it is a UI
demonstration of role behaviour, not a server-side security boundary (see
[`data-protection.md`](data-protection.md)).

## Verification

- `npm run verify` — 7/7 frontend architecture checks, clean `tsc --noEmit`.
- `npm run verify:layout` — 98/98 geometry checks. Empty states render outside the table
  rather than as a `colSpan` row, because the suite counts real cells per row.
- `npm run build` — all report routes prerender as static content.

Recorded on 2026-10-21 against the state described in the commit that added this file.

## Limits

- Reports recompute from in-memory state on every render; there is no index or cache, and
  none is needed at demo volume.
- CSV files carry no formulas or formatting, and Excel may reinterpret long numeric codes.
- Report definitions live in code, so adding a column means editing `lib/inventory/reports.ts`.
