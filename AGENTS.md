# Project Rules

## Frontend-only development

Provi Beans is currently a frontend-only demonstration application.

- Use hardcoded mock data and browser-local state only.
- Do not add, use, query, seed, migrate, configure, or depend on a database.
- Do not add backend APIs, route handlers, server actions, server-side authentication, or external service integrations.
- Implement authentication with the documented demo accounts in browser-local state.
- Implement mutations with browser-local mock state and preserve the existing routes and visual layout.
- Implement exports in the browser; do not add server endpoints for them.
- If a request conflicts with this policy, stop and ask for explicit confirmation before changing the policy.

## Existing work

Preserve the current uncommitted layout-alignment work in `app/app.css`, the authenticated pages, and
`docs/ui-layout-alignment.md` unless the requested change requires an update.
