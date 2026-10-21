# How Provi Beans works, end to end

This document explains the machinery behind every screen: what each piece of data is, where it
lives, what writes it, what reads it, and why it exists in that form. It is written against the
code as committed, not against an intended design.

Read it in order the first time. Sections 2–5 are the model; sections 6–12 are the flows; section 19
has numbered walkthroughs that tie everything together.

- Screen-by-screen instructions: [`USER_GUIDE.md`](../USER_GUIDE.md)
- Reports and exports: [`inventory-reporting.md`](inventory-reporting.md)
- Sign-in, sessions, backups, audit: [`data-protection.md`](data-protection.md)
- Layout contract: [`ui-layout-alignment.md`](ui-layout-alignment.md)

---

## 1. What kind of application this is

Provi Beans is a **frontend-only demonstration** of coffee stock control. There is no database, no
API, no server-side session, and no external service. Everything the application knows lives in a
single JavaScript object inside the browser, persisted to `localStorage`, and every rule is enforced
in client code.

That decision is not incidental. It sets the tone of the whole design:

| Because there is no server | The design instead does |
|---|---|
| No stored procedures or constraints to catch bad writes | Every mutation validates in `commit()` callers before touching state |
| No shared database clock or transaction log | One append-only `movements` array acts as the transaction log |
| No server session | `currentUserId` + `lastActivityAt` in local state, with a 30-minute idle expiry |
| No per-user data isolation | Roles gate the UI; the whole dataset is readable in devtools |
| No backup service | JSON export/import through the browser |

The last column is the spine of the document: **one ledger, everything else computed.**

---

## 2. The one idea: an append-only ledger, with everything else derived

The application never stores "current stock". There is no `quantityOnHand` column anywhere. What it
stores is a list of **movements** — signed history — and it recomputes balances by replaying that
list every time a page renders.

```text
        forms (typed input)
               |
               v
   +--------------------------+        one write path
   |  commit(draft => ...)     |  each mutation:
   |                          |   1. clone current state
   |  movements.push(...)     |   2. append a movement (or set a status)
   |  audit.push(...)         |   3. append an audit entry
   +------------+-------------+   4. save to localStorage
                |
                v
   +--------------------------+        every read path
   |  buildBatchViews(state)  |   replay movements per batch:
   |    onHand, reserved,     |     RECEIPT +1, ISSUE -1, ...
   |    available, days,      |
   |    isExpired, isIssuable |   then classify state
   +------------+-------------+
                |
      +---------+---------+----------+-----------+
      v         v         v          v           v
  dashboard  batches   issue      reports    alerts
  totals     table     pickers    panels     (LOW, REORDER,
                                              EXPIRED, ...)
```

Why it is built this way:

1. **No drift.** A stored total can disagree with its history. A replayed total cannot: it *is* the
   history.
2. **Reversals are free.** Undoing a mistake is another movement with the opposite sign, so the
   correction is visible instead of erasing the original.
3. **Reporting is a projection.** Every report panel is a function of the same two arrays the
   operating screens use, so a number can never mean two different things on two screens.
4. **The demo stays small.** No migrations, no reconciliation job, no cache invalidation — the
   replay is over tens of rows.

The cost, accepted deliberately: replay is O(movements) per render, and a fabricated movement in
devtools is indistinguishable from a legitimate one.

---

## 3. Entity reference — what is what

All types are defined in `lib/mock-store.tsx` (lines 14–166). The single root object is `MockState`.

### 3.1 `MockState` — the whole application

| Field | Type | Why it exists |
|---|---|---|
| `version` | literal `3` | Storage schema guard. A stored object without `version === 3` is discarded and reseeded, so an old shape can never crash a page |
| `currentUserId` | `number \| null` | The demo "session". `null` means signed out |
| `lastActivityAt` | ISO string | Drives idle expiry; written at most once a minute |
| `users` | `User[]` | Sign-in directory plus role assignments |
| `products` | `Product[]` | The catalogue: what can be received and issued |
| `suppliers` | `Supplier[]` | Who delivers |
| `deliveries` | `Delivery[]` | Shipment headers that batches can attach to |
| `batches` | `Batch[]` | Physical lots: the unit of expiry and the unit stock is counted in |
| `movements` | `Movement[]` | **The ledger.** Every quantity change, append-only |
| `audit` | `AuditEntry[]` | Who did what, in prose-adjacent structured form |
| `notifications` | `NotificationItem[]` | Inbox messages (seeded demo fixtures — see §13) |

### 3.2 `Product`

| Field | Example | Why |
|---|---|---|
| `sku` | `PB-HN-250` | Human-stable identity used on screens and in CSV; unique, uppercased on create |
| `name` | `HANOI Say Hi` | Display name |
| `originCountry`, `originRegion` | `Vietnam`, `Hanoi Province` | Provenance for the study's traceability story |
| `species`, `process`, `roastLevel` | `Robusta / Arabica`, `Washed`, `Medium` | Descriptive attributes; no logic depends on them |
| `weightGrams` | `250` | Pack size |
| `unitPrice` | `285` | Only used to compute inventory value (`onHand × unitPrice`) |
| `lowStockLevel` | `24` | "Critically low" threshold |
| `reorderPoint` | `60` | "Should reorder" threshold |
| `nearExpiryDays` | `30` | Per-product window for the near-expiry warning; kept per product because green coffee and roasted coffee age differently |
| `isActive` | `true` | Soft retirement flag; inactive products disappear from pickers, history stays |

### 3.3 `Batch`

| Field | Why |
|---|---|
| `code` | Operator-entered lot code (`HN-2601-A`). Unique case-insensitively; uppercased on save. This is the only way a person names a physical lot |
| `productId`, `deliveryId` | What it is, and which shipment it arrived on (`deliveryId` optional) |
| `receivedAt`, `roastDate`, `packDate`, `bestBeforeDate`, `expiryDate` | The date chain. Only the *effective* date matters to logic (§5.2); the rest is evidence |
| `status` | `ACTIVE` / `QUARANTINE` / `DEPLETED` / `DISPOSED` — a **flag**, separate from quantity. Only `QUARANTINE` is set by the app; `DEPLETED`/`DISPOSED` exist in the type but are not assigned |
| `quarantineReason` | Required string when quarantining; cleared on release. Keeps the "why" next to the "what" |
| `notes` | Free text |

Important: **quantity is never on the batch.** A batch owns its dates and status; the ledger owns
its quantity.

### 3.4 `Movement` — the ledger row

| Field | Why |
|---|---|
| `id` | Stable reference; reversals and audit entries point at it |
| `batchId`, `productId` | Both are stored. `productId` is denormalised so reports can group without a join, and because a product can later be deactivated (not deleted) |
| `type` | One of twelve movement types (§9). The type determines the sign via lookup tables, not a stored sign |
| `quantity` | **Always positive, except reversals**, which carry a negative quantity. Sign comes from type + this value |
| `reason` | Free text: operator reason, or a generated one (`Stock received`, `Released from quarantine`, `Reversal of stock change #12`) |
| `reference` | Order/invoice reference (`SO-1104`). For a receipt created from a delivery it is copied from the delivery's reference |
| `reversesId` | Set on a reversal row; `null` otherwise. This is the only link between a mistake and its undo |
| `createdAt` | Timestamp of the write |

`reversesId` does double duty: it labels a correction, and it is the uniqueness guard that stops the
same movement being reversed twice.

### 3.5 `AuditEntry`

`actorName`, `action`, `entity`, `entityId`, `before`, `after`, `createdAt`. `before`/`after` are
JSON strings, not objects, because they are displayed as-is and must survive storage round-trips.
`actorName` is copied at write time rather than referenced by user id so the trail still reads
correctly if the account is later renamed or deactivated.

### 3.6 `NotificationItem`

`type`, `severity` (`INFO`/`WARNING`/`CRITICAL`), `title`, `message`, `entityType`, `entityId`,
`readAt`, `createdAt`. `readAt === null` means unread; `entityType`/`entityId` let a row deep-link to
the product or batch it names.

### 3.7 Supporting view types

- `BatchView` — a batch joined to its product plus computed balances and flags (§5.3). Not stored.
- `FormState` — the uniform return type of every mutation: `{ ok?, message?, error?, fieldErrors?, reference? }`. One shape means every form renders errors the same way.
- `Store` — the context value: `state`, `hydrated`, `user`, and every operation (§4.3).

---

## 4. The state container

`MockStoreProvider` (`lib/mock-store.tsx`, around line 479) wraps the authenticated area. Every screen
reads through `useMockStore()`.

### 4.1 Boot sequence

1. `useState(seedState)` — the very first render (including server render) uses the seed. This avoids
   hydration mismatches: the markup always starts from the same data.
2. A `useEffect` runs once: `loadState()` reads `localStorage["provi-beans-mock-store-v3"]`.
   - Missing, unparseable, or wrong `version` → fall back to `seedState()`.
   - Signed in but `lastActivityAt` older than 30 minutes → drop the session (`currentUserId = null`)
     and persist that, so a stale tab cannot resume as an authenticated user.
3. `setHydrated(true)`. Until then the app shell renders a skeleton (`app/(app)/layout.tsx`), which
   is why there is a brief placeholder instead of a flash of "signed out".
4. A `storage` event listener re-reads state when another tab writes the same key.

### 4.2 `commit` — the only write path

```ts
const next = structuredClone(stateRef.current);  // deep copy
change(next);                                    // mutate the draft
stateRef.current = next;                         // sync ref for the next handler
setState(next);                                  // trigger render
saveState(next);                                 // persist (errors swallowed)
```

Three properties matter:

- **Deep clone** means a half-finished mutation can never partially apply: the draft either reaches
  `saveState` or the handler returns early before `commit` is called.
- **`stateRef` is updated synchronously.** Two mutations in the same event handler (for example
  "create batch then issue stock") see each other's result, because reads go through the ref, not
  through the stale render closure.
- **`saveState` swallows storage errors** (quota, private mode). The session keeps working in memory;
  only persistence is lost. That is intentional for a demo: a failed write must not crash a form.

`reset()` is the exception: it replaces state with `seedState()` wholesale and saves.

### 4.3 What the store exposes

Reads: `state`, `hydrated`, `user` (resolved via `currentUser`, which also requires `isActive`).

Session: `login`, `logout`, `reset`.

Inventory: `createLot`, `quarantineLot`, `releaseLot`, `issueStock`, `adjustStock`, `reverseMovement`.

Master data: `createProduct`, `setProductActive`, `createSupplier`, `createDelivery`.

Accounts: `createUser`, `setUserActive`.

Notifications: `markNotificationRead`, `markAllNotificationsRead`, `pushNotification`.

Data: `exportBackup`, `restoreBackup`.

### 4.4 Persistence format and versioning

`STORAGE_KEY = "provi-beans-mock-store-v3"`. The `v3` suffix and the `version: 3` field are belt and
braces: bumping either discards incompatible saved data rather than migrating it. There is no
migration code by design — a demo that reseeds is easier to reason about than one that upgrades.

---

## 5. The derived layer — how numbers are computed

Everything in this section is a pure function of `MockState`. Nothing here writes.

### 5.1 Balances per batch

```ts
balancesForBatch(state, batchId)  // → { onHand, reserved }
```

It filters `movements` to the batch and reduces using two lookup tables:

| Movement type | `onHand` effect | `reserved` effect |
|---|---|---|
| `RECEIPT` | +1 | — |
| `ISSUE` | −1 | — |
| `RETURN` | +1 | — |
| `DAMAGE` | −1 | — |
| `DISPOSE` | −1 | — |
| `ADJUSTMENT` | +1 (sign carried in `quantity`) | — |
| `COUNT` | +1 (quantity is the *variance*) | — |
| `RESERVE` | — | +1 |
| `RELEASE` | — | −1 |
| `CANCEL` | — | −1 |
| `QUARANTINE` / `UNQUARANTINE` | — | — |

The sign tables live at `mock-store.tsx:193` and `:203`. Reading them is the fastest way to answer
"what does this action actually do to stock".

Note the last row: quarantine does **not** move quantity. It sets `batch.status` and records a
`QUARANTINE` movement whose quantity is the on-hand at the time — a historical note, not a transfer.
Availability is removed by the status flag instead (§5.3), which is why releasing a quarantine
restores stock without any compensating quantity.

### 5.2 Effective date and expiry arithmetic

```ts
effectiveDate(batch) = expiryDate ?? bestBeforeDate ?? receivedAt.slice(0, 10)
```

Fallback order matters: a lot with no printed expiry is judged by its best-before, and failing that
by its receipt date. `daysToExpiry` is computed against *today at date precision*
(`new Date().toISOString().slice(0,10)`), so it does not flicker within a day.

- `isExpired = daysToExpiry < 0` — the day it stops being issuable is the day after the effective date.
- `isNearExpiry = !isExpired && daysToExpiry <= product.nearExpiryDays`.

### 5.3 `BatchView` — the object every table renders

```ts
isQuarantined = status === "QUARANTINE"
isIssuable    = status === "ACTIVE" && !isExpired
available     = isIssuable ? Math.max(0, onHand - reserved) : 0
```

`available` collapsing to `0` for quarantined and expired batches is the single most consequential
rule in the app. It means:

- issuing can never touch held or expired stock (the FEFO plan filters on `isIssuable`);
- product-level "available" excludes unusable stock, so reorder logic responds to *sellable* stock;
- `onHand` still counts it, so totals and inventory value do not hide stock that physically exists.

Views are sorted by `batch.code` so tables are stable regardless of insertion order.

### 5.4 `productSummaries` — the product roll-up

Per product, summed over its views: `onHand`, `reserved`, `available`, `inventoryValue = onHand × unitPrice`,
`lotCount`. Then a single `stockState`:

```text
if any batch has onHand > 0 and is expired      -> EXPIRED_HOLD   (takes precedence)
else if available <= lowStockLevel              -> LOW
else if available <= reorderPoint               -> REORDER
else                                            -> OK
```

`EXPIRED_HOLD` wins because an expired lot holding stock is a disposal problem, not a purchasing
problem — reporting it as "low" would send someone to buy more while stock sits unsellable.

### 5.5 `fefoPlan` — the issuing recommendation

```ts
fefoPlan(state, productId)
  = buildBatchViews(state)
      .filter(v => v.product.id === productId && v.isIssuable && v.available > 0)
      .sort(by daysToExpiry ascending)
```

It returns `{ batchId, batchCode, effectiveDate, daysToExpiry, available }`. It is a **recommendation
generator**, not an automatic allocator: nothing is written until `issueStock` runs, and the operator
may pin a single batch instead.

---

## 6. Session and roles

### 6.1 Sign-in

`login(email, password)`:

1. Trims and lowercases the email. Empty fields return per-field errors.
2. Finds a user by exact email **with `isActive === true`**.
3. Compares against `user.password ?? DEMO_PASSWORD` (`ProviBeans2026`). Accounts created without a
   password fall back to the demo password, which is why the seeded trio always works.
4. Wrong email or password returns one generic message — no distinction, so the form does not
   confirm which half was wrong.
5. On success: `currentUserId`, `lastActivityAt = now`, and a `SIGN_IN` audit row written in the same
   commit.

There is no token, cookie, or hash. The password is compared in plain text in the browser, and this
is documented as a limitation rather than hidden.

### 6.2 Session lifetime

- Every `pointerdown` / `keydown` refreshes `lastActivityAt`, **throttled to one write per 60 s** so
  typing does not rewrite `localStorage` on each keystroke.
- A 30-second interval compares `now - lastActivityAt` to 30 minutes. When it exceeds that, the
  session is cleared and a `SIGN_OUT` audit row is written attributed to the user who was leaving.
- `app/(app)/layout.tsx` redirects to `/login?reason=auth` when hydration completes without a user;
  the Sign out button calls `logout()` and redirects to `/login?reason=signed-out`. The login screen
  distinguishes those two reasons in its copy.

### 6.3 Roles

| Role | Label | Can view reports | Can manage accounts | Can manage catalogue |
|---|---|---|---|---|
| `ADMIN` | Administrator | yes | yes | yes |
| `OWNER` | Owner / manager | yes | yes | yes |
| `INVENTORY_STAFF` | Inventory staff | no | no | no |

Predicates: `canViewReports`, `canManageAccounts`, `canManageMasterData` (`mock-store.tsx:320–330`).

Enforcement is intentionally doubled:

- **Navigation** hides `/reports` and `/accounts` for staff (`nav.tsx:50–51`).
- **Pages** re-check and early-return an explanatory panel (`reports/page.tsx:39`,
  `reports/movements/page.tsx:26`, `reports/activity/page.tsx:43`; `/accounts` uses
  `canManageAccounts`; catalogue screens use `canManageMasterData` to decide whether forms render).

Hiding a link is presentation; the page-level check is what makes "staff cannot see reports" true even
when the URL is typed directly. Neither is a security boundary, because all data is in the browser.

What staff *can* do: receive, quarantine, release, issue, adjust, reverse, and read the operational
screens. What they cannot do: create products, suppliers, or deliveries, view reports, or manage
accounts.

---

## 7. Flow A — Receiving a batch

Screen: `/batches` → *Receive* (`app/(app)/batches/forms.tsx`). Store call: `createLot` (`mock-store.tsx:625`).

### Inputs and why each exists

| Field | Rule | Why |
|---|---|---|
| Batch code | required, unique case-insensitively, uppercased on save | The human handle for a physical lot; duplicates would make the ledger ambiguous |
| Product | must exist | Batches belong to exactly one product |
| Delivery | optional, must be a known delivery | Links the lot to a shipment when one exists; small receipts may have none |
| Quantity | integer > 0 | Physical units; fractional units are meaningless here |
| Received | defaults to today | When the stock entered the building |
| Roasted / Packed | optional | Provenance for freshness disputes |
| Best before / Expires | expiry must be the latest of the entered dates | Prevents a lot being recorded as expiring before it was roasted or packed |
| Notes | optional | Free text |

### What one submit writes

```
1. batches.push({ id, code: CODE, productId, deliveryId, dates…, status: "ACTIVE", quarantineReason: null })
2. movements.push({ type: "RECEIPT", quantity, reason: "Stock received",
                    reference: delivery?.reference ?? null })
3. audit.push({ action: "RECEIVE", entity: "batch", entityId: code, after: { quantity } })
```

Consequences that fall out for free:

- The batch appears immediately with `onHand = quantity`, because the receipt is now in the replay.
- Product availability rises; a product sitting at `REORDER` can flip to `OK` on the dashboard.
- The new lot enters FEFO at the position its expiry deserves — a fresh lot goes to the back even if
  it was entered first.

The delivery link is not a foreign key in any enforced sense: deleting deliveries is not offered, and
a missing delivery row only means the reference is `null`.

---

## 8. Flow B — Issuing stock (FEFO)

Screen: `/issue` → *Issue stock*. Store call: `issueStock` (`mock-store.tsx:670`).

### Steps

1. Validate quantity: integer, greater than zero.
2. Build the plan: if the operator picked a batch, filter `fefoPlan` to it; otherwise use the full plan.
3. Coverage check: if the total `available` across the plan is less than requested, refuse with
   "There is not enough stock ready to issue for this change." Note *ready*: quarantined and expired
   lots are absent from the plan, so they cannot accidentally satisfy an order.
4. Allocate greedily in FEFO order, splitting the request across batches:
   `take = min(plan.available, remaining)`.
5. Write **one `ISSUE` movement per batch slice**, then a single product-level `ISSUE` audit row.

### Worked example (seed data, product HANOI)

| Batch | Expiry | Available |
|---|---|---|
| `HN-2602-B` | +26 days | 124 (150 received − 26 issued) |
| `HN-2601-A` | +95 days | 135 (300 − 120 − 45) |

Issuing **200** produces:

```
movement #18  HN-2602-B  ISSUE  124      (older expiry, fully consumed)
movement #19  HN-2601-A  ISSUE   76      (remainder from the newer lot)
audit         ISSUE      product 1  { quantity: 200 }
```

Two rows, not one, because the ledger's unit is "quantity leaving a specific batch". That is what
makes per-lot traceability possible later: every issued unit can be traced to the lot it came from.

If the operator pins `HN-2601-A` and asks for 200, the filtered plan allows only 135 and the request
is refused — pinning is an override of preference, never of availability.

---

## 9. Flow C — Adjustments, and the movement catalogue

Screen: `/issue` → *Stock changes*. Store call: `adjustStock` (`mock-store.tsx:690`).

One form covers reserve/release/cancel/return/damage/dispose/quarantine-adjustment/adjustment/count
because they are all "one signed movement against one batch" with different validation.

### Validation order

1. Batch must exist.
2. Quantity integer; `COUNT` allows `0` (counting a lot to zero is meaningful), everything else must be `> 0`.
3. `RESERVE` requires the batch to be issuable — you cannot hold stock that is expired or quarantined.
4. `ADJUSTMENT` requires an explicit direction (`INCREASE` / `DECREASE`).
5. Compute the signed quantity (below) and run `balanceError`.

### How the signed quantity is derived

```text
ADJUSTMENT : direction === DECREASE ? -quantity : +quantity
COUNT      : quantity - currentOnHand      // the delta, so +1 effect lands onHand exactly on the count
otherwise  :  quantity
```

The `COUNT` transform is why a physical count does not need a special replay rule: the operator types
what they actually counted, the store records the *difference*, and the ordinary `+1` effect brings
`onHand` to the counted figure. The audit row keeps both numbers (`countedQuantity`, `variance`).

### `balanceError` — the three invariants

Every quantity-changing action is checked before it is written (`mock-store.tsx:360`):

1. resulting `onHand >= 0`
2. resulting `reserved >= 0`
3. resulting `reserved <= onHand`

These are the only stock invariants the app enforces, and they are enforced in one place, so no form
can bypass them.

### Movement catalogue

| Type | On hand | Reserved | Used for | Why it is separate from the others |
|---|---|---|---|---|
| `RECEIPT` | + | | Arrival from a delivery | Only type created by receiving |
| `ISSUE` | − | | Stock leaving for an order | FEFO-allocated; carries SO reference |
| `RESERVE` | — | + | Hold stock for a confirmed order | Reduces `available` without removing it |
| `RELEASE` | — | − | Order fulfilled, hold removed | Pairs with RESERVE |
| `CANCEL` | — | − | Order cancelled | Same arithmetic as RELEASE, different meaning in the trail |
| `RETURN` | + | | Customer returns intact stock | Inbound movement that is not a receipt |
| `DAMAGE` | − | | Breakage, spoilage | Loss that is not a sale |
| `DISPOSE` | − | | Deliberate destruction | Loss with a decision behind it |
| `ADJUSTMENT` | ± | | Corrections found outside a count | Explicit direction forces intent |
| `COUNT` | ± | | Physical inventory result | Quantity is a variance, not an amount |
| `QUARANTINE` | — | — | Status change to held | Availability removed by flag; quantity is historical |
| `UNQUARANTINE` | — | — | Release from hold | Reverses the flag only |

`QUARANTINE`/`UNQUARANTINE` are also produced by dedicated buttons on `/batches`, which additionally
require and clear `quarantineReason`. The same type names can appear from the adjustment form, so the
ledger's vocabulary is stable regardless of which screen wrote the row.

---

## 10. Flow D — Quarantine and release

Store calls: `quarantineLot` (`:643`), `releaseLot` (`:657`).

Quarantine:

1. Reason is mandatory (`fieldErrors.reason`).
2. `batch.status = "QUARANTINE"`, `batch.quarantineReason = reason`.
3. A `QUARANTINE` movement is appended with `quantity = onHand` at that moment.
4. Audit records status `before → after`.

Effect: `isIssuable` becomes false, so `available` becomes `0`, FEFO drops the batch, product
available falls, and a `QUARANTINE` alert appears. `onHand` is untouched.

Release: status back to `ACTIVE`, reason cleared, `UNQUARANTINE` movement, audit row. Because
availability is derived from status, stock becomes issuable again with no compensating quantity —
which is exactly why the movement carries no balance effect.

This separation (status for usability, ledger for quantity) is the cleanest example of the model's
split: **a lot can be full and unusable at the same time**, and the app represents that without
lying about either fact.

---

## 11. Flow E — Reversing a mistake

Store call: `reverseMovement` (`:715`). Available from the stock-changes table.

1. Original must exist.
2. If any movement already has `reversesId === id`, refuse — one reversal per movement.
3. `reversalQuantity = -original.quantity`.
4. If the original touched reservations and the batch is no longer issuable, refuse (releasing a
   reservation is fine; re-creating one on an expired lot is not).
5. `balanceError` is evaluated against the reversal, so an undo that would drive stock negative is
   refused rather than silently corrupting balances.
6. Append a movement with the **same type**, the negative quantity, `reversesId = original.id`, the
   original reference, and a default reason `Reversal of stock change #<id>`.
7. Audit `REVERSE` with the original row as `before`.

Consequences:

- Net effect on `onHand` is zero, but the history shows both the error and the correction. Nothing is
  deleted.
- Reversing a `COUNT` restores the pre-count balance, because the count's stored quantity was the
  variance.
- Reversing a receipt is usually refused: the stock it added has typically already left, so the
  reversal would break `onHand >= 0`. That refusal is the invariant doing its job, not a bug.

---

## 12. Alerts — recomputed exceptions

`openAlerts(state)` (`mock-store.tsx:430`) returns the current problems, derived fresh on every read.
Nothing is stored, so an alert cannot go stale or need dismissing.

| Alert | Rule | Severity | Why it exists |
|---|---|---|---|
| `LOW_STOCK` | product `stockState === "LOW"` | `CRITICAL` | Sellable stock at or below the low-stock level |
| `REORDER` | product `stockState === "REORDER"` | `WARNING` | Above low-stock but at/below the reorder point |
| `EXPIRED` | batch expired **and** `onHand > 0` | `CRITICAL` | Stock that must be written off, not sold |
| `QUARANTINE` | batch status `QUARANTINE` | `WARNING` | Held stock awaiting a decision |
| `NEAR_EXPIRY` | not expired, within the product window, `onHand > 0` | `WARNING` | Time to move stock or discount it |

Two structural details:

- The product checks use `if / else if`, so a product yields at most one stock alert — the more
  severe one wins.
- The batch checks use `EXPIRED → QUARANTINE → NEAR_EXPIRY` in an `else if` chain, so a quarantined
  lot reports "quarantined" rather than also "near expiry". One row per problem keeps the dashboard
  readable.

Each alert carries `entityType`/`entityId`, mirroring the stored notification shape, so a dashboard
row can link to the exact record it names (`lib/notification-links.ts`).

---

## 13. Notifications — a demo inbox, deliberately separate

Bell (`app/(app)/notifications/bell.tsx`), inbox (`.../page.tsx`), state hooks (`.../store.tsx`).

- Unread count is computed from `readAt === null`; the badge caps the display at `99+`.
- `markNotificationRead(id)` sets `readAt` once; `markAllNotificationsRead()` fills every null.
  Neither writes an audit row — reading your inbox is not a stock event.
- `pushNotification(...)` exists on the store and prepends a new item, but **no screen calls it**.

That last point is worth being explicit about, because it is the one place the app's behaviour does
not match an intuitive reading of the screens:

1. The three seeded notifications are fixtures, so the inbox demonstrates the UI without generating
   messages.
2. They are *not* derived from `openAlerts`, so they can disagree with current stock. For example,
   seeded notification #102 warns that `PB-SGN-250` is below its low-stock level, while the derived
   state after the seed movements (36 + 156 on hand, 162 available against a low-stock level of 30)
   classifies it as `OK`.
3. Live exception reporting therefore lives on the dashboard (derived alerts), not in the inbox.

This is a demonstration-data shortcut, not a design recommendation: wiring `pushNotification` into
the mutation paths, or rendering `openAlerts` in the inbox, is the obvious next step if the demo ever
needs a self-consistent inbox.

---

## 14. Reports

Reports are projections. Three of the four tabs are read-only views; the fourth builds periods.

### 14.1 Hub — `/reports` (`reports/page.tsx`)

Five panels plus the export. Four are built by helpers in `lib/inventory/reports.ts`; the batch panel
renders `buildBatchViews` directly, which is why its figures match `/batches` exactly:

| Panel | Builder | Question it answers |
|---|---|---|
| Stock by product | `stockByProductRows` | How much do we hold, and what is it worth? |
| Stock by batch | `buildBatchViews` (store) | Which lots exist, when do they expire, what is sellable? |
| Reorder list | `reorderRows` | What needs buying, and how far below target? |
| Near-expiry and expired lots | `expiryRows` | What must move or be written off? |
| Damaged and disposed stock | `damagedDisposedRows` | What was lost, and why? |
| Physical count variances | `countVarianceRows` | Where did the count disagree with the books? |

`Export CSV` writes the visible table through `downloadCsv`, which quotes every field, doubles
embedded quotes, and joins with CRLF. No server is involved; the file is assembled in memory.

### 14.2 Stock changes — `/reports/movements`

The full ledger, unfiltered by default, with filters (movement type, product, date range, free text)
and CSV export. The header prints `"<filtered> of <total> entries"` so it is always obvious that a
filter is hiding rows — a small detail that prevents the most common misreading of a filtered report.

### 14.3 Activity — `/reports/activity`

The audit trail, newest first, with actor/action/entity columns and before/after detail. This is the
only screen where "who did it" is answerable.

### 14.4 Periodic reports — `/reports/periods`

`lib/inventory/periods.ts` owns the calendar maths:

- `resolvePeriod(granularity, anchor)` → `{ key, label, start, end }` for `week` / `month` / `year`;
  weeks are ISO weeks.
- `shiftPeriod(period, steps)` → previous/next period, used by the `← Previous` / `Next →` controls.
- `buildPeriodReport(state, period)` → receipts, issues, closing balance, and per-product lines.
- `periodCoverage(period)` → the date range caption.
- `switchAnchor(period, now)` → keeps the anchor sensible when the granularity chip changes.

Navigation is URL-driven (`?g=` granularity, `?d=` anchor), so a period view is linkable and
refresh-stable. `Download this period as CSV` names the file `provi-beans-<period key>.csv`.

Period figures come from movement timestamps (`createdAt`), not batch dates — a report answers "what
happened in this window", which is a ledger question.

---

## 15. Catalogue — products, suppliers, deliveries

Screens under `/catalog` (tabs: Products, Suppliers, Deliveries). Writes: `createProduct`,
`setProductActive`, `createSupplier`, `createDelivery`.

### 15.1 Products

Validation: SKU and name required; SKU unique after uppercasing; weight an integer above zero; unit
price finite and `>= 0`. Creation sets `isActive: true`.

Deactivation instead of deletion is a deliberate, documented choice (`mock-store.tsx:744–750`):
batches and movements reference `productId`, so deleting a product would leave the ledger pointing at
nothing and reports printing movements with no SKU. Deactivating keeps history readable and removes
the product from receive/issue pickers.

Note: `createProduct` is the one master-data write that does **not** append an audit row (supplier
and delivery creation do). If you need a complete who-created-what trail, that is a gap to close.

### 15.2 Suppliers

Name required and unique case-insensitively; audit `CREATE supplier` with contact and country.

### 15.3 Deliveries

Supplier must exist; reference optional but unique when provided. Audit `CREATE delivery`.
Deliveries are the anchor that lets a batch say "this came from shipment X"; receiving copies the
delivery reference onto the `RECEIPT` movement so the ledger carries the paper trail.

---

## 16. Accounts

`/accounts` (admins and owners only). Shows the user list with role and status, a create form, and the
backup panel.

`createUser`:

- role must be a known `Role` (guards against a tampered `select`);
- name required; email required, regex-validated, unique after lowercasing;
- password optional: if provided it must be at least 6 characters, otherwise the account falls back to
  `DEMO_PASSWORD`;
- audit `CREATE user` with `{ role }`.

`setUserActive` is the account analogue of product deactivation: `login()` only matches active rows,
so deactivation blocks sign-in and remains reversible. You cannot deactivate the account you are
signed in with — otherwise a single admin could lock themselves out with no server-side recovery.

---

## 17. Audit trail

Written by the store, not by screens, through a single `audit()` helper (`mock-store.tsx:547`) that
stamps `actorName` from the current user (`"Demo user"` when none is resolved), serialises
`before`/`after`, and appends with the next id.

| Action | Entity | Written by |
|---|---|---|
| `SIGN_IN` / `SIGN_OUT` | session | `login`, `logout`, idle expiry |
| `RECEIVE` | batch | `createLot` |
| `QUARANTINE` / `UNQUARANTINE` | batch | `quarantineLot`, `releaseLot` |
| `ISSUE` | product | `issueStock` |
| Movement type name (`DAMAGE`, `COUNT`, …) | batch | `adjustStock` |
| `REVERSE` | movement | `reverseMovement` |
| `CREATE` | supplier / delivery / user | master-data writes |
| `ACTIVATE` / `DEACTIVATE` | product / user | soft retirement |
| `RESTORE` | backup | `restoreBackup` |

Conspicuously absent: reads (no page-view logging), notification read marks, `createProduct` (noted
above), and `reset()` (which reseeds the audit array along with everything else).

The trail is append-only in normal use and rendered newest-first on `/reports/activity`. Because
`actorName` is copied at write time, the history survives renames and deactivations.

---

## 18. Backup, restore, exports, reset

### 18.1 Export

`exportBackup()` writes `provi-beans-backup-YYYY-MM-DD.json` containing
`{ exportedAt, state }`, pretty-printed. It is a full snapshot including users and their plain-text
passwords — stated plainly in `docs/data-protection.md` rather than glossed over.

### 18.2 Restore

`restoreBackup(raw)`:

1. Parse JSON; refuse with "That file is not valid JSON."
2. Unwrap an envelope if `state` is present, so both a raw state and a backup file work.
3. Require arrays for `products`, `users`, `batches`, `movements`, `audit`; otherwise "That file is
   not a Provi Beans backup."
4. Merge over a fresh seed: `{ ...seedState(), ...shaped }`, so missing optional collections fall back
   to seed instead of leaving `undefined` in the store.
5. Preserve the session only when the signed-in user's id still exists in the incoming `users`;
   otherwise sign out and tell the user to sign in again.
6. Append a `RESTORE` audit row.

Restore replaces rather than merges records. That is intentional for a demo — merging two ledgers
with overlapping ids would corrupt the append-only story.

### 18.3 CSV

`downloadCsv(filename, rows)` (`:878`) quotes all fields, escapes `"` as `""`, joins with CRLF, and
revokes the object URL on the next tick — revoking immediately can cancel the download before the
browser has read the blob. That comment in the source is the reason for the `setTimeout(…, 0)`.

### 18.4 Reset

`reset()` redeploys the seed and saves. It is exposed on the store but **no screen calls it in this
build**, so the paths to a clean demo are: clear the site's storage in the browser, or restore an
exported backup taken right after first load. Anything calling `reset()` would discard the whole
ledger and audit trail without a confirmation step of its own, so the omission is defensible — but it
is a gap between the API surface and the UI, not a hidden button.

---

## 19. Numbered walkthroughs

### Trace 1 — receive a new lot

State: signed in as staff. Product HANOI currently has `HN-2602-B` at 124 available.

1. `/batches` → *Receive*: code `HN-2603-C`, product HANOI, quantity `100`, expiry `today + 120`.
2. `createLot` validates; writes batch id 8, `RECEIPT` movement id 18, audit `RECEIVE`.
3. `buildBatchViews` now replays three movements for the new batch → `onHand 100`, `available 100`.
4. Product available becomes 124 + 135 + 100 = 359 → `stockState` `OK`.
5. `fefoPlan(HANOI)` orders `HN-2602-B` (+26) → `HN-2601-A` (+95) → `HN-2603-C` (+120): using a lot
   raises its own priority for the next issue.

### Trace 2 — issue 200 with FEFO

1. `/issue` → *Issue stock*: product HANOI, quantity `200`, reason `Cafe order`, reference `SO-1120`.
2. Plan total 124 + 135 = 259 ≥ 200, so the request is accepted.
3. Movements: 124 from `HN-2602-B`, then 76 from `HN-2601-A`. Both are `ISSUE` rows referencing the
   same `SO-1120`.
4. `HN-2602-B` reaches `onHand 0` and `available 0`; it stays in the batch table as history.
5. One `ISSUE` audit row on the product with `{ quantity: 200 }`.

### Trace 3 — count finds a shortage

`SGN-2602-B` holds 156 on hand, 30 reserved.

1. `/issue` → *Stock changes*: type `COUNT`, batch `SGN-2602-B`, counted quantity `150`.
2. Store computes `150 - 156 = -6` and writes a `COUNT` movement of `-6`.
3. Replay: `onHand` 156 − 6 = 150; `available` 150 − 30 = 120.
4. Audit row carries `{ countedQuantity: 150, variance: -6 }`.
5. The `Physical count variances` report panel lists the −6 with the batch code; the count never
   overwrote the ledger.

### Trace 4 — a reversal, and one that is refused

- Reverse the `ISSUE` of 26 from `HN-2602-B`: reversal quantity `+26`, batch returns to 150 on hand,
  audit `REVERSE` keeps the original row in `before`. Both rows stay visible.
- Reverse the `RECEIPT` of 150 on the same batch: on hand is 124 (or 150 after the first reversal), so
  the reversal would leave `-26`, and the `onHand >= 0` invariant refuses it. To correct a receipt
  without breaking stock you first return or write off the stock that left, or use an adjustment.

---

## 20. File map — what lives where

| Path | Responsibility |
|---|---|
| `lib/mock-store.tsx` | Types, seed, storage, session, every mutation, all derived helpers (`buildBatchViews`, `productSummaries`, `openAlerts`, `fefoPlan`), `downloadCsv` |
| `lib/inventory/reports.ts` | Pure row builders for the five report panels |
| `lib/inventory/periods.ts` | Week/month/year period resolution, shifting, totals, CSV keys |
| `lib/format.ts` | Date/time formatting, relative time, title casing, humanised movement labels |
| `lib/row-focus.ts` | Cross-page "scroll to and highlight this row" hand-off via a requested href |
| `lib/table-labels.tsx` | Render helper keeping `th`/`td` counts in lockstep (layout contract) |
| `lib/product-images.ts` | Maps SKU → bundled artwork and alt text for thumbnails |
| `lib/notification-links.ts` | Resolves a notification/alert to a `/batches` or `/catalog` target |
| `lib/theme.tsx` | `system` / `light` / `dark` preference and the class it applies |
| `app/(app)/layout.tsx` | Auth redirect, skeleton, sidebar, sign out |
| `app/(app)/nav.tsx` | Primary navigation, role filtering, active-state matching |
| `app/(app)/dashboard` | Derived totals, alerts, recent activity |
| `app/(app)/batches` | Batch tables, receive form, quarantine/release |
| `app/(app)/issue` | Issue form, stock-change form, ledger table |
| `app/(app)/catalog` | Products, suppliers, deliveries, master-data gating |
| `app/(app)/reports` | Hub panels, movements, activity, periodic reports |
| `app/(app)/accounts` | User list, create form, activate/deactivate, backup panel |
| `app/(app)/notifications` | Bell, inbox, read marks |
| `scripts/verify-frontend.mjs` | Architecture guard: no DB, no route handlers, no server actions, browser storage present |
| `scripts/verify-layout.mjs` | Real-browser geometry checks across 15 screens × 7 viewports |

---

## 21. Invariants and "looks wrong but is intentional"

| Observation | Explanation |
|---|---|
| No stored stock quantity anywhere | Quantity is replayed from movements; see §2 |
| `available` is `0` for expired/quarantined lots while `onHand` is not | Availability is "sellable"; `onHand` is "physically present" (§5.3) |
| A quarantine movement has a quantity but changes no balance | It is a status record with a historical quantity (§10) |
| Receiving a fresh lot does not make it first in FEFO | FEFO sorts by expiry, not arrival (§5.5) |
| `COUNT` movements store a negative number for a shortage | The stored value is the variance; the `+1` effect applies it (§9) |
| Two movement rows appear for one issue | One row per batch slice, so every unit is traceable to a lot (§8) |
| Dashboard warnings differ from the bell inbox | Alerts are derived; notifications are seeded fixtures (§13) |
| Staff see buttons on catalogue pages but no forms | `canManageMasterData` hides creation forms; viewing is allowed (§6.3) |
| Restore keeps you signed in only sometimes | The signed-in user id must exist in the imported file (§18.2) |
| A receipt reversal is refused | It would break `onHand >= 0`; the invariant is the feature (§19) |

---

## 22. Limits, stated plainly

- Single browser, single device: two people on two machines have two independent datasets. The
  `storage` listener only syncs tabs on the same machine.
- No security boundary: roles are UI checks; `localStorage` is readable and editable by anyone with
  devtools, and passwords are plain text.
- The 30-minute idle sign-out is a convenience lock, not a security control.
- Notifications are demo fixtures rather than generated events (§13).
- `createProduct` is not audited (§15.1).
- `pushNotification` is implemented but unused.
- Balance replay is linear in movement count; fine for a demo, wrong for a warehouse.
- No migration path: `version` mismatch reseeds rather than transforms.

---

## 23. Glossary

| Term | Meaning here |
|---|---|
| **Batch / lot** | One physical receipt of one product, with its own dates and status |
| **Movement** | One ledger row; the only way quantity changes |
| **On hand** | Net quantity physically in the batch, from replay |
| **Reserved** | Quantity promised to a confirmed order, still present |
| **Available** | `onHand − reserved`, and strictly `0` unless the batch is active and unexpired |
| **Issuable** | `status === ACTIVE && !isExpired` |
| **FEFO** | First-expired-first-out; the ordering `fefoPlan` computes |
| **Effective date** | `expiryDate ?? bestBeforeDate ?? receivedAt` — the date expiry is judged by |
| **Near expiry** | Within the product's `nearExpiryDays`, not yet expired |
| **Stock state** | `EXPIRED_HOLD` > `LOW` > `REORDER` > `OK`, one per product |
| **Alert** | A derived exception (`openAlerts`), recomputed every read |
| **Notification** | A stored inbox item; seeded demo data in this build |
| **Audit entry** | Who did what, when, with before/after snapshots |
| **Commit** | The single write path: clone, mutate, publish, persist |
| **Seed** | `seedState()`: 3 users, 3 products, 2 suppliers, 3 deliveries, 7 batches, 17 movements |
