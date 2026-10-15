# Provi Beans — User Guide

Everything you need to run, use and explain this system. Written for a person sitting
in front of it, not for someone reading the schema.

---

## Contents

1. [Running it](#1-running-it)
2. [Signing in](#2-signing-in)
3. [The public website](#3-the-public-website)
4. [The inventory system, screen by screen](#4-the-inventory-system-screen-by-screen)
5. [Everyday tasks](#5-everyday-tasks)
6. [How the numbers work](#6-how-the-numbers-work)
7. [Optional features](#7-optional-features)
8. [Checking it still works](#8-checking-it-still-works)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Running it

**You need:** Node.js 20 or newer, and npm. Nothing else — no database server.

```powershell
npm install
npm run db:migrate     # create the tables
npm run db:seed        # load the demo data
npm run dev            # http://localhost:3000
```

For a production-style run:

```powershell
npm run build
npm run start
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run db:migrate` | Apply any pending schema migrations |
| `npm run db:seed` | **Destructive reset** — see the warning below |
| `npm run db:generate` | Write a migration after you edit `lib/db/schema.ts` |
| `npm run verify:all` | Run all five test suites (needs the server running) |

> **`db:seed` throws everything away.** It deletes every table and re-inserts the demo
> data, including all order reservations. Use it to start clean, not to "update" anything.
> If you want to keep a database around, copy it first:
> `Copy-Item data/provi-beans.db data/my-backup.db`

---

## 2. Signing in

Go to **`/login`**. The staff area is not public — any anonymous request is redirected
back to this page.

All three demo accounts use the password **`ProviBeans2026`**. The login page lists them
and pre-fills the administrator, so you can usually just press Sign in.

| Email | Role | What they can do |
|---|---|---|
| `admin@provibeans.ph` | Administrator | Everything, including master data and reports |
| `staff@provibeans.ph` | Inventory staff | Receive, issue, move, quarantine stock. Master data is read-only |
| `owner@provibeans.ph` | Owner / manager | Master data, reports and CSV export |

### What the roles actually control

Two checks decide everything, and both run on the **server** — hiding a button is never
the control:

- **`canManageMasterData`** → administrator and owner only. Creating products, suppliers
  and deliveries.
- **`canViewReports`** → administrator and owner only. The reports screen and CSV export.

Inventory staff see those screens read-only or not at all.

---

## 3. The public website

No sign-in required.

| Route | What it shows |
|---|---|
| `/` | The editorial site: hero, the three coffees, the inventory "system" story, our practice |
| `/coffee/[slug]` | Product detail for one coffee |
| `/cart` | **Returns 404** — deliberately, see [Optional features](#7-optional-features) |

### Reading a product detail page

Each of the three coffees has a detail page — click a pack image, the city name, or the
**Details →** button on any card.

It shows:

- **Origin, blend, process, roast, pack size** — the descriptive attributes
- **Price** per bag
- **Available now** — the live number, computed from the ledger
- **Reserved** — units held for a request but not yet released
- **Next lot expires** — the earliest expiry among lots you can actually issue
- **A table of lots** — code, effective date, days remaining, and available quantity for
  every issuable lot

That lot table is the traceability story in its simplest form: a customer can see *which
specific lot* their coffee comes from and how long it has left.

---

## 4. The inventory system, screen by screen

Six screens, in the left navigation.

### Dashboard — "Stock control"

The morning-glance screen. Four figures across the top, then five panels:

**Top row:** Inventory value · Available · Reserved · Open alerts

| Panel | What it tells you |
|---|---|
| **Alerts** | Everything that needs a human decision today |
| **Stock by product** | On hand / reserved / available per SKU, plus a **State** badge |
| **FEFO watchlist** | Lots approaching expiry, soonest first |
| **Blocked lots** | Quarantined, expired or disposed lots, with the reason |
| **Recent movements** | The last few ledger entries |

**The State badge** is derived, not typed in. It reads one of:

| Badge | Means |
|---|---|
| **Above reorder point** | Available is above the reorder level — nothing to do |
| **Reorder** | Available has fallen to or below the reorder point |
| **Low stock** | Available is at or below the low-stock level |
| **Expired hold** | Reserved units exist on a lot that has since expired |

It is always describing the **available** figure, never on-hand.

### Lots & receiving

**Receive a lot** — the form you use when a delivery arrives. Fields: lot code (must be
unique), product, quantity, unit, expiry date, best-before date, supplier, delivery
reference, notes. Button: **Receive lot**.

**All lots** — the full register, one row per lot with its dates, status and balances.

**Quarantine** — holds a lot so it can never be issued. Give a reason; it is stored on the
lot and shown wherever the lot appears. Button: **Quarantine**.

**Hold a lot** — takes a lot out of service in one step. Button: **Release to available**
returns a quarantined lot to normal service.

Quarantined lots drop out of the FEFO plan and out of *available*, and appear under
**Blocked lots** on the dashboard.

### Issue & movements

**FEFO recommendation** — pick a product and it recommends which lot to use, ordered by
earliest effective date (expiry, falling back to best-before, then receipt date). Expired
and quarantined lots are excluded from the plan entirely rather than filtered out
afterwards, so a stale suggestion can't leak one in.

**Issue stock** — pick the lot, enter quantity and a reference. Blocked if it would take
a lot negative. Button: **Issue stock**.

**Record a movement** — the general-purpose form for every other event: return, damage,
disposal, adjustment, count. Button: **Record movement**.

**Recent issues** — the last issues, each with a **Reverse** button.

**Reverse** — corrections are never edits. Reversing writes an offsetting entry and keeps
the original readable forever. There is no "edit movement" anywhere in this system, on
purpose.

### Products & suppliers

Master data, **administrator and owner only**.

- **Products** — SKU, name, origin, species, process, roast, weight, price, low-stock
  level, reorder point. Adding one also creates its SKU.
- **Suppliers** — name, contact, lead time.
- **Record a delivery** — links a supplier to a set of lots.

### Reports & activity

**Administrator and owner only for the CSV export.**

- **Stock by lot** — the position per lot with the date that drives FEFO
- **Movement history** — the full ledger with filters
- **Activity log** — who did what, when, with before/after values
- **CSV export** — the ledger as a file
- **Periodic reports** — see below

### Periodic reports

**`/reports/periods`** — the same ledger summarised over **a week, a month or a year**.

Switch granularity with the **Weekly / Monthly / Yearly** chips, then step through
periods with **← Previous** and **Next →**. The URL is shareable — it carries the
granularity and the period, so `?g=month&d=2026-03-15` always opens March 2026.

Each report shows:

| Figure | Meaning |
|---|---|
| **Opening on hand** | Units on hand at the very start of the period |
| **Closing on hand** | Units on hand at the end |
| **Net change** | Closing minus opening |
| **Movements** | How many ledger entries the period contains |
| **Reserved at close** | Holds still outstanding, with the opening figure alongside |

Then a **movement summary** table breaking the period down by type — receipts, issues,
returns, damage, disposal, adjustments, physical counts, reservations made, releases,
cancellations, quarantines and releases from quarantine — each with a note on whether it
moves stock on hand or only changes what is issuable.

Finally a **by product** table: units in, out, returned, lost, and net change per SKU.

**Download this period as CSV** gives you the same figures as a file, named after the
period (for example `provi-beans-2026-03.csv`). The button is shown only to the
administrator and owner, and the export route refuses anyone else even if they request
the URL directly.

Weeks are **ISO weeks**, running Monday to Sunday.

> Reservations are deliberately reported separately from on-hand changes. Holding stock
> removes it from *available* but leaves it physically present, so counting a reservation
> as stock leaving the building would overstate the movement.

### Order requests

Reservations. Staff see everything that has been held and can act on it:

| Action | What it does |
|---|---|
| **Confirm** | Status → `CONFIRMED` |
| **Fulfil** | Writes `ISSUE` + `RELEASE`, request closes as `FULFILLED` |
| **Cancel** | Writes `CANCEL`, stock returns to available |

Each request shows which lots were held and how much of each line was actually covered.

---

## 5. Everyday tasks

### Receive a delivery

1. **Lots & receiving → Receive a lot**
2. Enter the lot code from the paperwork — it must be unique
3. Choose the product, quantity and unit
4. Enter expiry and/or best-before. If you supply both, expiry must not be *earlier*
   than best-before; the database rejects it
5. Add the supplier and delivery reference
6. **Receive lot**

The lot appears as `ACTIVE` and its quantity immediately increases *available*.

### Issue stock

1. **Issue & movements**
2. Pick the product. Read the **FEFO recommendation** — it is the lot the plan wants you
   to use, and it tells you why (earliest effective date)
3. If the plan is right, use it. If not, you may pick another active, unexpired lot
4. Enter quantity and a reference
5. **Issue stock**

Overselling is refused — you cannot issue more than the lot holds.

### Hold a lot

**Lots & receiving → Quarantine**, give a reason, press **Quarantine**. The lot drops out
of both the FEFO plan and *available*, and shows under **Blocked lots** on the dashboard.

Press **Release to available** on the same screen to undo it.

### Clear an alert

Alerts are **derived, not maintained**. They are recomputed from live stock on every page
load: anything newly true is inserted, anything no longer true is resolved automatically.
You don't close alerts by hand — you fix the underlying stock and the alert disappears
next load.

Alert types: `LOW_STOCK`, `REORDER`, `NEAR_EXPIRY`, `EXPIRED`, `QUARANTINE`,
`COUNT_VARIANCE`. Each carries a severity of `INFO`, `WARNING` or `CRITICAL`.

### Correct a mistake

Never edit. Find the movement, **Reverse** it, and give the reason. The original stays in
the ledger and the audit log keeps both entries.

---

## 6. How the numbers work

### Stock is derived, never stored as a total

There is no "quantity: 259" column anywhere. Every figure is computed by folding the
append-only `stock_movements` ledger:

| Figure | Means |
|---|---|
| **On hand** | Physical units present, whether or not they may be issued |
| **Reserved** | Committed to an approved request, not yet released |
| **Available** | On hand minus reserved, counting only active, unexpired, unquarantined lots |

A displayed total therefore **cannot drift** from the movements behind it, because it is
derived from them on every read.

### The movement types

`RECEIPT` · `ISSUE` · `RESERVE` · `RELEASE` · `CANCEL` · `RETURN` · `DAMAGE` ·
`QUARANTINE` · `UNQUARANTINE` · `DISPOSE` · `ADJUSTMENT` · `COUNT`

Reserving takes a unit out of *available* but leaves it in *on hand*. Issuing takes it out
of *on hand*. That is why "reserved" is a separate number and not a fudge.

### FEFO

When issuing without naming a lot, the system recommends by **effective date**:
`expiryDate` → `bestBeforeDate` → `receivedAt`, earliest first. Expired and quarantined
lots are excluded from the plan itself, not filtered out afterwards.

### Lot status

`ACTIVE` → issuable · `QUARANTINE` → blocked, with a reason · `DEPLETED` → zero
available · `DISPOSED` → written off

### Dates are checked twice

Once as SQL `CHECK` constraints — the floor that cannot be bypassed — and once in the
application layer, so you get a readable message instead of a constraint error.

---

## 7. Optional features

Two things are built but switched **off**, because they sit outside the project scope.
Set the flag, rebuild, and they come back.

```powershell
$env:NEXT_PUBLIC_COMMERCE="1"
npm run build
npm run start
```

| Feature | Default | Governed by |
|---|---|---|
| Cart, add-to-cart, checkout | **Off** — `/cart` returns 404 | `NEXT_PUBLIC_COMMERCE` |
| Customer ordering and enquiries | **Removed entirely** — `/order` returns 404 | nothing; deleted |

The reservation engine underneath is **not** optional and stays live either way — holding
stock is core inventory work.

---

## 8. Checking it still works

Five executable suites. Start the server first for the three HTTP-based ones.

```powershell
npm run verify:all
```

| Suite | Covers |
|---|---|
| `verify:rules` | The database rejects invalid dates, duplicate SKUs and lot codes, zero and negative quantities, negative prices, and orphaned references |
| `verify:inventory` | FEFO excludes expired lots, allocation spills across lots, over-issue and over-reserve are refused, releasing quarantine restores availability, alerts fire and don't duplicate |
| `verify:periods` | Week, month and year boundaries are exact and contiguous, periods never overlap, and each report's closing balance reconciles with the dashboard |
| `verify:smoke` | Anonymous requests to every protected route redirect to login, a forged cookie is rejected, authenticated pages render real data, CSV export refuses anonymous callers |
| `verify:cart` | Cart and checkout end-to-end — **prints SKIPPED while the feature is off** |
| `verify:links` | No page is an orphan, no link points at a missing page, and out-of-scope features are genuinely unreachable |

Each prints an `x/y checks passed` summary and exits non-zero on failure, so they can be
wired straight into CI.

`verify:inventory` runs against a separate `data/verify.db` and wipes its own contents, so
it never touches your data.

---

## 9. Troubleshooting

**"Sign in does nothing" on `localhost`**
Browsers drop `Secure` cookies over plain HTTP, and `npm run start` sets
`NODE_ENV=production`. `shouldUseSecureCookie()` exempts loopback hosts, so this should
not happen locally — if it does, you are probably not on `localhost`. Set
`SESSION_COOKIE_SECURE=false` to override.

**Port 3000 already in use**
Stop the other process, or run `npm run start -- -p 3001`.

**I see no data / everything is empty**
You have not seeded. Run `npm run db:seed`.

**A suite fails with "server must be running"**
`verify:smoke`, `verify:cart` and `verify:links` need `npm run start` already serving.

**The cart link is missing**
Correct. It is off by default — see [Optional features](#7-optional-features).

**Dates rejected: "expiry before best-before"**
Both were supplied and expiry is earlier. Either correct the entry or leave expiry blank.

---

## Where things live

| Path | Contents |
|---|---|
| `app/page.tsx` | Public editorial site |
| `app/coffee/[slug]/` | Product detail |
| `app/(app)/` | Authenticated area — all six screens |
| `lib/inventory/ledger.ts` | Balance derivation and FEFO |
| `lib/inventory/orders.ts` | Reservations |
| `lib/inventory/record.ts` | Every validated write |
| `lib/inventory/alerts.ts` | Alert derivation |
| `lib/auth/session.ts` | Sessions and role guards |
| `lib/db/schema.ts` | All 14 tables |
| `scripts/` | The five verification suites |

See `README.md` for the technical and architectural detail behind all of this.