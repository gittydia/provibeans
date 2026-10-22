# Provi Beans — User Guide

Everything you need to run, use, and explain this system. Written for a person sitting in
front of it, not for someone reading the source.

This is a frontend-only demonstration. All data — products, batches, stock movements,
accounts, and the audit trail — lives in your browser. Nothing is sent anywhere, and no
database or server is involved.

---

## Contents

1. [Running it](#1-running-it)
2. [Signing in](#2-signing-in)
3. [Getting in](#3-getting-in)
4. [The inventory system, screen by screen](#4-the-inventory-system-screen-by-screen)
5. [Everyday tasks](#5-everyday-tasks)
6. [How the numbers work](#6-how-the-numbers-work)
7. [Out of scope](#7-out-of-scope)
8. [Checking it still works](#8-checking-it-still-works)
9. [Troubleshooting](#9-troubleshooting)
10. [Where things live](#where-things-live)

---

## 1. Running it

**You need:** Node.js 20 or newer, and npm. Nothing else — no database server, no
environment file, no data setup.

```powershell
npm install
npm run dev            # http://localhost:3000
```

The demo data is bundled with the application, so the first load already has products,
suppliers, batches, stock history, and three accounts.

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
| `npm run typecheck` | TypeScript, no files written |
| `npm run verify:frontend` | Fails if database code, route handlers, or out-of-scope screens reappear |
| `npm run verify` | `typecheck` plus `verify:frontend` — needs no server |
| `npm run verify:layout` | Browser geometry checks — needs the app running |
| `npm run verify:all` | `verify`, then `verify:layout` |

### Making it fresh again

There is nothing to re-seed. Changes live in this browser's site data, so:

- **Reload** keeps your changes.
- **Clear site data** for `localhost:3000` (or use a private window) restores the bundled
  demo state.
- **Download a backup first** from `/accounts` if you want to come back to where you were.

---

## 2. Signing in

Go to **`/login`**. The staff area is not public — the root URL redirects here, and you
stay here until you sign in.

All three demo accounts use the password **`ProviBeans2026`**. The form pre-fills the
administrator, so you only need to enter the password and press Sign in.

| Email | Role | What they can do |
|---|---|---|
| `admin@provibeans.ph` | Administrator | Everything, including records, reports, accounts, and backups |
| `staff@provibeans.ph` | Inventory staff | Day-to-day stock work; records and reports stay read-only or hidden |
| `owner@provibeans.ph` | Owner / manager | Read-only oversight: every screen and the activity log, no writes |

### What the roles actually control

Four checks decide the restricted screens, and each is applied twice — the navigation
entry is hidden where the role has no access **and** the page refuses:

- **`canWriteStock`** → administrator and inventory staff. Receiving, quarantining and
  releasing, issuing, adjusting, and reversing.
- **`canManageMasterData`** → administrator only. Products, suppliers, and deliveries.
- **`canViewReports`** → administrator and owner. Every report screen and its CSV export.
- **`canManageAccounts`** / **`canViewAccounts`** → an administrator manages accounts,
  backups, and restores; the owner may read the account list.

The **owner is read-only**: every screen stays visible, including the account list and the
activity log, but entry forms are replaced by a notice such as *"Your role has read-only
access. Only an administrator may record deliveries."* Inventory staff keep the operations
that need doing every day, while records and reports stay read-only or hidden.

These checks are browser-side behaviour, not a security boundary. See
[`docs/data-protection.md`](docs/data-protection.md) for exactly what that means.

### Getting signed out

A session ends when you use the sign-out control, or after **thirty minutes without
activity**. Moving the pointer or typing counts as activity, so ordinary use keeps you in.
Both kinds of sign-out are recorded in the audit trail under `SIGN_OUT`.

Signing in and out is also audited (`SIGN_IN`), so the Activity report can show when an
account was used.

---

## 3. Getting in

There is no public website. The system is internal, so:

| Route | What happens |
|---|---|
| `/` | Redirects to `/login` |
| `/login` | The sign-in page |
| everything else | Shows the sign-in page until you are signed in |

After signing in you land on the **Dashboard**. **Sign out** is in the app shell.

Product artwork lives inside the system: you will see each coffee's pouch as a thumbnail on
the **Dashboard** and in the **Products** table under Products & suppliers.

The **bell** in the app shell shows unread notifications; **`/notifications`** lists them
all, with **Mark all read** and a per-item mark-read control.

---

## 4. The inventory system, screen by screen

Six entries in the left navigation. **Dashboard** and **Accounts** are single pages; the
other four are section pages with **tabs** — the tab strip sits under the page heading, and
each tab is its own route with its own URL. **Reports & activity** appears only for
administrators and owners; **Accounts** is hidden from inventory staff.

### Dashboard — "Stock control"

The morning-glance screen. Four figures across the top, then five panels.

**Top row:** Inventory value · Available · Reserved · Open alerts

| Panel | What it tells you |
|---|---|
| **Alerts** | Everything that needs a human decision today, with a link to the batch or product |
| **Stock by product** | A thumbnail of the pack, then in stock / reserved / available per SKU, plus a **State** badge |
| **Expiring soon** | Batches approaching their use-by date, soonest first |
| **Blocked batches** | Quarantined, expired, or disposed batches, with the reason |
| **Recent stock changes** | The most recent stock history entries |

**The State badge** is derived, not typed in. It reads one of:

| Badge | Means |
|---|---|
| **Above reorder point** | Available is above the reorder point — nothing to do |
| **Reorder** | Available has reached the reorder point |
| **Low stock** | Available is at or below the low-stock level |
| **Expired hold** | Reserved units sit on a batch that has since expired |

It always describes the **available** figure, never in-stock.

**Alerts** are derived the same way, from live stock: `LOW_STOCK` and `EXPIRED` are
critical, `REORDER`, `NEAR_EXPIRY`, and `QUARANTINE` are warnings. Nothing stores a
"closed" flag, because fixing the stock is what clears the alert.

### Batches & receiving

Three tabs: **All batches** (`/batches`), **Receive** (`/batches/receive`) and
**Quarantine** (`/batches/quarantine`).

**All batches** — the full register, one row per batch with its dates, status and balances.

**Receive** — the form you use when a delivery arrives. Fields: batch code (pre-filled with the
next free code for the selected product and month; must be unique across all stock), product, an
optional delivery to link it to, quantity, received date, roasted, packed, best-before, expiry, and
notes. Button: **Receive batch**.

**Quarantine** — holds a batch so it can never be issued. Give a reason; it is stored on the
batch and shown wherever the batch appears. Button: **Quarantine**. **Release to available**
puts a quarantined batch back into service, which is recorded as its own movement.

Quarantined batches drop out of the issue plan and out of *available*, and appear under
**Blocked batches** on the dashboard.

### Issue & stock changes

Two tabs: **Issue stock** (`/issue`) and **Stock changes** (`/issue/movements`).

On the **Issue stock** tab:

**Recommended batch** — pick a product and the batch list leads with *"Soonest expiry
first — recommended"*, ordered by earliest use-by date (expiry, falling back to best-before,
then received date). Expired and quarantined batches are excluded from the plan itself
rather than filtered out afterwards, so a stale suggestion cannot leak one in.

**Issue stock** — pick the batch, enter quantity, a reason, and a reference. Blocked if the
amount exceeds what the batch can cover. Button: **Issue stock**.

On the **Stock changes** tab:

**Record a stock change** — the general-purpose form for everything else: reservations,
releases, returns, damage, disposals, adjustments, and physical counts. An adjustment must
say whether it increases or decreases; a count takes the counted quantity and records the
difference from the ledger.

**Recent issues** — the recent issues, each with a **Reverse** button and a reason field.

**Reverse** — corrections are never edits. Reversing writes an offsetting entry and keeps
the original readable forever. There is no "edit stock change" anywhere in this system, on
purpose.

### Products & suppliers

Records, **administrator only**. The owner and inventory staff see the tabs with a read-only
notice. Three tabs: **Products** (`/catalog`),
**Suppliers** (`/catalog/suppliers`) and **Deliveries** (`/catalog/deliveries`).

- **Products** — SKU (suggested from the name and weight, but still yours to set), name, weight in
  grams, unit price, origin country and region, species or blend, process, roast level, low-stock
  level, reorder point, and how many days ahead to flag near-expiry. Products can be deactivated
  rather than deleted, so history keeps their names.
- **Suppliers** — name, contact person, email, phone, country, address, and notes. Names
  must be unique.
- **Deliveries** — supplier, received date, and notes, listed with a reference. Link a
  delivery to a batch when you receive stock: the receiving form's **Delivery** field offers
  the recorded deliveries.

### Reports & activity

**Administrator and owner only**, including the exports. Four tabs: **Inventory reports**
(`/reports`), **Stock changes** (`/reports/movements`), **Activity**
(`/reports/activity`) and **Periodic reports** (`/reports/periods`).

**Inventory reports** is a hub of six panels:

| Panel | Answers |
|---|---|
| Stock by product | What do we hold, what is reserved, and what can be issued? |
| Stock by batch | Which lots remain, and in what state? |
| Reorder list | What is at or below its reorder point, and by how much? |
| Near-expiry and expired lots | Which lots need action, and how soon? |
| Damaged and disposed stock | What was written off, and why? |
| Physical count variances | Where did the counted stock disagree with the ledger? |

Every panel has **Export CSV**, which exports the whole filtered result — not just the rows
on screen.

**Stock changes** — the complete movement history with product and text filters, and the
total shown in the panel header. There is no row cap; the list scrolls.

**Activity** — who did what, when, with before/after values. Filter by actor, action, text,
and date range; export the result.

### Periodic reports

**`/reports/periods`** — the same stock history summarised over **a week, a month or a
year**.

Switch granularity with the **Weekly / Monthly / Yearly** chips, then step through periods
with **← Previous** and **Next →**. The URL is shareable — it carries the granularity and
the period, so `?g=month&d=2026-03-15` always opens March 2026.

Each report shows:

| Figure | Meaning |
|---|---|
| **Opening stock** | Units in stock at the very start of the period |
| **Closing stock** | Units in stock at the end |
| **Net change** | Closing minus opening |
| **Stock changes** | How many stock history entries the period contains |
| **Reserved at close** | Holds still outstanding, with the opening figure alongside |

Then a **stock change summary** table breaking the period down by type — receipts, issues,
returns, damage, disposal, adjustments, physical counts, reservations made, releases,
cancellations, quarantines, and releases from quarantine — each with a note on whether it
moves stock or only changes what is ready to issue.

Finally a **by product** table: units in, out, returned, lost, and net change per SKU.

**Download this period as CSV** gives you the same figures as a file, named after the period
(for example `provi-beans-2026-03.csv`). Weeks are **ISO weeks**, running Monday to Sunday.

> Reservations are deliberately reported separately from stock changes. Holding stock
> removes it from *available* but leaves it physically present, so counting a reservation as
> stock leaving the building would overstate the change.

### Accounts

**Administrator manages; owner reads the list.** `/accounts` — everyone who can sign in, the
form to add more, and a backup panel. The owner sees the list without the form or backup
panel; inventory staff are refused.

- **The list** gives each account's name, email, role, and whether it is **Active** or
  **Inactive**. Your own row is marked **You** and offers no Deactivate button — you cannot
  deactivate the account you are signed in with.
- **Create an account** — name, email, role, and an optional password. Leave the password
  blank and the account signs in with the demo password **`ProviBeans2026`**; set one and it
  signs in with that instead (at least 6 characters). New accounts work immediately.
  Only an administrator may create accounts, and the role list offers inventory staff or
  administrator. The Owner role cannot be created from the app, so the seeded owner stays the
  account of last resort.
- **Deactivate** blocks sign-in and keeps the account, so **Reactivate** can bring it back.
  Both are audited.
- **Backup and restore** — **Download backup** saves the full browser state as
  `provi-beans-backup-YYYY-MM-DD.json`. Choosing a file and pressing **Restore** replaces
  local data with that snapshot. If the backup contains your account you stay signed in;
  otherwise you are signed out and asked to sign in again. A restore is recorded in the
  audit trail as `RESTORE`.

---

## 5. Everyday tasks

### Receive a delivery

1. **Batches & receiving → Receive**
2. Check the pre-filled batch code against the paperwork — it is the next free code for that
   product and month, and you can overwrite it. Either way it must be unique
3. Choose the product and quantity
4. Enter the dates; if you supply several, the expiry must be the latest of them
5. Link the delivery if it is already recorded, and add notes
6. **Receive batch**

The batch appears as `ACTIVE` and its quantity immediately increases *available*.

### Issue stock

1. **Issue & stock changes → Issue stock**
2. Pick the product. The batch list leads with the recommended batch and tells you why
   (earliest use-by date)
3. If the recommendation is right, use it. If not, you may pick another active, unexpired,
   unquarantined batch
4. Enter quantity, a reason, and a reference
5. **Issue stock**

Overselling is refused — you cannot issue more than the batch can cover.

### Hold a batch

**Batches & receiving → Quarantine**, give a reason, press **Quarantine**. The batch drops
out of both the issue plan and *available*, and shows under **Blocked batches**.

Press **Release to available** on the same screen to undo it.

### Clear an alert

Alerts are **derived, not maintained**. They are recomputed from live stock on every load:
anything newly true appears, anything no longer true disappears. You don't close alerts by
hand — you fix the stock and the alert is gone next load.

### Correct a mistake

Never edit. Find the stock change, **Reverse** it, and give the reason. The original stays in
the stock history and the audit log keeps both entries.

### Create a sign-in account

1. **Accounts** in the left navigation (administrator only)
2. Enter the name and email, and choose a role
3. Optionally set a password — leave it blank to use `ProviBeans2026`
4. **Create account**

To block someone, use **Deactivate** on the same screen; **Reactivate** brings them back.
Deactivating never deletes history.

### Back up, or move the demo somewhere else

1. **Accounts → Backup and restore → Download backup**
2. Keep the JSON file — it holds products, batches, movements, accounts, and the audit trail
3. On the other browser or machine, open `/accounts` and **Restore** that file

Restoring replaces local data, including the audit trail, which is the point of a snapshot.
Download a fresh backup before restoring if the current state matters.

---

## 6. How the numbers work

### Stock is derived, never stored as a total

There is no "quantity: 259" field anywhere. Every figure is computed by folding the
append-only movement history:

| Figure | Means |
|---|---|
| **In stock** | Physical units present, whether or not they may be issued |
| **Reserved** | Held by a `RESERVE` movement, not yet released |
| **Available** | In stock minus reserved, counting only active, unexpired, unquarantined batches |

A displayed total therefore **cannot drift** from the movements behind it, because it is
derived from them on every read.

### The movement types

`RECEIPT` · `ISSUE` · `RESERVE` · `RELEASE` · `CANCEL` · `RETURN` · `DAMAGE` ·
`QUARANTINE` · `UNQUARANTINE` · `DISPOSE` · `ADJUSTMENT` · `COUNT`

Reserving takes a unit out of *available* but leaves it in *in stock*. Issuing takes it out
of *in stock*. That is why "reserved" is a separate number and not a fudge.

### How the recommended batch works

When issuing without naming a batch, the system recommends by **use-by date**:
`expiryDate` → `bestBeforeDate` → `receivedAt`, earliest first. Expired and quarantined
batches are excluded from the plan itself, not filtered out afterwards.

### Batch status

`ACTIVE` → ready to issue · `QUARANTINE` → blocked, with a reason · `DEPLETED` → nothing
left · `DISPOSED` → written off

### Dates are validated on entry

Expiry must not be earlier than the dates before it, batch codes must be unique, quantities
must be whole numbers above zero, and the form points at the field that is wrong instead of
failing silently. Suggested SKUs and batch codes are only a starting point — the same rules
apply once you change them.

---

## 7. Out of scope

Customer ordering is **Future Work** in `project-plan.md`, and *Scope and Limitations* rules
out end-to-end e-commerce and online payment processing. It is therefore not built and not
reachable: there is no cart, no checkout, and no public ordering route.

`npm run verify:frontend` fails if `app/cart`, `app/(app)/requests`, or `lib/features.ts`
reappear, so the boundary cannot quietly regress.

Holding stock is a different thing and is **in** scope. Reservations are driven from
**Issue & stock changes → Stock changes** with the `RESERVE`, `RELEASE` and `CANCEL`
movement types, and the reserved figure appears on the dashboard, on batches, and in the
periodic reports.

---

## 8. Checking it still works

`npm run verify` needs nothing running:

| Check | Covers |
|---|---|
| `typecheck` | The whole project compiles |
| `verify:frontend` | No database packages, commands, configuration, migrations, imports, or connection variables; no route handlers or server actions; browser-local persistence is present; out-of-scope screens are absent |

`npm run verify:layout` drives an installed Edge or Chrome against a running application:

```powershell
npm run dev
# In another terminal:
npm run verify:layout
```

It measures rendered geometry rather than comparing screenshots: table header alignment,
shared cell gutters, row alignment, card heights, content width, and overflow containment
across fifteen screens and seven viewport sizes. It signs in through the demo form and does
not touch any external data source. With no supported browser installed it prints `SKIPPED`
and exits successfully.

Run everything with `npm run verify:all`, which ends with the layout suite and therefore
expects the app to be running.

The layout contract and its screenshot evidence live in
[`docs/ui-layout-alignment.md`](docs/ui-layout-alignment.md). What each reporting screen
shows, and the data-protection behaviour described above, are documented in
[`docs/inventory-reporting.md`](docs/inventory-reporting.md) and
[`docs/data-protection.md`](docs/data-protection.md).

---

## 9. Troubleshooting

**Everything is empty, or my changes vanished**
The browser's site data was cleared, or you are in a different browser or profile. Reload to
get the bundled demo state back, or restore a backup from `/accounts`.

**I was signed out while reading**
Thirty minutes passed without pointer or keyboard activity. Sign in again; nothing was lost.

**Port 3000 already in use**
Stop the other process, or run `npm run dev -- -p 3001` (or
`npm run start -- -p 3001`) and open that port instead.

**`verify:layout` says the server must be running**
Start `npm run dev` first. The suite measures the rendered page, so it cannot run against
source alone.

**`verify:layout` printed `SKIPPED`**
No supported Edge or Chrome was found. Install one, or set `SMOKE_BASE` if the app is
served somewhere other than `http://localhost:3000`.

**Dates rejected: "expiry before best-before"**
Both were supplied and expiry is earlier. Correct the dates, or leave expiry blank.

**Opening the app from another machine looks broken**
The development server only hands its runtime to origins it recognises. Add that origin to
`allowedDevOrigins` in `next.config.ts`, or reach the app through `localhost`.

**A page shows a "not available to your role" notice**
You are signed in as inventory staff, or as the read-only owner. Reports are limited to
administrators and owners; records, accounts, and backups are limited to administrators.

---

## Where things live

| Path | Contents |
|---|---|
| `app/(app)/` | Authenticated area — the screens and their tabs |
| `app/(app)/nav.tsx` | Navigation entries and which roles see them |
| `lib/mock-store.tsx` | Browser state, sign-in, audit trail, backups, and every validated write |
| `lib/inventory/periods.ts` | Week, month, and year boundaries for periodic reports |
| `lib/inventory/reports.ts` | The derived rows behind each report panel |
| `app/(app)/notifications/` | Notification list, the bell, and the store that derives them from live stock |
| `lib/product-images.ts` | Pouch artwork lookup |
| `scripts/verify-frontend.mjs` | Frontend-only architecture guard |
| `scripts/verify-layout.mjs` | Browser-based layout geometry checks |
| `docs/` | Layout contract, reporting, and data-protection notes |

See `README.md` for development, architecture, and verification detail.
