"use client";

import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { requestRowFocus } from "@/lib/row-focus";
import { SEVERITY_CLASS, relativeTime } from "./shared";
import { useNotifications } from "./store";

export default function NotificationsPage() {
  const { items, unreadCount, loading, error, markRead, markAllRead } = useNotifications();

  return (
    <section className="panel notif-page">
      <header>
        <h2>Notifications</h2>
        <p>
          {unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
          {" · "}
          <button
            type="button"
            className="notif-link"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
          >
            Mark all read
          </button>
        </p>
      </header>

      {error ? (
        <p className="notif-state notif-state-error" role="status">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="notif-state">Checking for updates…</p>
      ) : items.length === 0 ? (
        <p className="notif-state">
          Nothing needs your attention. Low stock and expiring batches appear here.
        </p>
      ) : (
        <ul className="notif-list">
          {items.map((item) => {
            const target = item.target;
            return (
              <li
                key={item.id}
                className={item.isRead ? "notif-item notif-item-read" : "notif-item"}
              >
                <span className="notif-item-top">
                  <span className={`badge ${SEVERITY_CLASS[item.severity] ?? "badge-info"}`}>
                    {item.type.replace(/_/g, " ")}
                  </span>
                  <time
                    className="faint"
                    dateTime={item.createdAt}
                    title={formatDateTime(item.createdAt)}
                  >
                    {relativeTime(item.createdAt)}
                  </time>
                </span>
                {target ? (
                  <Link
                    href={target.href}
                    className="notif-item-link"
                    onClick={() => {
                      requestRowFocus(target.href);
                      if (!item.isRead) void markRead(item.id);
                    }}
                  >
                    <span className="notif-item-title">{item.title}</span>
                    <span className="notif-item-message">{item.message}</span>
                    <span className="notif-item-go">Open {target.label}</span>
                  </Link>
                ) : (
                  <>
                    <span className="notif-item-title">{item.title}</span>
                    <span className="notif-item-message">{item.message}</span>
                  </>
                )}
                <span className="notif-item-actions">
                  {item.isRead ? (
                    <span className="faint">Read</span>
                  ) : (
                    <button
                      type="button"
                      className="notif-link"
                      onClick={() => void markRead(item.id)}
                    >
                      Mark as read
                    </button>
                  )}
                </span>
                {item.isRead ? null : <span className="notif-dot" aria-label="Unread" />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
