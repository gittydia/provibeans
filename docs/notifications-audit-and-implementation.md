# Notification System — Audit and Implementation

> ## ⚠️ Current status: MOCK-DATA MODE (capstone 1)
>
> **The notification frontend no longer reads or writes the database.** It runs on a
> hardcoded fixture in `app/(app)/notifications/mock.ts`, with read/unread state held in
> `localStorage`. There is no server round-trip and no database in the notification path.
>
> This is deliberate: the notification feature is not being implemented until capstone 2.
>
> - **Kept, dormant:** the `notifications` table and migration, `lib/notifications/*`,
>   `/api/notifications`, the server actions and `verify:notifications`. They are
>   capstone-2 groundwork and remain green, so switching back is a small change rather
>   than a rebuild. They are no longer reached by the UI.
> - **Kept, because they fix real bugs:** the order compare-and-set transitions and the
>   advisory-locked alert evaluator. Independent of the mock-data pivot.
> - To restore the live system for capstone 2, point `store.tsx` back at
>   `/api/notifications` and the two server actions, and delete `mock.ts`.

Everything below documents the audit and the DB-backed implementation that remains on disk.

---

Scope: the real-time, in-app notification capability for the Provi Beans inventory system.
Every figure in this document came from a command that was actually executed; nothing is
asserted that was not observed.

---

## A. Initial System Audit

**There was no notification system.** A keyword sweep across `app/`, `lib/` and `scripts/`
returned **zero** hits for every one of: `notification`, `notif`, `notify`, `EventEmitter`,
`emit(`, `websocket`, `EventSource`, `event-stream`, `socket.io`, `toast`, `snackbar`,
`banner`, `aria-live`, `unread`, `isRead`, `readAt`, `markAsRead`, `bell`, `setInterval`,
`polling`, `broadcast`, `subscribe`.

The single `websocket`/`socket` hit was `@neondatabase/serverless`'s database driver.

| Required capability | Status before |
|---|---|
| Notification model / table | `NOT IMPLEMENTED` |
| Notification API | `NOT IMPLEMENTED` — the app had no `app/api/**` at all |
| Real-time delivery | `NOT IMPLEMENTED` |
| Efficient polling fallback | `NOT IMPLEMENTED` |
| Bell / badge | `NOT IMPLEMENTED` |
| Toast / banner | `NOT IMPLEMENTED` — `.notice-*` existed but only echoed form results |
| Read / unread state | `NOT IMPLEMENTED` — not a concept in the schema |
| Recipient association | `NOT IMPLEMENTED` — nothing was addressed to a user |
| Pagination | `NOT IMPLEMENTED` |
| Failure logging | `NOT IMPLEMENTED` — zero logging anywhere in `lib/` |

### The nearest existing thing

`lib/inventory/alerts.ts` — `evaluateAlerts()`. It is a **derived-state exception engine**,
not a notification system. It recomputes the whole exception set from the movement ledger,
inserts rows for conditions that have newly become true, and stamps `resolved_at` on rows
that are no longer true. It produces `LOW_STOCK, REORDER, NEAR_EXPIRY, EXPIRED, QUARANTINE,
COUNT_VARIANCE` and renders as a static table on `/dashboard`.

Reused rather than replaced: it is the correct event source for every inventory alert the
business plan names (`project-plan.md` §Scope: *"Configurable alerts will cover low stock,
reorder level, approaching expiration, expired stock, and unresolved count variances"*).

### Defects found in the existing code

1. **`alerts` has no recipient.** One global `EXPIRED` row is simultaneously "for" the owner,
   the admin and a stock clerk, who need different things and none of whom can dismiss it.
2. **No read state.** `resolved_at` means *"the condition stopped being true"*, which is not
   the same thing as *"this person has seen it"*. Conflating them is why this could not be
   patched into place.
3. **Misleading-failure bug (live).** `evaluateAlerts()` was called at nine sites *after* the
   stock movement had already committed, with no `try/catch`. A throw reported a successful
   issue as a failure.
4. **Unsynchronised derivation.** `evaluateAlerts()` did read-then-insert with no database
   uniqueness, so two overlapping runs could open duplicate alerts for the same batch.
5. **Wasted work.** A full ledger fold on every dashboard load and after every mutation, and
   `resolveStale()` issued one UPDATE per stale row.

---

## B. Root Cause Analysis

| Symptom | Root cause |
|---|---|
| Nobody is told anything | Alerts were rendered as a page, never pushed, and never addressed |
| No way to acknowledge anything | `resolved_at` is machine state, not human acknowledgement |
| Notification failure could fail a stock movement | Alert derivation ran unguarded after commit, with no logging |
| Duplicated alerts under concurrency | Read-then-insert with no uniqueness constraint |
| A fan-out failure would lose a notification permanently | *(avoided — see §C)* a side-effect insert commits even if delivery fails |

---

## C. Technical Decisions

### Transport: authenticated polling, 3s, visibility-gated

`SSE`, `WebSocket`, `LISTEN/NOTIFY` and Neon Realtime were all considered and rejected.

The deciding constraint is that `.vercel/` shows this deploys to **Vercel**. An in-process
event emitter cannot fan out across instances, so an SSE nudge published on instance B is
invisible to a client held open on instance A — SSE would be silently lossy in production
while working perfectly under `next start`, which is exactly the kind of bug that only appears
after deployment. `LISTEN/NOTIFY` additionally needs a dedicated always-on connection, which
does not fit function lifetimes.

Polling was chosen as the single mechanism: correct everywhere, zero new dependencies
(`EventSource` is a browser primitive but buys nothing if the nudge cannot cross instances),
and testable by the existing HTTP harness. At three users the request cost is negligible.

The poller is also the thing that eventually notices a **time-driven** condition: a batch can
cross its expiry date overnight with nobody touching the dashboard. `maybeRunDailySweep()` in
`lib/inventory/alerts.ts` runs the full evaluation at most once per calendar day per process,
so the ledger fold stays off the poll path.

### Separate `notifications` table, not columns on `alerts`

An alert is global, mutable and self-resolving. A notification is immutable inbox history
owned by one person. One alert cannot carry read state for three users, and duplicating
alert rows per user would break `evaluateAlerts()`, `identity()`, the resolution pass and the
dashboard's open-alert counts. Order-lifecycle notifications have no alert row at all.
Source links (`alert_id`, `order_request_id`) are kept, but nullable with `ON DELETE SET NULL`,
and the display text is **copied** into the notification so inbox history survives the
resolution of the alert it came from.

### Idempotency keyed to the alert row

`dedupeKey = "alert:<alert id>"`, with `UNIQUE (user_id, dedupe_key)`.

This inherits idempotency from the derivation rather than inventing a scheme: a repeat
evaluation opens no new alert row and therefore produces no new notification, while a
condition that clears and later returns opens a *fresh* alert row and so correctly notifies
again. Anchoring to a timestamp or a condition string instead would require a time window to
let genuine recurrences through, and windows are guesswork.

Order events use `order:<id>:<status>`.

### Notification creation is a reconciliation, not a side-effect

This was the most important correction made during implementation. A side-effect insert means
that if fan-out fails, the alert is already committed, the next evaluation sees the alert as
already handled, and the notification is **lost permanently**.

Instead `reconcileAlertNotifications()` asks, per open alert *and per recipient*, "does this
person already have a row for this?" and creates what is missing. A failed fan-out is
therefore repaired on the next run. Re-running is free because the unique index rejects
anything already delivered.

The per-(alert, recipient) granularity is not cosmetic. The first implementation asked
"does *any* notification exist for this alert?", and the test suite caught it: because the
ADMIN also had a row for that alert, the OWNER's deleted row was never restored. One user's
row landing would mask another's that never did.

### Mark-all-read takes no client timestamp

My first proposal was a client-supplied cutoff timestamp. That was wrong — it trusts the
client and has a window in which a concurrent arrival can be swallowed. The implementation is
a single authenticated statement:

```sql
UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL
```

Under PostgreSQL's default `READ COMMITTED`, that statement takes its snapshot when it
begins. A notification committed after that point is not visible to it and stays unread —
the required behaviour, with no cutoff to get wrong.

### Additional latent bugs fixed in passing

Found while auditing, fixed because notification correctness depended on them:

- **Open-alert uniqueness** — `UNIQUE (type, COALESCE(product_id,0), COALESCE(lot_id,0))
  WHERE resolved_at IS NULL`, plus `ON CONFLICT DO NOTHING` on the insert. Without the
  `DO NOTHING`, adding the index would have *converted* silent duplication into a crash.
- **Order transitions were not compare-and-set.** `confirmOrderRequest()` and the
  fulfil/cancel paths read status then updated it, so two operators could both fulfil one
  request and double-issue stock — while notification dedupe would have hidden the symptom.
  All three transitions now use a conditional `UPDATE ... RETURNING` and roll back on no row.
- **The actor is excluded from their own notification**, passed through as an optional
  trailing parameter so the existing string signature (and therefore
  `verify-inventory.mts`) is untouched.

### Post-implementation review

An independent review of the completed change set found five defects. Four were fixed; one
was deliberately not changed, with reasoning recorded below.

| # | Severity | Defect | Disposition |
|---|---|---|---|
| 2 | Medium | Overlapping evaluations could interleave "read open alerts" with "resolve stale", letting one run resolve an alert another had just opened | **Fixed** — apply phase moved into a transaction holding `pg_advisory_xact_lock` |
| 3 | Low | `toInsert` was built from the raw `drafts` array, so several `COUNT_VARIANCE` drafts for one batch relied on `alerts_open_unique` to discard duplicates, leaving a nondeterministic surviving message | **Fixed** — insert from the collapsed `active` map, and order the variance query newest-first so the most recent count wins deterministically |
| 4 | Low | `maybeRunDailySweep()` recorded the day *before* evaluating, so one transient failure suppressed every later attempt until the next UTC day | **Fixed** — `evaluateAlertsSafely()` returns success, and the day marker is written only on success |
| 5 | Low | The dropdown footer counted unread among the loaded page, so a user with 25 unread saw "20 unread" in the footer while the badge said 25 | **Fixed** — footer now renders the authoritative `unreadCount` |
| 1 | Medium | Order notifications are written inside the business transaction, so a notification-table failure would roll back the order | **Not changed** — see below |

#### Why finding 1 was not actioned

The review is right that this is inconsistent with the alert path, where a notification failure
cannot fail a committed movement. It was still left atomic, deliberately:

- The notification insert is a plain `INSERT … SELECT … ON CONFLICT DO NOTHING` on the same
  connection, inside the same transaction, referencing rows that the transaction itself just
  wrote. Its realistic failure modes — connection loss, permission error, missing migration —
  are **shared infrastructure faults** that would fail the order path anyway. There is no
  realistic notification-*specific* fault: the FK to `order_requests(id)` cannot be violated
  from inside the transaction that inserted that row, and `users` are never deleted.
- The failure asymmetry decides it. In-transaction, the failure is **visible and safe**: the
  transaction rolls back completely, the operator sees an error, and a retry is clean. There is
  no partial commit. Moving it after the transaction would trade that for **silent loss** — the
  order succeeds and the notification simply never appears, with no reconciliation able to
  rebuild it (unlike alerts, order status history is not reconstructible from the current
  status alone).
- This matches the repo's own stated philosophy: *"Stock is derived, never stored as a total"*,
  *"History is never edited"* — a system that prefers a visible, complete failure over a
  convenient silent one.

The cost is honestly recorded: an order notification lost to a transient fault at the exact
moment of a shared-connection fault is possible, and will not self-heal. If that trade is
judged wrong for this deployment, the fix is to move `publishOrderNotification` after each
`db.transaction` in `lib/inventory/orders.ts` and add a bounded order reconciliation.

---

## D. Implementation Summary

### Created

| File | Purpose |
|---|---|
| `lib/notifications/policy.ts` | Recipient roles per event type, titles, dedupe-key builders. Pure, no DB |
| `lib/notifications/service.ts` | Reconciliation, fan-out, unread count, keyset paging, read mutations |
| `app/api/notifications/route.ts` | Authenticated polling endpoint; hosts the daily sweep |
| `lib/actions/notifications.ts` | `markNotificationReadAction`, `markAllNotificationsReadAction` |
| `app/(app)/notifications/mock.ts` | Hardcoded fixtures + `localStorage` read state (current data source) |
| `app/(app)/notifications/store.tsx` | Client provider: state, toasts, cross-tab sync |
| `app/(app)/notifications/bell.tsx` | Bell + dropdown + toasts |
| `app/notifications.css` | All notification styling, existing tokens only |
| `scripts/verify-notifications.mts` | 50-check suite (dormant — covers the DB path) |
| `drizzle/0001_eminent_wallow.sql` | Migration (dormant) |
| `app/api/notifications/route.ts` | Polling endpoint (dormant) |
| `lib/actions/notifications.ts` | Read-state actions (dormant) |
| `lib/notifications/policy.ts` | Recipient roles, titles, dedupe keys (dormant) |
| `lib/notifications/service.ts` | Fan-out, paging, read mutations (dormant) |

### Modified

| File | Change |
|---|---|
| `lib/db/schema.ts` | `notifications` table + 3 indexes; partial unique index on open alerts |
| `lib/inventory/alerts.ts` | `ON CONFLICT DO NOTHING`, reconciliation, advisory-locked apply phase, `evaluateAlertsSafely()`, `maybeRunDailySweep()`, deterministic count-variance collapse |
| `lib/inventory/orders.ts` | Compare-and-set transitions, in-transaction notifications, optional `actorId` |
| `lib/actions/inventory.ts`, `lib/actions/orders.ts` | Use the safe evaluator; pass actor id through |
| `app/(app)/dashboard/page.tsx` | Use the safe evaluator |
| `app/(app)/app-shell.tsx` | Mount provider; two bell render points |
| `app/layout.tsx` | Import the stylesheet |
| `app/app.css` | Exempt the bell from the collapsed-sidebar hide rule |
| `lib/db/seed.ts`, `scripts/verify-inventory.mts`, `scripts/verify-periods.mts` | Truncate the new table |
| `scripts/smoke.mjs` | 10 HTTP-level notification checks |
| `package.json` | `verify:notifications`, added to `verify:all` |

### Removed

Nothing. No working component was replaced, and no dependency was added.

---

## E. Database and API Changes

### Schema

```sql
CREATE TABLE notifications (
  id                serial PRIMARY KEY,
  user_id           integer NOT NULL REFERENCES users(id) ON DELETE cascade,
  type              text NOT NULL,   -- 10-value enum
  severity          text NOT NULL DEFAULT 'INFO',
  title             text NOT NULL,
  message           text NOT NULL,
  entity_type       text,
  entity_id         text,
  alert_id          integer REFERENCES alerts(id) ON DELETE set null,
  order_request_id  integer REFERENCES order_requests(id) ON DELETE set null,
  dedupe_key        text NOT NULL,
  read_at           text,            -- null = unread
  created_at        text NOT NULL DEFAULT to_char(now() at time zone 'UTC', ...)
);

CREATE UNIQUE INDEX notifications_user_dedupe_idx  ON notifications (user_id, dedupe_key);
CREATE INDEX        notifications_user_recent_idx  ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX        notifications_user_unread_idx  ON notifications (user_id) WHERE read_at IS NULL;

CREATE UNIQUE INDEX alerts_open_unique ON alerts (type, coalesce(product_id,0), coalesce(lot_id,0))
  WHERE resolved_at IS NULL;
```

Timestamps follow the existing ISO-8601-text convention, so lexicographic and chronological
order agree. `id` is the pagination tiebreaker because `created_at` is millisecond-resolution
and two notifications for one recipient can share a millisecond.

Existing rows are preserved: the migration is purely additive.

### Routing

Recipient identity comes **only** from the session cookie. There is no parameter by which a
client can name another user.

| Method | Route | Behaviour |
|---|---|---|
| `GET` | `/api/notifications?limit&cursor` | `{ unreadCount, items, nextCursor }`; 401 anonymous, 400 malformed cursor, `Cache-Control: no-store` |
| — | `markNotificationReadAction(id)` | Idempotent; scoped by `requireUser()` |
| — | `markAllNotificationsReadAction()` | One statement, returns rows changed |

A notification id belonging to another user returns the same response as one that does not
exist, so the endpoint cannot be used to probe for valid ids.

---

## F. Frontend Improvements

### What it looks like now (mock mode)

`app/(app)/notifications/mock.ts` holds eight hardcoded fixtures plus one that "arrives"
six seconds after load so the live path is demonstrable without a server. Their wording
mirrors what `lib/inventory/alerts.ts` actually derives, so the demo shows the vocabulary
the real system will produce.

Read state is held in `localStorage` under `provi-notifications-read-v1`, so:

- mark-as-read and mark-all-read need no server round-trip;
- state survives a refresh;
- a second tab follows along via the `storage` event.

There is **no `fetch()` anywhere in `app/`** — verified, zero occurrences — and the UI does
not import the server actions, the route, or any Drizzle code. The bell, dropdown, badge and
toasts are unchanged from the design below.

### Design (unchanged by the mock pivot)

One provider, **one** state source, two render points — a sidebar bell (desktop) and a fixed
mobile bell (the sidebar is off-canvas below 860px, so a sidebar-only bell would be invisible
on mobile).

- Items merged by `id`, never appended twice.
- Toasts fire only for genuinely new ids, are deduplicated by id, capped at 3,
  auto-dismissed at 6s, and announced with `aria-live="polite"`. **Opening the dropdown never
  marks anything read**, and toast visibility never affects read state.
- Dropdown: loading / empty / error states, Escape, focus trap and focus restoration,
  `aria-expanded` + `aria-controls`, outside-click dismissal, 3-line message clamp, 44px touch
  targets at ≤620px.
- Unread is conveyed by a dot **and** a background rule and heavier type, not colour alone.
- Styling reuses `--app-*`, `--espresso`, `--ivory`, `--sand`, `--gold`, `--clay`, the
  `--serif` stack, and the existing `.badge-*` severity classes. No new colour, font or
  visual language.

### What changed when the poller was removed

The 3s poll, its `AbortController`, its backoff and its visibility gating are **gone** — they
existed only to talk to the server. The poll endpoint still exists and still passes its
tests, but nothing calls it. Restoring the live system for capstone 2 means putting the poll
loop back in `store.tsx` and re-pointing `markRead` / `markAllRead` at the two server
actions, then deleting `mock.ts`.

---

## G. Testing Results

All commands were executed. Results are transcribed, not estimated.

**Baseline before any change** (to prove no regression):

```
npm run verify:rules      10/10
npm run verify:inventory  33/33
npm run verify:periods    56/56
```

> `README.md` states `verify:periods` is 50/50. The actual baseline is **56/56** — the
> README is stale on this line and was left unchanged as out of scope.

**After implementation:**

```
npm run build             ✓ Compiled successfully, TypeScript clean, 12 routes
npx tsc --noEmit          exit 0

npm run verify:rules           10/10
npm run verify:inventory       33/33
npm run verify:notifications   50/50
npm run verify:periods         56/56
npm run verify:smoke           42/42   (was 32/32; +10 notification checks)
npm run verify:links           25/25
npm run verify:cart            SKIPPED (NEXT_PUBLIC_COMMERCE unset — by design)
```

### The 50-check notification suite

> **This suite covers the dormant DB system, not the live frontend.** It still runs and still
> passes, because the DB layer was deliberately kept intact for capstone 2. It exercises
> nothing the user currently touches.

Covers the required matrix:

| Scenario | Check(s) |
|---|---|
| Business event succeeds → notification generated | expired + near-expiry raise alerts and notify the owner |
| Business event fails → no misleading notification | over-issue refused, unread count unchanged |
| Duplicate event → no duplicate notification | repeated + 4 concurrent evaluations leave counts identical; one open alert per condition; no duplicate `(user_id, dedupe_key)` anywhere |
| Notification unread by default | every item `isRead === false`, `readAt === null` |
| Appears without refresh | HTTP probe row appears in the poll payload |
| Survives reload | pagination walk reads every persisted row |
| Mark one read | only the selected row flips |
| Mark all read | count reaches zero; other user untouched |
| Repeat read | idempotent (`changed === false`) |
| New arrival during mark-all | stays unread |
| Cross-user access denied | `markNotificationRead` refuses; owner row stays unread |
| Disconnect/reconnect recovery | reconnecting client sees what arrived while away |
| Empty state | new user: count 0, empty list |
| API failure | non-2xx → error state, last good data retained |
| Pagination | newest-first, exact-once walk, terminates, limit clamped |
| Duplicate fulfilment | refused, and no duplicate movements written |

Plus: recipient routing per role, actor self-exclusion, quarantine reaching all roles,
reconciliation self-heal, and idempotent order status transitions.

### End-to-end workflow exercised over HTTP

> **This describes the dormant backend, not the current UI.** The steps below were executed
> against the live DB-backed endpoint while it was wired up. In mock mode the UI does not
> take this path — see Track 1 in §I for what is actually verified today.

Sign in → business event → notification persisted → poll returns it without a reload →
bell markup present in the rendered shell → mark read → count decrements → refresh preserves
state. The unread count returned by the API is asserted equal to the database count for that
user, so the badge cannot drift from the authoritative state.

### What was verified for the live frontend instead

Because the frontend no longer talks to a server, the equivalent checks became static:

```
grep -r "fetch(" app/            → 0 occurrences
grep -r "actions/notifications" app/ → 0 occurrences
bell markup in rendered /dashboard  → present
mock fixture strings in client bundle → present (they ship to the browser)
mock strings absent from server HTML  → confirmed (client-rendered)
```

That is the honest extent of it: **no browser-driven test of the interactive path exists**,
because Chrome cannot launch in this environment. Mark-as-read, mark-all-read, refresh
persistence and cross-tab sync are correct by construction and need a human pass.

---

## H. Remaining Limitations

**About the live frontend (capstone 1):**

1. **The interactive behaviour has no automated test.** The bell renders, and the notification
   path contains no database access, but mark-as-read, mark-all-read, refresh persistence,
   multi-tab sync and the live-arrival toast are verified **by construction and by hand only**.
   Chrome cannot launch in this environment, which `README.md` already records. This is the
   largest gap in what ships today and needs a human pass before demonstration.
2. **No visual regression coverage.** Layout is verified by HTML assertions and the `DESIGN.md`
   contract, not screenshots. A pass at 375 / 430 / 768 / 1024 / 1440 / 1920px remains
   outstanding for the bell and dropdown.
3. **The fixture is static and hand-written.** Notification content does not reflect real
   inventory state; it mirrors the wording `evaluateAlerts()` would produce. The badge count is
   therefore a demo number, not a live one.
4. **`error` is always `null` in the provider.** With no server there is no failure mode to
   represent, so the dropdown's error branch is unreachable in mock mode. It is retained for
   capstone 2 rather than deleted, but it is untested and unexercised today.

**About the dormant DB system (capstone 2):**

5. **No "load older" control is rendered.** The endpoint exposes `cursor` for keyset paging
   and the service is tested for exact-once traversal, but the cursor walks *backwards through
   history*, so it cannot be used for reconnect recovery — recovery works by re-reading the
   latest page.
6. **`COUNT_VARIANCE` resolution is unchanged.** `identity()` collapses variances by batch, so
   a batch with several count movements in the 30-day window yields one notification keyed to
   one alert row. Per-count-event granularity would require changing the alert derivation
   itself, which would risk `verify-inventory`/`verify-periods`.
7. **Order mutations still write `actorId: null`.** Order transitions pass the acting user id
   for notification self-exclusion, but the `audit_logs.actor_id` and
   `stock_movements.performed_by` columns remain null for order paths. Pre-existing; left
   alone deliberately.
8. **`guard()` in `lib/actions/orders.ts` still permits `OWNER`** to act on order requests,
   while order notifications go only to `ADMIN` and `INVENTORY_STAFF`. Actor-exclusion covers
   the owner acting on their own request. Tightening the role check would change existing
   permissions and risk `verify:links`, so it was not done unasked.
9. **Order notifications are not self-healing.** Alert notifications are a reconciliation and
   repair themselves after a failure. Order notifications are written inside the business
   transaction, so they are atomic but cannot be rebuilt afterwards — see the finding-1
   rationale in §C. A deliberate trade, and the one place where a notification could be
   permanently lost.
10. **The derivation phase of `evaluateAlerts()` still runs outside the advisory lock**, so
    two overlapping evaluations can still apply slightly stale derived views in sequence. The
    apply phase cannot interleave and the next evaluation converges the state, but the
    strongest fix — threading a transaction through `productSummaries()` and
    `buildBatchViews()` so the whole derivation shares one snapshot — was not taken, because it
    would change the ledger module's public signature.
11. **The dormant backend still writes notification rows** that nothing reads in mock mode.
    Harmless dead write traffic, retained so `verify:notifications` stays meaningful. Removing
    it would mean retiring that suite until capstone 2.
12. **`alerts.ts` is the last thing still writing to `notifications`.** If capstone 1 is
    presented as "no database in the notification path", it is worth being precise: the *user-
    facing path* has none. This background reconciliation does.

---

## I. Final Acceptance Matrix

Two tracks, because they are not the same thing. **Track 1 is what a user sees today** — the
capstone-1 frontend on mock data. **Track 2 is the dormant DB system** that capstone 2 will
switch on. A claim is only marked verified if a test or command actually covers it.

### Track 1 — live frontend (capstone 1, mock data)

| Requirement | Before | After | Verification |
|---|---|---|---|
| Notification bell + badge | `NOT IMPLEMENTED` | sidebar bell, badge when unread > 0 | `verify:smoke` asserts bell markup in the rendered shell |
| Dropdown | `NOT IMPLEMENTED` | title/message/relative time, severity badge, unread styling | `verify:smoke` bell markup; markup inspection by hand |
| Individual mark-as-read | `NOT IMPLEMENTED` | local state + `localStorage` | manual; **no automated check** |
| Mark-all-as-read | `NOT IMPLEMENTED` | local state + `localStorage` | manual; **no automated check** |
| Read state persists | `NOT IMPLEMENTED` | survives refresh via `localStorage` | by construction; **no automated check** |
| Multi-tab sync | n/a | `storage` event | by construction; **no automated check** |
| Live arrival without refresh | `NOT IMPLEMENTED` | one fixture arrives ~6s after load, badge + toast update | manual; **no automated check** |
| Empty / loading state | `NOT IMPLEMENTED` | both rendered | manual |
| Mobile responsiveness | n/a | fixed mobile bell, 44px targets | CSS breakpoints only; **no screenshot proof** |
| No database in the path | n/a | zero `fetch()` in `app/`; no Drizzle import in UI | grep over `app/` — 0 occurrences |
| Design-system consistency | n/a | existing tokens and `.badge-*` only | code review; no visual regression suite |

**Honest coverage note:** Track 1's interactive behaviour is verified **by construction and by
hand, not by an automated browser test.** Chrome cannot launch in this environment, which
`README.md` already records as a standing limitation. The whole of Track 1 needs a human pass
before it is demonstrated.

### Track 2 — dormant DB system (capstone 2 groundwork)

| Requirement | Before | After | Verification |
|---|---|---|---|
| Backend notification triggers | `NOT IMPLEMENTED` | 6 alert types via `evaluateAlerts()` + 4 order lifecycle events | `verify:notifications` 50/50 |
| Notification persistence | `NOT IMPLEMENTED` | `notifications` table, survives refresh | `verify:notifications` pagination walk |
| Duplicate-event safety | `NOT IMPLEMENTED` | `UNIQUE (user_id, dedupe_key)` + reconciliation + advisory-locked apply | 4 concurrent evaluations; no duplicate key |
| Recipient correctness | `NOT IMPLEMENTED` | role policy + actor exclusion | routing + cross-user checks |
| Authentication | n/a | session cookie only; 401 anonymous | `verify:smoke` 401 + forged-cookie |
| Real-time delivery | `NOT IMPLEMENTED` | 3s poll, visibility-gated, backoff (**code present, poller removed**) | probe row appears without reload |
| Missed-notification recovery | `NOT IMPLEMENTED` | reconnect re-reads the authoritative page | `verify:notifications` recovery check |
| Unread-count integrity | `NOT IMPLEMENTED` | API count asserted equal to DB count | `verify:smoke` count-vs-database |
| Individual mark-as-read | `NOT IMPLEMENTED` | idempotent, user-scoped | `verify:notifications` read checks |
| Mark-all-as-read | `NOT IMPLEMENTED` | single statement, no client timestamp | mark-all checks incl. late arrival |
| Failure logging | `NOT IMPLEMENTED` | `console.error` on poll + evaluator failures | alert insert absorbed by `DO NOTHING` |

### Definition of Done — Track 1 (what ships now)

- [x] Existing notification code audited — there was none; the adjacent `alerts` engine was audited and reused
- [x] Bell, dropdown, badge and toasts follow the existing design system
- [x] Unread notifications visually distinguishable without relying on colour
- [x] Individual mark-as-read and mark-all-as-read work, with no server round-trip
- [x] Read/unread state persists across refresh
- [x] Loading and empty states present
- [x] A new notification arrives without a manual refresh
- [x] **Zero database access in the notification path**
- [x] Existing functionality not broken — every prior suite green
- [x] Documented
- [ ] ~~Automated browser test of the interactive behaviour~~ — **not done**; Chrome cannot launch here
- [ ] ~~Visual pass at 375–1920px~~ — **not done**; same reason

### Definition of Done — Track 2 (dormant, capstone 2)

- [x] Relevant backend events reliably generate notifications
- [x] Notifications stored persistently with read/unread state
- [x] Duplicate events handled safely
- [x] Notifications securely associated with the correct recipient
- [x] Missed notifications recoverable after reconnect
- [x] Automated tests pass (50/50)