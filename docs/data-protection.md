# Data protection

The demo protects its data with five browser-side controls: sign-in, role checks,
input validation, an idle session limit, and a backup/restore path. Every state
change that matters is written to an audit trail that the reporting screens expose.

This document describes what exists and, in the last section, what it does not
protect against. The application is frontend-only by design (see
[`AGENTS.md`](../AGENTS.md)); there is no server to enforce anything.

## Sign-in

All three seeded accounts use `ProviBeans2026`; accounts created from `/accounts` can
set their own password of at least six characters.

| Email | Role |
|---|---|
| `admin@provibeans.ph` | Administrator |
| `staff@provibeans.ph` | Inventory staff |
| `owner@provibeans.ph` | Owner / manager |

`login` trims and lowercases the address, requires both fields, looks up an **active**
account, and compares the password against that account's password when one was set,
otherwise the demo password. Every failure returns one generic message, so the form
does not reveal whether the address exists. Deactivating an account blocks sign-in
immediately while keeping the record for reactivation.

Passwords are stored in plain text inside the browser-local snapshot. They are demo
credentials, and the README says so; do not reuse a real password here.

## Role checks

| Helper | Who passes | Applied in |
|---|---|---|
| `canManageMasterData` | Administrator, Owner | `/catalog`, `/catalog/suppliers`, `/catalog/deliveries`, catalog layout |
| `canViewReports` | Administrator, Owner | `/reports` and every report route, navigation |
| `canManageAccounts` | Administrator, Owner | `/accounts`, navigation |

Each helper is checked twice: the navigation entry is hidden, and the page itself
refuses with a `notice-crit` panel. Reaching the URL directly therefore shows a refusal
rather than data. Inventory staff keep the day-to-day operations — receiving,
quarantining, releasing, issuing, adjusting, reversing, and recording deliveries — so
the demo's receiving workflow still works with the staff account.

These checks shape the interface. They are not a security boundary: the store's
functions can be called from the browser console, and any client-side guard can be
removed by the person running the browser.

## Validation

Every mutation validates before it writes:

- **Receiving** — batch code required and unique case-insensitively, product must
  exist, quantity a whole number above zero, expiry the latest of the four dates.
- **Quarantine** — a reason is required and is stored with the batch.
- **Issuing** — whole quantity above zero, and the requested amount must be covered by
  issuable (active, unexpired, unquarantined) stock using the FEFO plan.
- **Adjusting** — batch must exist; counts accept zero or more, other types require
  above zero; reserving is limited to issuable batches; an adjustment must state
  increase or decrease.
- **Suppliers** — name required and unique case-insensitively.
- **Deliveries** — the supplier must exist and the reference must be unique when given.
- **Accounts** — role must be valid, name required, email format-checked and unique,
  and a supplied password must be at least six characters.

Rejections return field-level errors where a field is at fault, and a form-level message
otherwise.

## Sessions

`MockState.lastActivityAt` records the last interaction. `SESSION_IDLE_MS` is thirty
minutes: a session older than that is cleared when the app loads, and a timer checks
every thirty seconds while it is open. Pointer and key activity refresh the timestamp at
most once per minute, so browsing counts as activity but does not write to storage on
every click.

An expired session is signed out through the same path as an explicit sign-out, and both
write a `SIGN_OUT` audit entry naming the account. Thirty minutes was chosen to exceed the
layout suite's full fifteen-screen, seven-viewport run while still bounding an unattended
browser.

The limit is a convenience lock for a shared machine. There is no token to revoke and no
server-side session, so it cannot resist someone who can read browser storage.

## Backups

Administrators and owners get a **Backup and restore** panel on `/accounts`.

- **Download** writes `provi-beans-backup-YYYY-MM-DD.json` containing
  `{ exportedAt, state }`, produced in the browser.
- **Restore** accepts that envelope or a bare state object. It requires the `products`,
  `users`, `batches`, `movements`, and `audit` collections to be arrays, then merges the
  file over the seeded state so a collection missing from an older file falls back to
  defaults instead of breaking the UI.
- The signed-in account is kept only when the backup contains a user with the same id;
  otherwise the session is cleared and the page asks for a sign-in.
- A restore writes a `RESTORE` audit entry naming whoever performed it. The restored
  audit trail replaces the current one, which is the point of restoring a snapshot.

The check is structural, not semantic: a hand-edited file with valid array shapes will be
accepted, and the file contains the demo's plain-text passwords.

## Audit trail

`/reports/activity` lists the trail with actor, action, entity, search, and date filters,
plus CSV export. Entries record actor name, action, entity, entity id, before/after
values, and a timestamp.

| Action | Entity | Recorded by |
|---|---|---|
| `RECEIVE` | batch | receiving a batch |
| `QUARANTINE`, `UNQUARANTINE` | batch | quarantine and release |
| `ISSUE` | product | issuing stock |
| `RESERVE`, `RELEASE`, `ADJUSTMENT`, `COUNT` | batch | stock adjustments |
| `REVERSE` | movement | reversing a movement |
| `CREATE`, `ACTIVATE`, `DEACTIVATE` | product | catalog changes |
| `CREATE`, `ACTIVATE`, `DEACTIVATE` | user | account changes |
| `CREATE` | supplier, delivery | catalog and receiving records |
| `SIGN_IN`, `SIGN_OUT` | session | sign-in, sign-out, idle expiry |
| `RESTORE` | backup | restoring a backup |

Reads are not audited, and neither are notification read-marks. Both are omissions
rather than oversights: they change nothing about stock or access.

## Verification

- `npm run verify` — 7/7 frontend architecture checks, clean `tsc --noEmit`.
- `npm run verify:layout` — 98/98, run before and after the final store edit.
- `npm run build` — 19 static pages, including `/accounts` and all report routes.

Recorded on 2026-10-21 against the state described in the commit that added this file.

## Limits

- Passwords, sessions, and data are plain text in `localStorage`; anyone with browser
  access, or any script running on the origin, can read them.
- Role checks and the idle limit are interface behaviour, not access control.
- Backups are local files. Nothing is uploaded, scheduled, or retained outside the browser.
- Clearing site data destroys the state and every backup that was not downloaded first.
