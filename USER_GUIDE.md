# Provi Beans — User Guide

Everything you need to run, use and explain this system. Written for a person sitting
in front of it, not for someone reading the schema.

---

## Contents

1. [Running it](#1-running-it)
2. [Signing in](#2-signing-in)
3. [Getting in](#3-getting-in)
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
| `npm run verify:all` | Run all six test suites (needs the server running) |

> **`db:seed` throws everything away.** It truncates every table and re-inserts the demo data, including
> all order reservations. Use it to start clean, not to "update" anything.
>
> The database lives on **Neon (PostgreSQL)**, not on your disk. To keep a copy before re-seeding, branch it
> first — in the Neon console, create a branch from `main`, then use its connection string.

### Environment

Two variables, both in `.env.local` (gitignored). Copy `.env.example` to get started.

| Variable | Used by | What it is |
|---|---|---|
| `DATABASE_URL` | The application, `db:seed`, `db:migrate` | Your Neon connection string |
| `DATABASE_URL_VERIFY` | `verify:inventory`, `verify:periods` | A **separate Neon branch** for the destructive suites |

That second one matters: two of the suites truncate every table, so they must never touch the database the
app runs on. A Neon branch is an isolated copy, which makes that separation free.

---

## 2. Signing in

Go to **`/login`**. The staff area is not public — any anonymous request is redirected
back to this page.

All three demo accounts use the password **`ProviBeans2026`**. The login page pre-fills the
administrator, so you only need to enter the password and press Sign in.

| Email | Role | What they can do |
|---|---|---|
| `admin@provibeans.ph` | Administrator | Everything, including master data and reports |
| `staff@provibeans.ph` | Inventory staff | Receive, issue, move, quarantine stock. Master data is read-only |
| `owner@provibeans.ph` | Owner / manager | Master data, reports and CSV export |

### What the roles actually control

Three checks decide everything, and all three run in the browser against the mock state —
hiding a button is never the control:

- **`canManageMasterData`** → administrator and owner only. Creating products, suppliers
  and deliveries.
- **`canViewReports`** → administrator and owner only. The reports screen and CSV export.
- **`canManageAccounts`** → administrator and owner only. The Accounts screen, adding
  accounts and deactivating them.

Inventory staff see those screens read-only or not at all.

---

## 3. Getting in

There is no public website. The system is internal, so:

| Route | What happens |
|---|---|
| `/` | Redirects you to `/login` |
| `/login` | The sign-in page |
| everything else | Redirects to `/login` until you are signed in |

After signing in you land on the **Dashboard**. To sign out, use the control in the top-right of the app
shell.

Product artwork lives inside the system: you will see each coffee's pouch as a thumbnail on the **Dashboard**
and in the **Products** table under Products & suppliers.

---

## 4. The inventory system, screen by screen

Six screens, in the left navigation. **Dashboard** and **Accounts** (administrator and owner
only) are single pages; the other four are section pages with **tabs** — the tab strip sits
under the page heading, and each tab is its own route with its own URL.

### Dashboard — "Stock control"

The morning-glance screen. Four figures across the top, then five panels:

**Top row:** Inventory value · Available · Reserved · Open alerts

| Panel | What it tells you |
|---|---|
| **Alerts** | Everything that needs a human decision today |
| **Stock by product** | A thumbnail of the pack, then on hand / reserved / available per SKU, plus a **State** badge |
| **FEFO watchlist** | Batches approaching expiry, soonest first |
| **Blocked batches** | Quarantined, expired or disposed batches, with the reason |
| **Recent movements** | The last few ledger entries |

**The State badge** is derived, not typed in. It reads one of:

| Badge | Means |
|---|---|
| **Above reorder point** | Available is above the reorder level — nothing to do |
| **Reorder** | Available has fallen to or below the reorder point |
| **Low stock** | Available is at or below the low-stock level |
| **Expired hold** | Reserved units exist on a batch that has since expired |

It is always describing the **available** figure, never on-hand.

### Batches & receiving

Three tabs: **All batches** (`/batches`), **Receive** (`/batches/receive`) and
**Quarantine** (`/batches/quarantine`).

**All batches** — the full register, one row per batch with its dates, status and balances.

**Receive** — the form you use when a delivery arrives. Fields: batch code (must be
unique), product, quantity, unit, expiry date, best-before date, supplier, delivery
reference, notes. Button: **Receive batch**.

**Quarantine** — holds a batch so it can never be issued. Give a reason; it is stored on the
batch and shown wherever the batch appears. Button: **Quarantine**.

**Hold a batch** — takes a batch out of service in one step. Button: **Release to available**
returns a quarantined batch to normal service.

Quarantined batches drop out of the FEFO plan and out of *available*, and appear under
**Blocked batches** on the dashboard.

### Issue & movements

Two tabs: **Issue stock** (`/issue`) and **Movements** (`/issue/movements`).

On the **Issue stock** tab:

**FEFO recommendation** — pick a product and it recommends which batch to use, ordered by
earliest effective date (expiry, falling back to best-before, then receipt date). Expired
and quarantined batches are excluded from the plan entirely rather than filtered out
afterwards, so a stale suggestion can't leak one in.

**Issue stock** — pick the batch, enter quantity and a reference. Blocked if it would take
a batch negative. Button: **Issue stock**.

On the **Movements** tab:

**Record a movement** — the general-purpose form for every other event: return, damage,
disposal, adjustment, count. Button: **Record movement**.

**Recent issues** — the last issues, each with a **Reverse** button.

**Reverse** — corrections are never edits. Reversing writes an offsetting entry and keeps
the original readable forever. There is no "edit movement" anywhere in this system, on
purpose.

### Products & suppliers

Master data, **administrator and owner only**. Three tabs: **Products** (`/catalog`),
**Suppliers** (`/catalog/suppliers`) and **Deliveries** (`/catalog/deliveries`).

- **Products** — SKU, name, origin, species, process, roast, weight, price, low-stock
  level, reorder point. Adding one also creates its SKU.
- **Suppliers** — name, contact, lead time.
- **Deliveries** — links a supplier to a set of batches.

### Reports & activity

**Administrator and owner only for the CSV export.** Four tabs: **Stock by batch**
(`/reports`), **Movements** (`/reports/movements`), **Activity** (`/reports/activity`) and
**Periodic reports** (`/reports/periods`).

- **Stock by batch** — the position per batch with the date that drives FEFO
- **Movements** — the full ledger with filters
- **Activity** — who did what, when, with before/after values
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

### Accounts

**Administrator and owner only.** `/accounts` — everyone who can sign in, and the form to add
more.

- **The list** gives each account's name, email, role, and whether it is **Active** or
  **Inactive**. Your own row is marked **You** and offers no Deactivate button — you cannot
  deactivate the account you are signed in with.
- **Create an account** — name, email, role, and an optional password. Leave the password
  blank and the account signs in with the demo password **`ProviBeans2026`**; set one and it
  signs in with that instead (at least 6 characters). New accounts can sign in immediately.
- **Deactivate** blocks sign-in and keeps the account, so it can be switched back on with
  **Reactivate** at any time.

---

## 5. Everyday tasks

### Receive a delivery

1. **Batches & receiving → Receive**
2. Enter the batch code from the paperwork — it must be unique
3. Choose the product, quantity and unit
4. Enter expiry and/or best-before. If you supply both, expiry must not be *earlier*
   than best-before; the database rejects it
5. Add the supplier and delivery reference
6. **Receive batch**

The batch appears as `ACTIVE` and its quantity immediately increases *available*.

### Issue stock

1. **Issue & movements → Issue stock**
2. Pick the product. Read the **FEFO recommendation** — it is the batch the plan wants you
   to use, and it tells you why (earliest effective date)
3. If the plan is right, use it. If not, you may pick another active, unexpired batch
4. Enter quantity and a reference
5. **Issue stock**

Overselling is refused — you cannot issue more than the batch holds.

### Hold a batch

**Batches & receiving → Quarantine**, give a reason, press **Quarantine**. The batch drops out
of both the FEFO plan and *available*, and shows under **Blocked batches** on the dashboard.

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

### Create a sign-in account

1. **Accounts** in the left navigation (administrator and owner only)
2. Enter the name and email, and choose a role
3. Optionally set a password — leave it blank to use the demo password `ProviBeans2026`
4. **Create account**

The account can sign in immediately. To block someone, use **Deactivate** on the same screen;
**Reactivate** brings them back. Deactivating never deletes history.

---

## 6. How the numbers work

### Stock is derived, never stored as a total

There is no "quantity: 259" column anywhere. Every figure is computed by folding the
append-only `stock_movements` ledger:

| Figure | Means |
|---|---|
| **On hand** | Physical units present, whether or not they may be issued |
| **Reserved** | Held by a `RESERVE` movement, not yet released |
| **Available** | On hand minus reserved, counting only active, unexpired, unquarantined batches |

A displayed total therefore **cannot drift** from the movements behind it, because it is
derived from them on every read.

### The movement types

`RECEIPT` · `ISSUE` · `RESERVE` · `RELEASE` · `CANCEL` · `RETURN` · `DAMAGE` ·
`QUARANTINE` · `UNQUARANTINE` · `DISPOSE` · `ADJUSTMENT` · `COUNT`

Reserving takes a unit out of *available* but leaves it in *on hand*. Issuing takes it out
of *on hand*. That is why "reserved" is a separate number and not a fudge.

### FEFO

When issuing without naming a batch, the system recommends by **effective date**:
`expiryDate` → `bestBeforeDate` → `receivedAt`, earliest first. Expired and quarantined
batches are excluded from the plan itself, not filtered out afterwards.

### Batch status

`ACTIVE` → issuable · `QUARANTINE` → blocked, with a reason · `DEPLETED` → zero
available · `DISPOSED` → written off

### Dates are checked twice

Once as SQL `CHECK` constraints — the floor that cannot be bypassed — and once in the
application layer, so you get a readable message instead of a constraint error.

---

## 7. Out of scope

Customer ordering is **Future Work** in `project-plan.md`, and *Scope and Limitations* rules
out end-to-end e-commerce and online payment processing. It is therefore not built and not
reachable: there is no cart, no checkout, and no public ordering route.

Holding stock is a different thing and is **in** scope. Reservations are driven from
**Issue & movements → Movements** with the `RESERVE`, `RELEASE` and `CANCEL` movement
types, and the reserved figure appears on **Batches & receiving** and the dashboard.

`npm run verify:frontend` fails the build if `app/cart`, `app/(app)/requests` or
`lib/features.ts` reappear, so the boundary cannot quietly regress.

---

## 8. Checking it still works

Five executable suites. Start the server first for the three HTTP-based ones.

```powershell
npm run verify:all
```

| Suite | Covers |
|---|---|
| `verify:rules` | The database rejects invalid dates, duplicate SKUs and batch codes, zero and negative quantities, negative prices, and orphaned references |
| `verify:inventory` | FEFO excludes expired batches, allocation spills across batches, over-issue and over-reserve are refused, releasing quarantine restores availability, alerts fire and don't duplicate |
| `verify:periods` | Week, month and year boundaries are exact and contiguous, periods never overlap, and each report's closing balance reconciles with the dashboard |
| `verify:smoke` | Anonymous requests to every protected route redirect to login, a forged cookie is rejected, authenticated pages render real data, CSV export refuses anonymous callers |
| `verify:links` | No page is an orphan, no link points at a missing page, and out-of-scope features are genuinely unreachable |

Each prints an `x/y checks passed` summary and exits non-zero on failure, so they can be
wired straight into CI.

The destructive suites run against `DATABASE_URL_VERIFY` (a separate Neon branch) and wipe only that,

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

**Dates rejected: "expiry before best-before"**
Both were supplied and expiry is earlier. Either correct the entry or leave expiry blank.

---

## Where things live

| Path | Contents |
|---|---|
| `app/(app)/` | Authenticated area — the six screens and their tabs |
| `lib/inventory/ledger.ts` | Balance derivation and FEFO |
| `lib/inventory/record.ts` | Every validated write |
| `lib/inventory/alerts.ts` | Alert derivation |
| `lib/auth/session.ts` | Sessions and role guards |
| `lib/db/schema.ts` | All 14 tables |
| `scripts/` | The five verification suites |

See `README.md` for the technical and architectural detail behind all of this.