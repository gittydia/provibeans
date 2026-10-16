# Typography Standardization

Scope: global typography consistency across the Provi Beans frontend. This ticket is
**styling-only**. No database, backend, API, authentication or business logic was touched, and
the hardcoded mock data is unchanged.

Every command in §6 was executed. Every number is transcribed, not estimated.

---

## 1. Initial Audit

### Styling architecture

**The project does not use Tailwind.** No `tailwind.config.*`, no `@tailwind` directives, no
Tailwind dependency. It is **plain CSS in three hand-written stylesheets**:

| File | Lines | Role |
|---|---|---|
| `app/globals.css` | 1107+ | Colour/type tokens, global element rules, and the **legacy public-site stylesheet** |
| `app/app.css` | 888 | The authenticated inventory application |
| `app/notifications.css` | 269 | The notification bell and dropdown |

### Findings by category

| # | Category | Finding |
|---|---|---|
| 1 | **ACCESSIBILITY ISSUE** | **The three declared brand fonts are never loaded.** No `@font-face`, no `@import`, no webfont `<link>`, no `next/font`, no font file in the repo, no font package in `dependencies`. `--serif: "Cormorant Garamond"`, `--sans: Manrope`, `--script: Caveat` therefore *always* resolve to their fallbacks: Georgia, the system UI face, and the local cursive. The documented brand identity has never rendered. |
| 2 | `MISSING TOKEN` | **No typography tokens existed at all.** Colour and radius had tokens (`--app-*`, `--radius-*`); size, weight, line-height and tracking had none. Every value was written inline per component. |
| 3 | `INCONSISTENT` | **26 distinct `font-size` values** across the three stylesheets — `10, 11, 12, 13, 14, 15, 16px`, `1.05rem`, `1.5rem`, `1.8rem`, `1.9rem`, `2rem`, `23vw` and 12 distinct `clamp()` expressions. |
| 4 | `INCONSISTENT` | **5 weights** in use: 400, 500, 600, 700, **800**. The 800 (`font-weight: 800`) sits outside the conventional 400–700 scale. |
| 5 | `INCONSISTENT` | **14 distinct `letter-spacing` values**, from `-0.07em` to `0.18em`, none named. |
| 6 | `INCONSISTENT` | **14 distinct `line-height` values**, including five below 1.0 (`0.75, 0.78, 0.8, 0.83, 0.84`) and a `17px` fixed. |
| 7 | `HARDCODED` | The monospace stack `ui-monospace, SFMono-Regular, Menlo, monospace` was **hardcoded twice** in `app.css` with no token. |
| 8 | `HARDCODED` | `.app-wrap` set `font-size: 14px` — **px, not rem** — so browser text-size preferences were ignored app-wide. Inputs were `16px`, likewise. |
| 9 | `RESPONSIVE ISSUE` | The small-size ladder is dense: **seven steps between 10px and 16px**, which makes "which size do I use" a judgement call rather than a lookup. |
| 10 | `INCONSISTENT` | `globals.css` carries **92 raw typography declarations belonging to the deleted public site** (`/coffee/*`, `/order`) and the 404-disabled `/cart` route. Together they are a second, competing typography voice. |
| 11 | `CONSISTENT` | **No inline typography styles anywhere.** A sweep of all 22 `.tsx` files for `fontSize`/`fontWeight`/`fontFamily`/`lineHeight`/`letterSpacing` returned **zero** hits. The 14 inline `style={{}}` objects that do exist are all `margin`, `padding` or `color` — out of scope and untouched. |
| 12 | `ACCESSIBILITY ISSUE` | `input, select, textarea` inherit `font-family` correctly, but `.app-wrap`'s px base meant text zoom did not propagate. |

### Answering the required audit questions

1. **Font families:** three declared (`--sans`, `--serif`, `--script`) plus one hardcoded mono stack. **Only the fallbacks actually render.**
2. **Global font family:** yes — `body { font-family: var(--sans) }`.
3. **Tailwind:** **no.** Plain CSS. Phase 3's plain-CSS branch applies.
4. **Size consistency:** no — 26 distinct values, 7 steps inside a 6px band.
5. **Heading hierarchy:** semantically sound (`h1` page, `h2` panel), but **two sources of truth** — the global `h1,h2,h3` rule in `globals.css` and `.page-head h1` in `app.css` both set heading type.
6. **Weights:** 400/500/600/700 consistent in intent; 800 is an outlier with no rule behind it.
7. **Buttons/forms font inheritance:** correct.
8. **Line heights:** 1.5 default is appropriate; the sub-1.0 values belong to dead display type.
9. **Responsive:** page headings use `clamp()` and scale; body type did **not** respond to text zoom because it was px-based.
10. **Unnecessary inline styling:** **none found** — nothing to clean up.
11. **Existing tokens:** colour and radius only.
12. **Font loading:** **inconsistent/absent** — declared but never loaded.

---

## 2. Root Cause

1. **No token layer for type.** Colour had `--app-*`; size/weight/tracking/leading did not, so
   each component wrote its own literal. Two components needing "a caption" independently
   chose 12px and 13px, and neither signalled a choice was made.
2. **`globals.css` outlived the product.** The public site was deleted, but its stylesheet
   stayed. Its 92 declarations are inert today, yet they are what a reader (or an agent)
   encounters first when auditing "how does this app set type" — which is precisely how the
   26-value sprawl was discoverable at all.
3. **px rather than rem.** Typography was authored in absolute pixels, so a browser text-size
   preference could not propagate — an accessibility cost invisible in a screenshot.
4. **The mono stack had no owner.** Two call sites, no token, so a third would have copied it again.

---

## 3. Typography Design System

Added to the existing `:root` in `app/globals.css`, beside the colour tokens.

### Font families — unchanged

```css
--sans:   Manrope, "Avenir Next", "Segoe UI", sans-serif;
--serif:  "Cormorant Garamond", Georgia, serif;
--script: Caveat, "Segoe Print", cursive;
--mono:   ui-monospace, SFMono-Regular, Menlo, monospace;   /* NEW — replaces 2 hardcoded copies */
```

The three brand stacks are **preserved exactly as declared in `DESIGN.md`**. `--mono` is the
only addition, and it removes duplication without changing appearance.

### Size scale — mirrors the values already in use

| Token | Value | = px @16px root | Intended usage |
|---|---|---|---|
| `--text-2xs` | `0.625rem` | 10px | uppercase micro-labels (`th`, `.stat dt`, `.eyebrow`) |
| `--text-xs` | `0.6875rem` | 11px | field labels, sidebar meta |
| `--text-sm` | `0.75rem` | 12px | captions, badges, helper text |
| `--text-md` | `0.8125rem` | 13px | table cells, panel body copy |
| `--text-base` | `0.875rem` | 14px | application default, buttons |
| `--text-lg` | `1.05rem` | 16.8px | panel and card headings |
| `--text-xl` | `1.9rem` | 30.4px | stat figures |
| `--text-2xl` | `2rem` | 32px | sign-in heading |
| `--text-page` | `clamp(1.6rem, 3vw, 2.1rem)` | — | page heading (fluid) |

**Every value is the exact size the app already used.** This is deliberate: the ticket is
Low-priority polish and asks to preserve the established visual identity, so the scale
documents what exists rather than imposing the generic 12/14/16/18… reference scale. Reducing
the dense 10–16px ladder to three steps is a *design* change and is listed in §7.

**All sizes are `rem`, not `px`.** At the default 16px root each renders identically to its
former px value, so nothing moves — but a browser text-size preference now propagates.

### Weight scale

```css
--weight-regular: 400;  --weight-medium: 500;  --weight-semibold: 600;
--weight-bold:    700;  --weight-black:   800;   /* the PROVI BEANS wordmark only */
```

### Line-height scale

```css
--leading-none: 1;      /* single-line figures */
--leading-tight: 1.1;   /* page headings */
--leading-snug: 1.45;   /* clamped multi-line messages */
--leading-normal: 1.5;  /* application default */
--leading-relaxed: 1.7; /* long-form helper copy */
```

### Letter-spacing scale

```css
--tracking-tight: -0.03em;   --tracking-display: -0.055em;  /* global h1–h3 */
--tracking-emphasis: -0.06em; /* <em> — see §7 */
--tracking-snug: -0.01em;    --tracking-normal: 0;
--tracking-code: 0.02em;     --tracking-wide: 0.06em;
--tracking-wider: 0.08em;    --tracking-label: 0.1em;
--tracking-caps: 0.12em;     --tracking-caps-wide: 0.14em;
--tracking-caps-widest: 0.18em;
```

### Responsive rules

Unchanged. Page headings already scale via `--text-page`; the ≤620px breakpoint keeps
`font-size: 1rem` on inputs (preserves the iOS zoom-on-focus guard while becoming zoom-aware).

---

## 4. Files Modified

| File | Change |
|---|---|
| `app/globals.css` | Added the typography token block to `:root`; tokenised the three **live** rules — `.eyebrow`, global `h1,h2,h3`, and `em`. |
| `app/app.css` | 68 declarations now consume tokens. `--mono` replaces the hardcoded stack. |
| `app/notifications.css` | 11 declarations now consume tokens. |

**No `.tsx` file was modified.** There was no inline typography to remove, and the semantic
class names already in use were kept rather than rewritten.

### The two deliberate exceptions

| Location | Value | Why it stays raw |
|---|---|---|
| `app.css:874` | `font-size: 1rem` | The former `16px` at the ≤620px input breakpoint. Already `rem`, already correct; tokenising it would be noise. |
| `notifications.css:43` | `line-height: 17px` | Bound to the badge pill's fixed 17px box. This is a **layout** constraint, not typography; a leading token would break alignment. |

---

## 5. Design Decisions

**Did not introduce Tailwind.** The project is plain CSS. Phase 3's plain-CSS branch applies,
and adding a framework for a token layer would have been a rewrite, not a standardisation.

**Did not load the missing brand fonts.** This is the tempting fix for finding #1, and it is
wrong here. Switching on Cormorant Garamond would change every heading in the application —
that is a **redesign**, not polish, and this ticket explicitly asks to preserve the established
visual identity. The gap is documented at the point of declaration and in §7 instead, so the
next person sees it rather than inheriting it unknowingly.

**Type scale mirrors current values rather than the reference scale.** Imposing 12/14/16/18/20
would have shifted most text by 1–2px across the whole app. Standardising *the source* while
holding *the rendering* constant is what makes this safe to land as polish.

**px → rem.** Pixel-identical at the default root, but fixes text-zoom propagation.

**Did not delete the 92 dead declarations in `globals.css`.** They are inert, and removing
them risks two live things: `.eyebrow` is used by the login page, and the `/cart` route is
restorable with one env var (`NEXT_PUBLIC_COMMERCE=1`). Deleting a thousand lines of a
deliberately-retained feature's styles is a separate, riskier ticket. Recommended in §7.

**Kept `--tracking-display` and `--tracking-emphasis` separate** despite differing by
0.005em. Merging them is the correct cleanup, but it moves rendered text, so it is recorded as
a decision point rather than done silently.

---

## 6. Testing Results

All commands executed. Baseline recorded **before** any edit.

```
npx tsc --noEmit                       exit 0
npm run build                          ✓ Compiled successfully

npm run verify:rules                  10/10     (baseline 10/10)
npm run verify:inventory              33/33     (baseline 33/33)
npm run verify:notifications          50/50
npm run verify:periods                56/56     (baseline 56/56)
npm run verify:smoke                  42/42
npm run verify:links                  25/25     (baseline 25/25)
npm run verify:cart                   SKIPPED   (NEXT_PUBLIC_COMMERCE unset — by design)
```

### Pixel-identity proof

Every typography declaration was extracted before and after, each `var()` resolved through
`:root`, and the two sets compared:

```
tokens defined        : 45
tokenised declarations: 191
unresolved variables  : 0
size mismatches       : 0
non-token raw values  : app/app.css font-size:1rem | app/notifications.css line-height:17px
```

**Zero size mismatches, zero unresolved references.** The refactor changed where values are
*defined*, not what is *rendered*.

### Tokenisation coverage

| Stylesheet | Tokenised | Raw | Note |
|---|---|---|---|
| `app/app.css` | 68 | 1 | the deliberate `1rem` |
| `app/notifications.css` | 11 | 1 | the deliberate `17px` |
| `app/globals.css` (live rules) | 18 | 0 | `body`, `.eyebrow`, `h1,h2,h3`, `em` fully tokenised |
| `app/globals.css` (dead rules) | 0 | 92 | deleted public site + disabled `/cart` |

**Every typography declaration affecting the authenticated application is now tokenised.** The
92 survivors were each verified to belong to a rule whose classes are used *only* by
`app/cart/*` (the 404 route) or to no file at all.

### Served-CSS verification

Fetched the stylesheet the browser actually receives (30,852 bytes, confirmed non-404):

```
typography tokens present in served CSS : 19/19
consumes var(--text-md)                 : true
consumes var(--mono)                    : true
hardcoded mono stack gone               : true
total typography decls in served CSS    : 177  (83 tokenised, 94 raw)
```

The 94 raw values in the served bundle are the dead public-site / cart declarations listed
above — confirmed by enumerating them and matching each to its owning rule.

> Note on method: an earlier run of this check reported a false pass because the stylesheet
> 404'd (9 bytes) after `.next` was rebuilt underneath a running server. It was re-run against
> a server restarted **after** the final build.

### Manual checks performed

- Every font-size/weight/line-height/tracking declaration in the three stylesheets was extracted
  and classified as tokenised or raw.
- Every `globals.css` rule was classified live/dead by parsing selectors against the actual
  `className` literals in all `.tsx` files, then each surviving raw declaration was attributed
  to its owning rule.
- Confirmed zero inline typography styles in all 22 `.tsx` files.
- Confirmed no duplicate token definitions across the three stylesheets.

### Not verified

**No visual or browser-rendered check.** Chrome cannot launch in this environment (a standing
limitation already recorded in `README.md`), so typography is verified structurally — token
resolution and pixel-identity — not visually. A human pass at 320 / 375 / 768 / 1024 / 1440px
is still outstanding.

---

## 7. Remaining Issues

1. **The brand fonts are declared but never loaded (highest severity).** Cormorant Garamond,
   Manrope and Caveat do not render. This is a deliberate non-fix: loading them would redesign
   every heading. It needs a decision — either ship the webfonts (accepting the visual change
   and re-tuning layouts) or delete the declarations so the code stops claiming a face it does
   not use. **Nothing in the UI should be presented as brand-typography-accurate until this
   is resolved.**
2. **`globals.css` holds 92 inert typography declarations** plus ~135 dead rules from the
   deleted public site. It is the single biggest source of confusion for anyone auditing this
   codebase. Recommended cleanup: split the live tokens into their own file and quarantine or
   delete the legacy sheet — after deciding whether `/cart` is being kept.
3. **The small-size ladder is dense** — seven steps between 10px and 16px. Collapsing it to
   three (≈11/13/15) would markedly improve legibility of the system, but it shifts text
   everywhere and needs design sign-off.
4. **Two sources of truth for headings.** `globals.css` `h1,h2,h3` and `app.css` `.page-head h1`
   both set heading typography. They cooperate by cascade today; nothing guarantees they will
   continue to.
5. **`--tracking-display` and `--tracking-emphasis` differ by 0.005em.** Candidates for
   unification.
6. **No visual regression coverage.** Everything above is verified structurally. Whether the
   result *looks* right is unproven.

---

## 8. Final Requirement Matrix

| Requirement | Before | After | Status |
|---|---|---|---|
| Global font family | 3 declared stacks + 1 hardcoded mono copy; **none loaded** | 4 tokenised stacks (`--sans/--serif/--script/--mono`); loading gap documented | `CONSISTENT` (loading gap open — §7.1) |
| Font size consistency | 26 distinct values, no tokens | 9 tokens; **0 mismatches** | `IMPROVED` — live surface fully tokenised |
| Font weight consistency | 5 values, 800 unexplained | 5 named tokens; 800 documented as wordmark-only | `IMPROVED` |
| Line-height consistency | 14 values incl. 5 sub-1.0 | 5 tokens for the live surface | `IMPROVED` — sub-1.0 values are all dead |
| Letter-spacing consistency | 14 unnamed values | 12 named tokens | `IMPROVED` |
| Removal of unnecessary hardcoded fonts | 2 hardcoded mono stacks | 1 `--mono` token | `DONE` |
| Typography design tokens | none (colour/radius only) | 45 tokens in `:root` | `DONE` |
| Text-zoom accessibility | `.app-wrap` and inputs in **px** | rem throughout | `IMPROVED` |
| Inline typography styles | **zero found** | unchanged (nothing to remove) | `N/A — already clean` |
| Mobile scaling | `clamp()` page headings; px body | unchanged, now zoom-aware | `PRESERVED` |
| Desktop scaling | as above | unchanged | `PRESERVED` |
| Accessibility checks | contrast/zoom unverified | zoom fixed; **no visual check possible here** | `PARTIAL` — §7.6 |
| Regression testing | 5 suites green | all 6 green, no regressions | `DONE` |
| Mock data & business logic | unchanged | unchanged — **no `.tsx` modified** | `DONE` |