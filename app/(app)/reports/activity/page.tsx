"use client";

import { useMockStore } from "@/lib/mock-store";

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
                <td className="faint">{entry.after ?? entry.before ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
