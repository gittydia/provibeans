# Provi Beans

**New here? Read [`USER_GUIDE.md`](USER_GUIDE.md)** — how to run it, sign in, and use every
screen. This README is the technical and architectural reference behind that.

The **Provi Beans Coffee Inventory and Stock Monitoring System** — a lot-level inventory application
for administrator, inventory staff and owner/manager roles.

There is no public site. The root URL redirects to `/login`, and everything behind the session guard:

- **`/login` → `/dashboard`** — sign in, then the dashboard

Product artwork appears inside the system itself, on the dashboard and the products table.

---

## Requirements

- Node.js 20 or newer
- npm

The system runs on **PostgreSQL** via Neon. Point `DATABASE_URL` at your connection string; see
[Setup](#setup).

---

## Setup

```bash
npm install
npm run db:migrate     # create the schema
npm run db:seed        # load demo users, suppliers, products, deliveries, lots
npm run dev            # http://localhost:3000
```

For a production run:

```bash
npm run build
npm run start
```

---

## Demo accounts

All three use the password **`ProviBeans2026`**.

| Email | Role | Can do |
|---|---|---|
| `admin@provibeans.ph` | Administrator | Everything, including master data and reports |
| `staff@provibeans.ph` | Inventory staff | Receive, issue, move stock; master data is read-only |
| `owner@provibeans.ph` | Owner / manager | Master data, reports and CSV export |

---

## What the system does

### Stock is derived, never stored as a total

Quantities live in an append-only `stock_movements` ledger. On-hand, reserved and available figures are computed
from that ledger on every read, so a displayed total can never drift from the movements behind it.

| Concept | Meaning |
|---|---|
| **On hand** | Physical units present, regardless of whether they may be issued |
| **Reserved** | Committed to an approved request but not yet released |
| **Available** | On hand minus reserved, and only when the lot is active and unexpired |

### FEFO — First Expired, First Out

When issuing without naming a lot, the system recommends the lot with the earliest effective date, where
*effective date* is expiry, falling back to best-before, then receipt date. Expired and quarantined lots are
excluded from the plan entirely rather than filtered afterwards, so a stale list can never let one slip out.

### Alerts are derived, not maintained

`evaluateAlerts()` recomputes the entire exception set from current stock on every load: low stock, reorder
point, near expiry, expired, quarantine and count variance. It inserts what has newly become true and resolves
what has stopped being true, so nobody has to remember to close an alert.

### History is never edited

Corrections are made with `reverseMovement`, which writes an offsetting entry and records the reason. The
original row stays readable forever. This is why there is no "edit movement" anywhere in the interface.

### Lot dates are validated twice

Once in SQL as `CHECK` constraints — the floor that cannot be bypassed — and once in the application layer so
the operator gets a readable message instead of a constraint error.

---

## Architecture

```
app/
  login/                      sign-in (client form + server action)
  (app)/                      authenticated area
    layout.tsx                session guard + shell
    dashboard/                alerts, stock, FEFO watchlist
    lots/                     lot register and receiving
    issue/                    FEFO issuance and movements
    catalog/                  products, suppliers, deliveries
reports/                  ledger, lot report, activity log
    reports/export/route.ts   CSV export (role-guarded)
    requests/               order reservations, confirm / fulfil / cancel
    ui/action-form.tsx        shared form + field-error wiring
  cart/                      cart and checkout (404 unless NEXT_PUBLIC_COMMERCE=1)
lib/
  db/schema.ts                14 tables, relations, constraints
  db/index.ts                 Neon Postgres pool (WebSocket, transactional)
  db/seed.ts                  demo dataset
  auth/password.ts            scrypt hashing and verification
  auth/session.ts             session cookies, role guards
  inventory/ledger.ts         balance derivation, FEFO, summaries
  inventory/record.ts         every validated mutation
  inventory/alerts.ts         alert derivation
  actions/                    server actions
scripts/
  verify-rules.mjs            database constraint suite
  verify-inventory.mts        inventory logic suite
  smoke.mjs                   HTTP end-to-end suite (auth + protected routes)
  smoke-cart.mjs              cart and checkout end-to-end suite
  check-links.mjs             session guard, dead routes, screen reachability
```

### Data model

`users` · `sessions` · `suppliers` · `products` · `deliveries` · `lots` · `stock_movements` · `alerts` · `audit_logs` · `order_requests` · `order_request_lines` · `order_reservations` · `carts` · `cart_items`

The load-bearing decision: **dates and quantities belong to the lot, not the product.** A product total cannot
express which units expire first, so FEFO and traceability are impossible without it.

---

## How reservations work

> **The public `/order` route was deleted, not flagged.** Customer ordering is named under the plan's *Future
> Work*, and the enquiry channel it also hosted had no basis in the plan at all — "enquir", "inquir", "contact",
> "message" and "email" appear **zero** times in `project-plan.md`. Both are gone.

What remains is inventory work. A reservation **holds stock**, which is squarely Chapter I, so the engine and
its staff interface stay live and stay tested:

| Step | What happens |
|---|---|
| Request created | `order_requests` row created, lines allocated via FEFO, `RESERVE` movements written |
| Available drops | The held units immediately leave `available` for everyone, including staff |
| Staff confirm | Status moves to `CONFIRMED` |
| Staff fulfil | `ISSUE` + `RELEASE` movements written, request closes as `FULFILLED` |
| Staff cancel | `CANCEL` movements written, stock returns to `available` |

Allocation runs across lots in FEFO order — the same engine staff use when issuing — and expired or quarantined
lots can never contribute. A request that cannot be fully covered is recorded as `PARTIAL` or `SHORT` with a note,
rather than rejected. Every state change is written to the audit log with the reference.

Staff see and action all of this at `/requests`.

---

## Routes

| Route | Status | What it does |
|---|---|---|
| `/` | **Redirect** | 307 to `/login` |
| `/cart` | **Disabled (404)** | Cart and checkout — built, but switched off |
| `/coffee/*`, `/order` | **Removed (404)** | The public site and enquiry channel, both out of scope |

### Two different treatments, for two different reasons

| Feature | Treatment | Why |
|---|---|---|
| Cart and checkout | **Flagged off** — `NEXT_PUBLIC_COMMERCE=1` restores it | Built, tested, and worth keeping intact; it is one env var away |
| `/order` + enquiries | **Deleted outright** | Nothing in the plan supports them, and no flag would make them in-scope |

The plan puts e-commerce outside Chapter I — *"will not perform … online payment processing, or end-to-end
e-commerce unless these are later approved as extensions"* — and defers *"customer ordering"* to Future Work.
For enquiries the position is blunter: `enquir`, `inquir`, `contact`, `message` and `email` each appear **zero**
times in `project-plan.md`. There was no scope to defer them to, so they were removed rather than hidden.

What survives is inventory work. `lib/inventory/orders.ts`, the `order_requests` / `order_request_lines` /
`order_reservations` tables and the staff view at `/requests` remain live, because holding and allocating stock
is squarely Chapter I. With commerce enabled the cart checkout still reaches that engine.

```bash
# PowerShell — restore the cart
$env:NEXT_PUBLIC_COMMERCE="1"
npm run build; npm run start
npm run verify:cart          # 18/18
```

While disabled, `verify:cart` prints `SKIPPED` and exits 0 so `verify:all` stays meaningful. `verify:smoke` and
`verify:links` assert the *absence* of everything out of scope: nothing links to `/cart`, `/cart` 404s, no
product page offers add-to-cart, `/order` 404s, and nothing links to it either. Scope compliance is enforced by
tests, not by intention.

---

## Verification

Six executable suites, each independent and repeatable.

```bash
npm run verify:rules        # 10/10  database constraints
npm run verify:inventory    # 33/33  FEFO, reservations, blocking, alerts, balances
npm run verify:periods      # 50/50  week/month/year boundaries, period aggregation
npm run verify:smoke        # 32/32  HTTP, auth guard, protected routes, scope compliance
npm run verify:cart         # SKIPPED by default; 18/18 when NEXT_PUBLIC_COMMERCE=1
npm run verify:links        # 25/25  root redirect, session guard, reachability
npm run verify:all          # all six in sequence (server must be running)
```

The two destructive suites run against `DATABASE_URL_VERIFY` — a separate **Neon branch**, which is an
isolated copy of the database. They truncate every table, so they must never be pointed at the database the
application itself uses. Neon branches make that isolation trivial and free.
The three HTTP suites expect `npm run start` (or `npm run dev`) already serving on port 3000.

### Periodic reports

`/reports/periods` summarises the ledger over a **week, a month or a year**, with a CSV export
named after the period.

Boundaries are UTC and exact: weeks are ISO weeks (Monday–Sunday), months and years end on the
final millisecond. Consecutive periods abut to the millisecond and never overlap, so no movement
can fall through the gap between two reports. Opening and closing balances are folded from the
same `ON_HAND_EFFECT` / `RESERVED_EFFECT` tables the dashboard uses, so a report can never
disagree with the live figures.

Switching granularity carries an anchor clamped into the period being viewed, **not** the
period's start date. ISO week 1 begins on 29 December of the previous year, so keying off the
start date sent "weekly → yearly" to the previous, empty year and made every figure read zero.
`verify:periods` pins this case.

Reservations are reported **separately** from on-hand changes. A hold removes units from
*available* but leaves them physically present, so treating a reservation as stock leaving the
building would overstate movement. `verify:periods` asserts the report's closing balance equals
the ledger's.

### What the rule suite proves

Invalid dates, duplicate SKUs and lot codes, zero and negative quantities, negative prices and weights, and
orphaned foreign keys are all rejected by the database itself.

### What the logic suite proves

FEFO excludes expired lots and orders by earliest effective date; expired and quarantined lots cannot be issued
or reserved; allocation spills correctly across lots; over-issue, over-reserve and over-damage are refused;
releasing a quarantine restores availability; reserved units leave `available`; alerts fire and do not duplicate
on re-run.

### What the smoke suite proves

Anonymous requests to every protected route redirect to login; a forged session cookie is rejected; authenticated
requests render real seeded data; the CSV export returns ledger rows and refuses anonymous callers. It also asserts
which public commerce surface is present, so a deferred feature cannot quietly reappear.

### What the cart suite proves

A real browser-shaped walkthrough over HTTP: sign in, open `/cart`, adjust quantity, then check out and assert in
the database that an order request was written, `RESERVE` movements exist, and the cart was emptied.

It is **skipped by default** because the feature is disabled — see [Routes](#routes). It prints `SKIPPED` and
exits 0, so `verify:all` stays meaningful while the cart is hidden.

Note that the public product pages that fed the cart are gone, so enabling the flag alone no longer gives a
browsable catalogue.

### What the link-integrity suite proves

There is no public site to crawl, so this suite checks the shape of an internal tool instead: the root really
redirects to sign-in, **no** protected screen is reachable by an anonymous visitor, every screen is reachable
once signed in, and nothing links to a route that has been removed (`/coffee/*`, `/order`, or the disabled cart).

The original version of this suite existed because a page was twice shipped in a state where it rendered
perfectly but nothing linked to it. The lesson still applies — asserting that a page *renders* is not the same as
asserting that anyone *reaches* it.

`verify:links` signs in as the owner and fails on:

- the root not redirecting to `/login`
- any protected screen reachable without a session
- any screen unreachable from another screen once signed in
- any **product** in the database without a linked detail page
- the root redirects to `/login`, and no screen is reachable without a session
- every screen is reachable from another screen once signed in
- nothing links to a route that has been removed (`/coffee/*`, `/order`) or disabled (`/cart`)

It was originally written to catch orphaned public pages, and was verified by reverting the card links and
confirming the suite failed with all three product pages named as orphans (`9/14`).

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run db:generate` | Generate a migration after editing the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | **Destructive reset** of all demo data — see below |

> `npm run db:seed` deletes every table before re-inserting: users, suppliers, products, deliveries, lots,
> movements, alerts, audit logs, **and all order requests, reservations and carts**. It is a clean-slate
> tool for demos or recovery, not an update — run it and any order history is gone.
>
> To change one seeded value without destroying anything, edit `lib/db/seed.ts` *and* run a scoped `UPDATE`
> against the row you want to change.
>
> The seed sets `foreign_keys = OFF` while clearing, so a table left out of that list would leave rows pointing at
> records that no longer exist. `PRAGMA foreign_key_check` returns zero violations after a seed.
| `npm run verify:rules` | Database constraint suite |
| `npm run verify:inventory` | Inventory logic suite |
| `npm run verify:periods` | Periodic report suite |
| `npm run verify:smoke` | HTTP suite (server must be running) |
| `npm run verify:cart` | Cart and checkout end-to-end suite |
| `npm run verify:links` | Link integrity suite (server must be running) |
| `npm run verify:all` | All six suites in sequence |
| `npm run verify` | Rules + inventory suites |

---

## Security notes

- Passwords are hashed with scrypt (N=16384) and verified in constant time.
- Sessions are random 256-bit tokens in `httpOnly`, `sameSite=lax` cookies.
- Role checks run server-side on every protected route and mutation; hiding a button is never the control.
- CSV export is restricted to administrator and owner.
- All SQL goes through Drizzle's parameterised builder; no string interpolation of user input.

### The `Secure` cookie flag

Browsers drop a `Secure` cookie when the page is served over plain HTTP. Because `npm run start` sets
`NODE_ENV=production`, keying the flag off `NODE_ENV` alone breaks local production runs: sign-in appears to do
nothing, because the session never comes back on the next request.

`shouldUseSecureCookie()` in `lib/auth/session.ts` therefore exempts loopback hosts (`localhost`, `127.0.0.1`,
`::1`), trusts an `x-forwarded-proto` header when a proxy is present, and otherwise defaults to the
`NODE_ENV` behaviour. Real deployments on a non-loopback host still get `Secure` automatically.

To override explicitly, set `SESSION_COOKIE_SECURE=true` or `false`.

---

## Known limitations

- **Product photography is thumbnail resolution** (156×296 to 185×296 px). The system shows them as small
  table thumbnails so nothing smears. Higher-resolution exports would look sharper in the catalogue.
- **Single logical inventory location.** The schema does not model multiple warehouses yet.
- **No account management UI.** Users are created by the seed script; there is no self-service registration,
  which is deliberate for an internal tool but would need building before external use.
- **Session pruning is manual.** Expired rows are ignored on read; a periodic `pruneExpiredSessions()` call is
  available but not yet scheduled.
- **No automated test framework.** Correctness is demonstrated by the five executable suites above rather than
  a runner such as Vitest. Each one exits non-zero on failure and prints a `x/y checks passed` summary, so they
  can be wired into CI as-is.
- **No visual regression coverage.** Chrome cannot be launched in this environment (Playwright fails with
  `spawn UNKNOWN`), so layout is verified by HTTP content assertions and by the design contract in `DESIGN.md`,
  not by screenshot comparison. A human pass at 375 / 430 / 768 / 1024 / 1440 / 1920 px is still outstanding
  for the dashboard and catalog tables.