"use client";

import { useMockStore } from "@/lib/mock-store";

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
  const { state, user } = useMockStore();
  if (!user) return null;
  const activity = [...state.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);

  return (
    <section className="panel">
      <header>
        <h2>Activity log</h2>
        <p>Who acted, when, and on what.</p>
      </header>
      {activity.length === 0 ? (
        <p className="empty">No activity recorded yet.</p>
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
