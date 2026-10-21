"use client";

import Link from "next/link";
import { canViewReports, downloadCsv, useMockStore } from "@/lib/mock-store";

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function humanizeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function formatChange(raw: string | null): string {
  if (!raw) return "—";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const parts = Object.entries(parsed as Record<string, unknown>).map(
      ([key, value]) => `${humanizeKey(key)}: ${humanizeValue(value)}`,
    );
    return parts.length > 0 ? parts.join(", ") : "—";
  }
  return humanizeValue(parsed);
}

export default function ActivityLogPage() {
  const { state, user, hydrated } = useMockStore();
  if (!user) return null;

  if (!canViewReports(user.role)) {
    return (
      <section className="panel">
        <header>
          <h2>Activity log</h2>
          <p>Who acted, when, and on what.</p>
        </header>
        <p className="notice notice-crit" role="note">
          The audit log is available to administrators and owners.
        </p>
      </section>
    );
  }

  const searchParams = hydrated ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const filters = {
    actor: searchParams.get("actor") ?? "",
    action: searchParams.get("action") ?? "",
    q: searchParams.get("q") ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  };
  const from = filters.from ? new Date(filters.from).toISOString() : null;
  const toDate = filters.to ? new Date(filters.to) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);
  const needle = filters.q.trim().toLowerCase();

  const actors = [...new Set(state.audit.map((entry) => entry.actorName))].sort((a, b) => a.localeCompare(b));
  const actions = [...new Set(state.audit.map((entry) => entry.action))].sort((a, b) => a.localeCompare(b));

  /* The whole audit trail is listed. Trimming it to a fixed number of rows hid
     older activity from the screen and from the export. */
  const activity = state.audit
    .filter((entry) => !filters.actor || entry.actorName === filters.actor)
    .filter((entry) => !filters.action || entry.action === filters.action)
    .filter((entry) => !from || entry.createdAt >= from)
    .filter((entry) => !toDate || entry.createdAt <= toDate.toISOString())
    .filter((entry) => {
      if (!needle) return true;
      return `${entry.actorName} ${entry.action} ${entry.entity} ${entry.entityId ?? ""} ${entry.after ?? ""} ${entry.before ?? ""}`
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);

  return (
    <section className="panel">
      <header>
        <h2>Activity log</h2>
        <p>
          {activity.length} of {state.audit.length} entr{state.audit.length === 1 ? "y" : "ies"}
          {" · "}
          <button
            type="button"
            className="notif-link"
            onClick={() =>
              downloadCsv("provi-beans-activity-log.csv", [
                ["When", "Actor", "Action", "Entity", "Entity id", "Change"],
                ...activity.map((entry) => [
                  entry.createdAt,
                  entry.actorName,
                  entry.action,
                  entry.entity,
                  entry.entityId,
                  formatChange(entry.after ?? entry.before),
                ]),
              ])
            }
          >
            Export CSV
          </button>
        </p>
      </header>

      <form className="panel-body" method="get">
        <div className="form-grid">
          <label className="field" htmlFor="actor">
            <span>Person</span>
            <select id="actor" name="actor" defaultValue={filters.actor}>
              <option value="">Everyone</option>
              {actors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="action">
            <span>Action</span>
            <select id="action" name="action" defaultValue={filters.action}>
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="q">
            <span>Search</span>
            <input
              id="q"
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Entity, reference, or change"
            />
          </label>

          <label className="field" htmlFor="from">
            <span>From</span>
            <input id="from" type="date" name="from" defaultValue={filters.from} />
          </label>

          <label className="field" htmlFor="to">
            <span>To</span>
            <input id="to" type="date" name="to" defaultValue={filters.to} />
          </label>
        </div>

        <div className="actions">
          <button type="submit" className="btn btn-quiet">
            Apply filters
          </button>
          <Link href="/reports/activity" className="btn btn-quiet">
            Clear
          </Link>
        </div>
      </form>

      {activity.length === 0 ? (
        <p className="empty">No activity matches those filters.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Entity</th>
              <th scope="col">Reference</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((entry) => (
              <tr key={entry.id}>
                <td className="faint">{entry.createdAt.slice(0, 16).replace("T", " ")}</td>
                <td>{entry.actorName}</td>
                <td>{entry.action}</td>
                <td className="muted">
                  {entry.entity}
                  {entry.entityId ? ` ${entry.entityId}` : ""}
                </td>
                <td className="code">{entry.entityId ?? "—"}</td>
                <td className="faint">{formatChange(entry.after ?? entry.before)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
