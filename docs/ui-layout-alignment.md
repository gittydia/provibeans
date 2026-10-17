# UI Layout Alignment — Tables, Grids, Cards, Containers

Scope: structural CSS and layout alignment across the authenticated inventory application.
**Styling-only.** No database, backend, API, authentication, server action or business logic was
touched. No mock data, seed data or query was changed. Typography, colour and palette are untouched
(those were Ticket 2, recorded in `typography-standardization.md`).

The headline finding: the app had **no layout test of any kind**. Seven executable suites existed and
not one of them could tell whether a table header sat over its own column. So the first thing built
was the instrument — `scripts/verify-layout.mjs` — and every claim below is a number it produced, not
an impression. It scored the pre-fix tree at **36/44** and the fixed tree at **45/45**.

> **Update — section sub-navigation.** The four inventory sections were later split into tabbed
> sub-routes: `/batches/receive`, `/batches/quarantine`, `/issue/movements`, `/catalog/suppliers`,
> `/catalog/deliveries`, `/reports/movements`, `/reports/activity` and `/reports/periods`.
> `scripts/verify-layout.mjs` now measures **13 routes × 7 viewports**, with a shared `.section-tabs`
> strip under the page head on each section. The audit below, its measurements and its screenshots
> remain the pre-tab evidence; the layout standards it established are unchanged and still enforced.

---

## 1. Initial Audit

### Styling architecture

**No Tailwind.** No `tailwind.config.*`, no `@tailwind` directive, no Tailwind dependency. Plain CSS
in three hand-written stylesheets. In scope for this ticket: `app/app.css` (the authenticated
application) and the shell it owns. `app/globals.css` is mostly the stylesheet of the **deleted**
public site.

| File | Role in this ticket |
|---|---|
| `app/app.css` | Every layout rule changed here — shell, panels, tables, forms, cards, responsive |
| `app/globals.css` | Read for tokens (`--text-*`, colour, radius). Not modified |
| `app/notifications.css` | Audited. Its own geometry is internally consistent — see §8 |

### Surfaces audited

`/dashboard` · `/batches` · `/issue` · `/catalog` · `/reports` · `/reports/periods` · `/requests` ·
`/login` · the app shell (sidebar, mobile bar, notification bell) — 7 screens × 7 viewports
(320 / 375 / 425 / 768 / 1024 / 1440 / 1920).

### Findings, each classified and each traced to a measurement

| # | Class | Finding | Measured evidence |
|---|---|---|---|
| 1 | **WIDTH CONSTRAINT ISSUE** | The 1500px content limiter that `DESIGN.md` §4 specifies was **never implemented**. `.main` had only `padding`, so content filled the viewport minus the sidebar. | **1616px** of content width on every screen at 1920px |
| 2 | **INCONSISTENT SPACING** | Header cells were padded `9px 12px`, body cells `10px 12px`. Two rhythms stacked. | "header pads 9 but cells pad 10" on **14 of the 15** live tables |
| 3 | **MISALIGNED** | The thumbnail cell was padded `6px 8px` — an 8px gutter where every other column had 12px, so the pack image sat 4px left of the SKU text beside it. | `left=[12,8]` on `/dashboard` and `/catalog` at ≥1024px |
| 4 | **HEIGHT INCONSISTENCY** | Status badges were `vertical-align: top` while the numbers beside them inherited the same top alignment in a row whose height came from a two-line cell. | badge sits **7.5px** off its row's vertical centre, in a 53px row |
| 5 | **DUPLICATED CSS** | `.panel` declared `overflow: hidden` at line 219 and `overflow-x: auto` at line 773. The later rule silently overrode the earlier `overflow-y`, leaving the panel a horizontal-only scroller by accident. | Two conflicting rules 550 lines apart |
| 6 | **DUPLICATED CSS** | The scroll-shadow hint was painted on `.panel table`, but **`background-attachment` tracks the element's own scrollport and the table is not the scroller** — `.panel` is. The hint therefore never moved and never indicated scroll. | `background-attachment` resolved against a non-scrolling element |
| 7 | **MISALIGNED** | **Form controls in one grid row had different heights and different baselines.** `.field` is `display: grid` and a grid item, so it stretches to the tallest field in the row; its own auto rows then absorbed the slack. A field with a hint has 3 rows to share it, a bare one has 2. | In "Receive a batch": controls **38 / 49 / 38 / 49 / 40 / 50px** tall, starting at **219 / 231 / 219 / 230 / 219 / 229** |
| 8 | **OVERFLOW** | A `<select>` in a narrow column ellipsizes its own longest option. Not reported by `scrollWidth`, so invisible to ordinary overflow tooling. | Batch select needs **256–272px**, has **167–212px** |
| 9 | **RESPONSIVE ISSUE** | Severity badges stretch to the full panel width when `.alert-row` collapses to one column below 860px — a badge rendered as a bar. | Confirmed in before/after screenshots at 375px |
| 10 | **WIDTH CONSTRAINT ISSUE** | `.alert-row`'s fixed 96px badge column could not hold the widest severity label, so a long label pushed the message sideways. | 96px vs a 112px requirement |
| 11 | **HEIGHT INCONSISTENCY** | `/requests` stat cards had no `<small>` caption while `/dashboard` cards did, so the same card type had two internal rhythms. | Markup asymmetry |
| 12 | **ACCEPTABLE / NO CHANGE REQUIRED** | `body { overflow-x: clip }` is a global mask, which the ticket warns against. | Kept — see §8 |
| 13 | **ACCEPTABLE / NO CHANGE REQUIRED** | The dashboard's FEFO watchlist (5 columns) and Blocked batches (4 columns) sit side by side and cannot line up column-for-column. | Different schemas. Forcing alignment would mean inventing a column |
| 14 | **ACCEPTABLE / NO CHANGE REQUIRED** | Native control heights differ by 2–3px (`select` 37px, text `input` 38px, date `input` 40px). | Intrinsic metrics; normalising needs a fixed height that breaks at large text sizes |
| 15 | **ACCEPTABLE / NO CHANGE REQUIRED** | Form grids pack to 6 columns at 1920px. | Dense but every control is legible and aligned; capping it is a design decision, not a defect |

**On table counts:** the source contains 16 `<table>` elements. Fifteen are live; the sixteenth belongs to
`/cart`, which is a 404 unless `NEXT_PUBLIC_COMMERCE=1`. Fifteen of those tables showed the header/body
padding mismatch, because `/requests` renders its line table only once a request exists and the seeded data
had none. Counts below refer to the **15 live tables**.

### Answers to the required audit questions

1. **Page containers aligned?** Left/right padding was symmetric, but there was no maximum width, so
   every panel was a different width on every display. Fixed.
2. **Predictable table column widths?** No. The table sized to `max-content`, so one long `notes` or
   `reason` value set its column's width for the whole table. Fixed with `overflow-wrap: anywhere`.
3. **Headers aligned with data cells?** Yes, before and after — this was never broken. Worth stating,
   because it is the check most likely to be assumed wrong.
4. **Row heights and padding consistent?** Padding was not (9 vs 10). Row heights were set by the
   tallest cell, including a 76px thumbnail that was adding 12px of dead padding to every product row.
5. **Cards in a grid aligned?** Yes. `.split` already sets `align-items: start`.
6. **Action buttons aligned in rows?** There are no action buttons inside tables. The request action
   group sits in its own `.request-actions` block, already consistent.
7. **Grid items stretching unexpectedly?** Yes — `.field`, finding 7. The single worst defect found.
8. **Long text causing overflow?** Only inside `<select>` (finding 8); tables and cards were safe.
9. **Conflicting width/min-width constraints?** The `.panel` overflow conflict (finding 5).
10. **Layouts breaking at certain widths?** No breakpoints broke. The defects were continuous, not
    breakpoint-specific — except finding 9, which only appears below 860px.
11. **Dropdowns/modals outside the viewport?** No. `.notif-panel` is `width: min(340px, calc(100vw - 32px))`
    and right-anchored in the mobile bar; the toast stack clamps both edges. No change needed.
12. **Spacing consistent with the design system?** Not for tables. DESIGN.md §4's base unit was honoured;
    its content limiter was not implemented at all.

---

## 2. Root Cause Analysis

Five distinct causes, not twenty symptoms.

**A. A documented token that was never written down in CSS.**
`DESIGN.md` §4 specifies `min(1500px, 100% - clamp(36px, 10vw, 192px))`. No rule in `app/app.css`
implemented it. A design contract that is only prose does not constrain anything, so `.main` grew to
fill whatever it was given. Fixing this is a one-line change *because the spec already existed* — the
audit did not have to invent a width.

**B. Two competing sources of truth for the cell box.**
`th` and `td` each carried their own `padding`, and the thumbnail added a third. Every new column had
to guess which value matched. Nothing tied a header to its body cell, so the two drifted. The cause is
not the 1px difference — it is that there was no single definition for "a cell".

**C. `vertical-align` was applied uniformly, so a row mixed two alignment strategies.**
Every cell was `vertical-align: top`. That is correct for multi-line prose and wrong for a badge or a
figure sitting in a row whose height comes from a two-line cell. There was no rule saying *which* cells
are single-value, so the mismatch looked like noise rather than a missing rule.

**D. Layout depended on an intrinsic side effect of a property set for a different purpose.**
`.field { display: grid }` was chosen to stack label/input/hint. Nobody intended the field to also be a
**grid item** that stretches — but it is one, inside `.form-grid`. `align-content` then defaults to
stretch, so the field handed its leftover height to its own auto rows. The number of rows depends on
whether a hint exists, which is why fields with hints inflated more than fields without. This is the
defect that produced the screenshots: **a 56px date input sitting next to a 38px date input in the same
row**, which reads as "broken" even though every value is correct.

**E. A scroll affordance attached to the wrong element.**
`background-attachment: local` / `scroll` is defined relative to *the element's own* scrollport. The
hint was written on the table; the scroller is the panel. So the shadow was pinned to the table's box
and never tracked the panel's scroll offset — it could not indicate anything. Two rules for
`.panel` (findings 5 and 6) had the same origin: the overflow strategy was retrofitted onto an existing
component instead of being designed into it.

---

## 3. Changes Implemented

### 3.1 Layout tokens (`app/app.css`)

```css
--content-limit: 1500px;   /* DESIGN.md §4, previously unimplemented */
--gutter: clamp(18px, 3vw, 36px);
--gutter-narrow: 14px;
--cell-x: 12px;            /* the one table gutter */
--cell-y: 10px;            /* the one table vertical rhythm */
```

The responsive table paddings are now **derived** from `--cell-x` / `--cell-y`
(`calc(var(--cell-y) - 1px)` at ≤860px, `calc(var(--cell-y) - 2px) calc(var(--cell-x) - 4px)` at
≤620px) instead of restating literals, so the narrow-screen rhythm cannot drift away from the wide one.

### 3.2 Container

`.main` gains `width: 100%; max-width: var(--content-limit); margin-inline: auto`. Centred inside its
grid track, so an ultrawide display gets balanced gutters instead of 1848px-wide panels.

### 3.3 Tables — one cell box, declared alignment, bounded widths

- `th, td` share `padding: var(--cell-y) var(--cell-x)` and one `border-bottom`.
- `td { overflow-wrap: anywhere }` — `anywhere`, not `break-word`, because only `anywhere` lowers a
  cell's **intrinsic minimum width**. With `break-word` a single long note still sets its column's
  width and shoves the table sideways; `anywhere` is the whole fix.
- `td { vertical-align: top }` as the base (multi-line prose: a sku over its product name, a wrapped
  reason), with single-value cells centred:
  `td.num, td.code, td.thumb, td:has(> .badge), td:has(.btn) { vertical-align: middle }`.
  This is the rule the audit could not previously state.
- `.thumb` / `.thumb-col` widened 56px → 64px so the image keeps the **same 12px gutter** as every
  other column, and the cell's vertical padding dropped to 0 — the image centres itself with
  `vertical-align: middle` instead, which removed 12px of dead height from every product row.
- Empty states with the correct `colSpan` added to the five tables that had none: `/dashboard`
  Stock by product (7), `/batches` All batches (8), `/catalog` Products (9) / Suppliers (5) / Supplier
  deliveries (4), `/requests` lines (6).

### 3.4 Panels — one overflow strategy

The two conflicting `.panel` rules collapse into one, and the scroll hint moves from the table to the
element that actually scrolls:

```css
.panel { overflow-x: auto; }

/* hint on .panel, not .panel table: background-attachment tracks the element's
   own scrollport, and the table is not the scroller */
background-attachment: local, local, scroll, scroll, scroll;
```

The two inner layers are the panel's own surface colour with `local` attachment, which is what hides
the shadow once you reach either end.

### 3.5 Forms — the alignment fix

```css
.field { align-content: start; }
```

One declaration. A field still stretches to its row so the row is uniform, but its label, control and
hint keep their natural size and top edge. Measured effect on "Receive a batch" at 1920px:

| | before | after |
|---|---|---|
| Row 1 control heights | 38 / 49 / 38 / 49 / 40 / 50px | 38 / 37 / 37 / 38 / 40 / 40px |
| Row 1 control tops | 219 / 231 / 219 / 230 / 219 / 229 | **219 for all six** |
| Row 2 date inputs | **56px** (inflated by the textarea) | **40px** |
| Row 2 control tops | 329 / 329 / 329 / 313 | **313 for all four** |

The residual 37/38/40 spread is intrinsic native control metrics, not stretch.

### 3.6 Cards, alerts, sidebar, sign-in

- `.page-head` aligns to `end` instead of `baseline`, so the pill button on `/reports` sits level with
  the words instead of floating on the heading's baseline.
- `.alert-row` badge column 96px → **112px** (the widest severity label), and
  `.alert-row .badge` gets `justify-self: start` so it keeps its intrinsic width when the row stacks
  below 860px.
- `.side` gains `overflow-y: auto` — a short window previously clipped the sign-out control, because
  the sidebar stretches to the grid row and had nothing to scroll inside.
- `.split` inside `.panel-body` uses 16px rather than 22px: panel-to-panel rhythm is 22px, but inside a
  panel the rhythm is the padding, and a 22px gap was wider than the box it sat in.
- `.signin-card > .eyebrow` restored to 24px — `.signin-card > p` (specificity 0,1,1) was flattening
  the eyebrow to the same 20px as the body copy it introduces.
- `/requests` stat cards gained `<small>` captions so both screens' cards share one internal rhythm.

### 3.7 Inline layout styles → named classes

Six inline `style={{...}}` objects in the live screens became shared classes, so the spacing is
checkable in one file instead of five:

| Class | Replaces | Used by |
|---|---|---|
| `.row-note` | `marginTop: 6` | `/issue`, `/batches` |
| `.row-form` | `marginTop: 10` | `/issue`, `/batches` |
| `.row-label` | `marginBottom: 8` | `/batches` |
| `.request-note` | `padding: 12px 16px; margin: 0` | `/requests` |

**Left alone deliberately:** the three `style={{ color: "var(--app-crit)" }}` in `requests/row.tsx` and
the five in `app/cart/`. Colour is not layout, and the cart is a 404 by default — out of scope.

---

## 4. Shared Layout Standards

| Concern | Rule |
|---|---|
| Content width | `max-width: var(--content-limit)` (1500px), centred, full width below it |
| Gutters | `--gutter` `clamp(18px, 3vw, 36px)`; `--gutter-narrow` 14px ≤860px |
| Table cell box | `--cell-x` 12px × `--cell-y` 10px, shared by `th` and `td`; responsive steps derived by `calc()` |
| Table vertical alignment | `top` for multi-line prose, `middle` for figures, codes, badges, buttons, thumbnails |
| Table width | `max-content` + `min-width: 100%`, bounded by `overflow-wrap: anywhere` on cells |
| Horizontal overflow | Scoped to `.panel` only. Never global |
| Vertical alignment in flex rows | `align-items: end` for headers with actions |
| Form fields | `align-content: start`; the grid item stretches, its contents do not |
| Panel rhythm | 22px between panels; 16px inside a panel body |
| Section tabs | `.section-tabs` segment strip directly under the page head, 22px clearance; active tab carries `aria-current="page"` |
| Stat cards | label → figure → caption, all three present |

---

## 5. Responsive Improvements

| Viewport | Change |
|---|---|
| **320** | Single-column cards, tables scroll inside their panel, no page-level sideways scroll |
| **375** | Severity badges keep their intrinsic width instead of becoming full-width bars |
| **425** | Same; stat grid holds two columns |
| **768** | Forms drop to 2–3 columns with aligned controls; tables scroll locally |
| **1024** | Sidebar collapses to the 72px rail; form grids keep every control aligned |
| **1440** | Content fills the measure without stretching |
| **1920** | **Content capped at 1500px** (was 1616px) and centred; form grids at 6 columns, every control aligned |

Page-level horizontal scrolling was already absent at every viewport and still is — the fix was to
repair the *causes* rather than to rely on the global clip.

---

## 6. Files Modified

| File | Change |
|---|---|
| `app/app.css` | +147 / −36. Layout tokens, content limiter, shared cell box, declared vertical alignment, `overflow-wrap`, `.panel` overflow consolidation, scroll-hint relocation, `.field` alignment, `.thumb` gutter, `.alert-row` column, `.side` scroll, `.split`/`.eyebrow` spacing, 4 shared spacing classes |
| `app/(app)/dashboard/page.tsx` | Empty-state row (`colSpan 7`) |
| `app/(app)/batches/page.tsx` | Empty-state row (`colSpan 8`); 3 inline styles → classes |
| `app/(app)/catalog/page.tsx` | Empty-state rows (`colSpan` 9 / 5 / 4) |
| `app/(app)/requests/page.tsx` | Empty-state row (`colSpan 6`); note padding → class; 3 stat captions |
| `app/(app)/issue/page.tsx` | 2 inline styles → classes |
| `scripts/verify-layout.mjs` | **New.** 45 geometry checks across 7 screens × 7 viewports. Signs in through the form; touches no table |
| `package.json` | `verify:layout` and `verify:fast` scripts; layout added to `verify:all`; `playwright-core` pinned as a devDependency |
| `package-lock.json` | `playwright-core@1.64.1` |
| `README.md` | Suites table, commands table and known-limitations updated for the new suite; the stale "no visual regression coverage — Chrome cannot be launched" note replaced |
| `docs/layout/*.png` | 14 before/after screenshots |

**Not modified:** `app/globals.css`, `app/notifications.css`, every file in `lib/`, every schema, every
server action, `lib/db/seed.ts`, and all mock/seed data.

---

## 7. Verification Results

### The new suite

`scripts/verify-layout.mjs` drives a real browser (Playwright over the installed Edge channel), signs
in through the actual sign-in form, and asserts geometry — not pixels — on 7 screens × 7 viewports. It
writes to no table and needs no direct database access. It prints `SKIPPED` and exits 0 when no browser is
available, the same contract `verify:cart` uses.

```
before this ticket   36/44
after this ticket    45/45
```

**The pre-fix score is reproducible.** `git stash push -- app/`, rebuild, restart, re-run → 36/44. The
baseline is a command, not a memory.

Two of the harness's own assertions were wrong and were corrected rather than worked around:

- *A table wider than its panel is not a defect* — a table inside a scroll container is **meant** to be
  wider. The check now asserts the overflow is **contained** (`overflow-x` is auto/scroll/hidden/clip),
  which is the real property.
- *The two side-by-side dashboard tables have 5 and 4 columns*, so they can never match. Asserting
  they match was meaningless. Replaced with the property that actually matters: panels sharing a `.split`
  row must share a top edge (only compared when their vertical ranges genuinely overlap, so a stacked
  single-column layout is not falsely flagged).

Every check was confirmed non-vacuous. The new form-alignment check was proven by deleting
`align-content: start` and re-running:

```
[FAIL] form controls in the same row share a top edge
       /batches@768px "Receive a batch" controls in one row start at 259.83, 259.98, 270.83
```

### Full verification

| Command | Result |
|---|---|
| `npm run build` (includes `tsc`) | ✓ Compiled successfully, no TypeScript errors |
| `npm run verify:rules` | **10/10** rules verified |
| `npm run verify:inventory` | **33/33** checks passed |
| `npm run verify:notifications` | **50/50** checks passed |
| `npm run verify:periods` | **56/56** checks passed |
| `npm run verify:smoke` | **42/42** checks passed |
| `npm run verify:cart` | SKIPPED — commerce disabled, as designed |
| `npm run verify:links` | **25/25** checks passed |
| `npm run verify:layout` | **45/45** checks passed |

`npm run verify:fast` runs the three read-only suites (smoke, links, layout) for a quick inner loop;
`verify:all` runs all seven. There is no `lint`, `typecheck` or `test` script in this repository — `npm run
build` runs TypeScript, which is the type check, and the `verify:*` suites are the tests, as `README.md`
already documents.

Note: `verify:rules`, `verify:inventory`, `verify:periods` and `verify:notifications` all write to the
database (the first two truncate every table on the verify branch). `verify:layout`, `verify:smoke` and
`verify:links` do not write schema or master data. **The work in this ticket changed no data layer at all** —
no schema, no seed, no server action, no query.

### What the verification costs, and why

Every screen is rendered from the app's data store, so a pass over seven screens is real server work.
Measured render cost:

| Screen | Render |
|---|---|
| `/dashboard` | 4.7s |
| `/issue` | **5.4s** |
| `/batches` | 3.9s |
| `/catalog` | 1.3s |
| `/reports` · `/reports/periods` · `/requests` | 0.4–0.7s |

`verify:layout` originally navigated 7 routes × 7 viewports **sequentially** — 49 server renders. Resizing
a viewport re-runs media queries and reflows but does **not** re-request the document, and everything
that changes with width here lives in CSS rather than in markup, so the page is now fetched **once per
route** and measured at all seven widths. Measured geometry is identical: the same 45 checks pass either
way.

```
49 sequential renders + concurrent routes   44.5s
7 renders, resized through the matrix       15.8s
```

**One finding outside this ticket's scope, surfaced because it was measured:** `/issue` is the slowest screen
at 5.4s because it runs an N+1 query loop —

```ts
for (const product of productRows) {
  const plan = await fefoPlan(product.id);   // one round-trip per product, in sequence
```

That is a data-access change, not a layout change, so it was left alone. It is worth its own ticket: a user
opening *Issue & movements* waits five seconds for a form.

### Visual verification

14 screenshots in `docs/layout/` (`before-*` / `after-*` × dashboard 1440, dashboard 375,
catalog 1440, batches 1440, reports 1024, requests 768, receive-batch form, issue-stock form).

**One false alarm, worth recording.** A 2× zoomed screenshot appeared to show vertical seams breaking
the table row separators. A 1:1 native crop showed continuous lines, and geometry confirmed uniform
76.83px row heights with identical borders on every cell: the "seams" were an artefact of the image
being downscaled for viewing, not a defect in the page. Measuring instead of "fixing" it is why nothing
was changed for it.

---

## 8. Remaining Issues

Accepted deliberately, with reasons.

1. **`<select>` options ellipsize in narrow columns.** The Batch select needs 256–272px and has 167–212px.
   A native select always ellipsizes a long option in a narrow box; the full text is visible when the
   dropdown opens. Fixing it would mean either rewriting copy ("FEFO — recommended automatically") or
   making one grid column wider than its neighbours — the second would reintroduce exactly the ragged
   grid this ticket removed.
2. **`body { overflow-x: clip }` kept.** The ticket warns against using it to mask defects. Every
   overflow source found here was fixed at the source, and the clip is `clip`, not `hidden` — it creates
   no scroll container and does not break `position: sticky`. Removing it now would risk exposing
   overflow that only manifests on unmeasured browsers. Worth revisiting alongside any future use of a
   `position: sticky` table header.
3. **Dead CSS in `app/globals.css`.** Roughly 900 of its 1157 lines style the deleted public site
   (`/coffee/*`, `/order`) and the 404-disabled `/cart`. `README.md` confirms those routes are gone.
   Removing it is a separate ticket — it is not layout work, and `verify:cart` still exercises that
   page when commerce is re-enabled.
4. **Form grids reach 6 columns at 1920px.** Dense but legible and fully aligned. Capping the column
   count is a design decision, not a defect, and would need container queries to do correctly (the same
   `.form-grid` appears in a 1396px panel and a 523px one, which media queries cannot distinguish).
5. **Native control heights differ by 2–3px** (`select` 37px, text `input` 38px, date `input` 40px).
   Forcing one height would clip at the larger mobile font size the app deliberately uses.
6. **No visual regression coverage for future tickets** beyond the geometry suite now added. Screenshots
   are committed once, as evidence for this ticket, not as a baseline to diff against.

---

## 9. Final Acceptance Matrix

| Requirement | Before | After | Verification |
|---|---|---|---|
| Table column alignment | Headers over columns — already correct | Unchanged, now asserted | `verify:layout` header↔cell delta ≤1.5px on all 15 live tables × 7 viewports |
| Table row alignment | Badges **7.5px** off row centre; 56px inputs beside 38px in one form row | All single-value cells centred; every form control in a row shares a top edge | badge-drift check; form-top-edge check (proven to fail without the fix) |
| Table cell padding | Headers 9px vs cells 10px; thumbnail 8px gutter | One `--cell-x` / `--cell-y` for `th` and `td`; thumbnail on the same 12px gutter | `verify:layout` gutter + vertical-rhythm checks, 45/45 |
| Card alignment | Stat cards on two screens had different internal rhythms | All stat cards label → figure → caption | `verify:layout` equal-height + even-gap check |
| Grid spacing | 22px gap inside a 16px-padded panel body | 16px inside a panel body, 22px between panels | Code review; `.panel-body .split` rule |
| Container consistency | **1616px** at 1920px, no maximum | **≤1500px**, centred | `verify:layout` content-limiter check (the DESIGN.md §4 contract) |
| Content overflow | Long values could inflate a column; `.panel` had conflicting overflow rules | `overflow-wrap: anywhere`; one overflow strategy; hint on the real scroller | `verify:layout` no-leak + containment checks |
| Mobile responsiveness | Badges became full-width bars below 860px | Badges keep intrinsic width | before/after screenshots at 375px |
| Tablet responsiveness | No breakpoint defect found | No regression | `verify:layout` at 768px and 1024px |
| Desktop responsiveness | Content stretched to 1616px | Capped at 1500px and centred | `verify:layout` at 1440px and 1920px |
| Regression testing | No layout coverage existed | **45 new geometry checks**, wired into `verify:all`; all 8 suites green | `npm run verify:all` |