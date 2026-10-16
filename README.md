# Provi Beans

**New here? Read [`USER_GUIDE.md`](USER_GUIDE.md)** for the screen-by-screen guide.
This README covers development, architecture, and verification.

Provi Beans is a frontend-only demonstration of a coffee inventory and stock
monitoring system for administrators, inventory staff, and owners/managers. It
uses bundled mock data and browser-local state. It has no database, backend API,
or external service dependency.

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No environment file or data setup is required.
To exercise a production build:

```bash
npm run build
npm run start
```

## Demo accounts

All three accounts use the password **`ProviBeans2026`**.

| Email | Role | Demo access |
|---|---|---|
| `admin@provibeans.ph` | Administrator | All inventory and reporting screens |
| `staff@provibeans.ph` | Inventory staff | Day-to-day stock operations |
| `owner@provibeans.ph` | Owner / manager | Oversight and reporting |

Authentication is simulated in the browser. These credentials are demo data,
not real accounts, and no credentials are sent to a server.

## Frontend-only data model

The application starts from hardcoded products, suppliers, batches, movements,
requests, alerts, and users. Interactive changes are kept in browser-local
state so the demo can be used without infrastructure. Where persistence is
needed across refreshes, it uses browser storage.

This is intentionally not a production persistence or security model:

- clearing site data resets browser-persisted changes;
- data is local to the current browser and device;
- role checks demonstrate UI behavior and are not a server-side security boundary;
- exports are generated in the browser.

## Architecture

```text
app/                         Next.js routes and UI
  login/                     demo sign-in
  (app)/                     authenticated demonstration screens
lib/                         shared frontend types, mock state, and helpers
scripts/
  verify-frontend.mjs        frontend-only architecture guard
  verify-layout.mjs          browser-based layout geometry checks
docs/ui-layout-alignment.md  layout contract and screenshot evidence
```

The application must remain frontend-only. Do not add database clients,
migrations, route handlers, server actions, or external service integrations.

## Verification

The source and type checks require no running server and no environment
variables:

```bash
npm run typecheck
npm run verify:frontend
npm run verify
```

`verify:frontend` checks that database packages, commands, configuration,
migrations, imports, and connection variables have not returned, and confirms
that browser-local persistence exists.

The layout suite drives an installed Edge or Chrome browser against a running
application:

```bash
npm run dev
# In another terminal:
npm run verify:layout
```

Set `SMOKE_BASE` only when the application is served somewhere other than
`http://localhost:3000`. The suite prints `SKIPPED` and exits successfully when
no supported browser is available.

Run every check with:

```bash
npm run verify:all
```

`verify:all` expects the application to be running because it ends with the
browser layout suite.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run verify:frontend` | Enforce the frontend-only source boundary |
| `npm run verify` | Run type and frontend architecture checks |
| `npm run verify:layout` | Measure layout geometry in a real browser |
| `npm run verify:all` | Run source checks, then layout verification |

## Layout verification

`verify:layout` measures rendered geometry rather than comparing screenshots.
It checks table header alignment, shared cell gutters, row alignment, card
heights, content width, and overflow containment across seven screens and seven
viewport sizes. It signs in through the demo form and does not access or mutate
any external data source.

The suite preserves the layout work documented in
[`docs/ui-layout-alignment.md`](docs/ui-layout-alignment.md). Screenshot evidence
is retained there; the executable suite protects the measurable geometry.

## Known limitations

- Browser-local data is demonstration state, not shared multi-user state.
- Clearing browser storage resets locally persisted changes.
- Demo authentication and role selection do not provide production security.
- Product photography is thumbnail resolution.
- The layout suite requires a locally installed Edge or Chrome browser.
