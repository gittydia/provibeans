# Terminology changes — plain-language UI text

This document records a pass that replaced technical or internal shorthand in the
Provi Beans web UI with words a shop-floor user can read without training. It lists what
changed, what deliberately did **not** change, and where older terminology is still written
down.

Scope: **user-facing text only**. No behaviour, routes, types or logic changed.

---

## Why

The interface used a few terms that only make sense if you already know the inventory
system:

- **FEFO** ("First-Expired, First-Out") appeared as a label, a panel heading and a
  recommendation name. It is a textbook acronym, not a thing a staff member says.
- **Issuable**, **on hand**, **movements** and **ledger** are internal vocabulary. They
  read as jargon on a button or a table header.
- **Effective date** was used for the date that actually decides issuing order (expiry,
  falling back to best-before, then receipt date). "Effective date" hides which date it is.

The goal was to keep every screen's meaning identical while swapping the words.

---

## Before → after

### Acronyms and jargon

| Before | After | Notes |
|---|---|---|
| FEFO | "soonest expiry first" / "earliest expiry" | spelled out in copy, no acronym |
| FEFO recommendation | Recommended batch | the field/panel name on Issue stock |
| FEFO plan | the issue plan | the plan behind the recommendation |
| FEFO watchlist (dashboard panel) | Expiring soon | panel heading |
| Effective date | Use-by date | the date that decides issuing order |
| Issuable / issuable | Ready to issue | badges, prose |
| On hand / on-hand | In stock | figure labels, table headers, prose |
| Movement(s) | Stock change(s) | tab names, buttons, headings, copy |
| Movement ledger / ledger | Stock history | tables, CSV, prose |
| Master data | Records | navigation and role descriptions |
| Depleted | Used up | status prose |

### Concrete examples

| Surface | Before | After |
|---|---|---|
| Left nav item | Issue & movements | Issue & stock changes |
| Reports tab | Movements | Stock changes |
| Issue form button | Record movement | Record stock change |
| Issue form field | Movement | Stock change |
| Adjust form button | Record movement | Record stock change |
| CSV filename (`/reports/movements`) | `provi-beans-movements.csv` | `provi-beans-stock-changes.csv` |
| Dashboard panel | Recent movements | Recent stock changes |
| Periods report row | Opening on hand / Closing on hand | Opening stock / Closing stock |
| Periods report row | Movements | Stock changes |
| Periods report heading | Movement summary | Stock change summary |
| Periods report heading | Summary by movement type | Summary by stock change type |
| Periods report empty state | No movements in this period | No stock changes in this period |
| Notifications | "…expires soon. Issue it next." | "…reaches its use-by date soon. Issue it first." |

### Store / toast messages

| Before | After |
|---|---|
| "There is not enough issuable stock for this movement." | "There is not enough stock ready to issue for this change." |
| "Not enough unreserved stock." | "That is more than the unreserved stock." |
| "Not enough reserved stock." | "That is more than the reserved stock." |
| "Movement not found." | "Stock change not found." |
| "This movement has already been reversed." | "This stock change has already been reversed." |
| `Reversal of movement #<id>` | `Reversal of stock change #<id>` |
| `<label> on <batch>.` (receipt/reversals) | unchanged phrasing, plain already |
| "Movement #<id> reversed." | "Stock change #<id> reversed." |

---

## Deliberately unchanged

These were reviewed and kept, because changing them would lose meaning or fight the domain:

- **Quarantine / Held.** "Quarantine" is the real operating procedure for suspect stock and
  the batch status is literally `QUARANTINE`. Badges, tabs and buttons keep the word.
  Explanatory prose may say "on hold" where it reads more naturally, but the label stays
  "Quarantine".
- **Reserved / Available.** Precise stock states, both already plain.
- **Best before / Expires / Expiry.** Standard date vocabulary.
- **Code identifiers and stable keys.** All of the following keep their names so types,
  routing and data stay intact:
  - Types: `MovementType`, `MOVEMENT_LABELS` (keys), `MOVEMENT_FILTERS`, `BatchStatus`, `Role`.
  - Values: `isIssuable`, `fefoPlan`, `fefoWatch`, `onHand`, `ON_HAND_EFFECT`,
    `RESERVED_EFFECT`, movement codes `RECEIPT`/`ISSUE`/`RESERVE`/… .
  - Routes: `/issue`, `/issue/movements`, `/reports/movements`, `/batches/quarantine`, etc.
  - Table/module names in code: `stock_movements`, `lib/inventory/ledger.ts`.

  `MOVEMENT_LABELS` **values** (e.g. "Stock received", "Issued to an order") were already
  plain and were not touched.

- **`docs/ui-layout-alignment.md`.** Left as-is: it is a point-in-time audit of a specific
  commit, and its line at `:419` quotes the pre-change copy ("FEFO — recommended
  automatically") as the thing that was wrong. Rewriting history there would make the audit
  read false. The reference is noted below instead.
- **`project-plan.md`.** Left as-is: it is the capstone proposal and defines the terms
  (FEFO, quarantine, etc.) for the academic audience. See "Definition of Terms" (~lines
  87–119) and the FEFO definition at `:95`.

---

## Documents that still use the old terms

| File | Old-term references | Action |
|---|---|---|
| `docs/ui-layout-alignment.md` | `:59` (FEFO watchlist), `:419` ("FEFO — recommended automatically") | intentional historical record; not changed |
| `project-plan.md` | FEFO throughout, incl. Definition of Terms `:95`; "movement history" `:57`, `:77` | intentional (academic proposal); not changed |
| `DESIGN.md` | `:6`, `:52`, `:54`, `:73` (FEFO, "Ledger List") | left; describes capability, not UI copy |
| `notifications-audit-and-implementation.md` | "movement ledger" / "ledger" (`:56`, `:77`, `:114`, `:501`) | left; internal design doc |
| `USER_GUIDE.md` | terminology updated to match the new labels; **unrelated staleness left in place** — see below | partially updated |

### Known stale content in `USER_GUIDE.md` (not fixed in this pass)

`sections 1, 8 and "Where things live"` describe a backend that the current app does not
have (the project is frontend-only / browser-local). They were **not** corrected here because
that is out of scope for a terminology pass:

- `npm run db:migrate`, `npm run db:seed`, `npm run db:generate` — scripts no longer exist.
- `DATABASE_URL`, `DATABASE_URL_VERIFY`, Neon, `.env.example` — no database is used.
- `verify:rules`, `verify:inventory`, `verify:periods`, `verify:smoke`, `verify:links`,
  `verify:cart` — the suites are now `verify:frontend` and `verify:layout`.
- `lib/inventory/ledger.ts`, `lib/inventory/record.ts`, `lib/db/schema.ts` — not present;
  state lives in `lib/mock-store.tsx` and `lib/inventory/periods.ts`.

---

## Verification

- `npm run verify` — `tsc --noEmit` clean; `verify:frontend` 7/7 checks passed.
- Grep across `app/` and `lib/` finds no remaining user-facing jargon; the only surviving
  occurrences of the old words are the code identifiers listed above.

The application's ground truth remains `lib/mock-store.tsx` (state and mutations) and
`lib/inventory/periods.ts` (period maths).
