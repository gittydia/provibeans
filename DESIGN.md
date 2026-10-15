# Provibeans Design System

## 0. Research Log
- Product imagery: supplied pack shots at `public/images/{hanoi,hue,saigon}.png`. Cut-outs on transparency with clean edges, used directly as product photography.
- Imagery constraint: sources are 156x296, 185x296 and 180x299 px. Display is capped near native size (hero pouches 128-200px wide, card art 290-330px tall) so no asset is upscaled beyond ~1.3x.
- Business grounding: `project-plan.md` defines Provi Beans as a Vietnamese-coffee distributor in the Philippines with lot-level traceability, FEFO issuance, expiry/low-stock alerts, quarantine and audit logging. Copy reflects those real capabilities; no invented tasting-note claims beyond blend ratios printed on the packs.
- Reference routing: editorial luxury execution with original typography and paper material; Facebook share link was not publicly fetchable.

## 1. Atmosphere & Identity
Provi Beans feels like a small, exacting roastery printed in ink rather than polished in plastic. Its signature is the meeting of monumental serif type and a tactile, dimensional coffee pouch against espresso paper — paired with the quiet discipline of a business that knows exactly what it holds.

## 2. Color
| Token | Value | Usage |
|---|---|---|
| --espresso | #2C1F1B | dark fields |
| --cacao | #3A2924 | tonal elevation |
| --parchment | #E8DED0 | light fields |
| --ivory | #F5F0E8 | primary dark-field text |
| --sand | #C9BAAA | secondary dark-field text |
| --leaf | #53614A | botanical accent |
| --clay | #A65F43 | sparing warm accent |
| --gold | #C8A56A | sparing highlight |

## 3. Typography
- Display: Cormorant Garamond, Georgia, serif; `clamp(3.5rem, 9vw, 9rem)` for hero.
- Sans: Manrope, Avenir Next, sans-serif; 14-18px body and metadata.
- Accent: Caveat, Segoe Print, cursive; display-only script layer.

## 4. Spacing & Layout
- Base unit: 4px. Tokens: 8, 16, 24, 32, 48, 64, 96, 144, 192px.
- 12-column desktop grid, `min(1500px, 100% - clamp(36px, 10vw, 192px))` content limiter.
- Document owns vertical scrolling. The composition collapses to a single readable column below 760px.

### Product Tokens
| Token | Value | Usage |
|---|---|---|
| --product-hanoi | deep green pouch | Hà Nội, city blend |
| --product-hue | violet/indigo pouch | Huế, 60% Robusta · 40% Arabica |
| --product-saigon | cyan/orange pouch | Saigon, 100% Robusta |

Packs carry printed "DREAM UP BEANS" branding and a lower band. Site typography is never placed over the upper-left logo block or the lower band; overlays use the surrounding field instead.

## 5. Components
### Text Link
- States: default, hover arrow translate, keyboard focus.
- Accessibility: native anchors with visible focus ring.
### Product Vessel
- Structure: `next/image` cut-out pouch, explicit intrinsic width/height, `unoptimized` so the small source PNG is not resampled a second time.
- Variants: hero still-life (three, overlapping and rotated), collection card (centred on a tinted panel).
- Motion: entrance rise only; hover is a 1.04 scale with a -4px lift on cards.
- Accessibility: every pouch carries descriptive alt text naming the city and dominant colour.
### Ledger List
- Structure: `ol` of four capability rows, numbered in the display serif, hairline rules top and bottom.
- States: static by design; carries the inventory capabilities (lot dating, FEFO, alerts, audit) rather than a marketing claim list.
### Editorial Card
- States: default, hover lift and media scale, focus-within.
- Layout: intrinsic grid item, no nested card chrome.

## 6. Motion & Interaction
- Micro: 220ms cubic-bezier(.16,1,.3,1). Entrance: 700ms cubic-bezier(.16,1,.3,1).
- Hero layers enter once with staggered opacity/transform. Hover communicates link or card affordance.
- `prefers-reduced-motion` removes translation, scaling, and delayed entrances.

## 7. Depth & Surface
- Strategy: tonal shift plus a restrained soft shadow on physical pouch objects only.
- Grain is fixed, pointer-inert, procedural SVG noise at 5% opacity.
- Radius: 4px labels, 16px media frames, 28px pouch geometry.

## 8. Accessibility Constraints & Accepted Debt
- WCAG 2.2 AA target; body contrast minimum 4.5:1; 44px mobile interaction targets; semantic landmarks and visible focus required.
- Motion is reduced, not removed: a `--motion` multiplier drives every duration, so `prefers-reduced-motion` collapses entrance and hover motion without `!important` overrides.
- Accepted debt: pack photography is thumbnail-resolution, so all three products are capped near native size and will read soft if scaled up. Accepted for now; exit when the brand supplies print-resolution exports.
- Accepted debt: this surface is the public-facing site. The inventory application described in `project-plan.md` (roles, lots, FEFO issuing, alerts, audit log) is not yet built — see the open scope question.
