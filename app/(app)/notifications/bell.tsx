"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNotifications } from "./store";

const SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: "badge-crit",
  WARNING: "badge-warn",
  INFO: "badge-info",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-PH", { day: "numeric", month: "short" });
}

export function NotificationBell({ variant }: { variant: "sidebar" | "bar" }) {
  const { items, unreadCount, loading, error, toasts, dismissToast, markRead, markAllRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [open]);

  return (
    <div
      className={`notif notif-${variant}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        className="notif-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          unreadCount === 0
            ? "Notifications, none unread"
            : `Notifications, ${unreadCount} unread`
        }
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            d="M12 3a5 5 0 0 0-5 5v3.6L5.7 14h12.6L17 11.6V8a5 5 0 0 0-5-5Zm0 18a2.4 2.4 0 0 0 2.3-1.8H9.7A2.4 2.4 0 0 0 12 21Z"
            fill="currentColor"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-panel" id={panelId} ref={panelRef} role="dialog" aria-label="Notifications">
          <header className="notif-panel-head">
            <strong>Notifications</strong>
            <button
              type="button"
              className="notif-link"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
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
              Nothing needs your attention. Low stock, expiring batches and new requests appear here.
            </p>
          ) : (
            <ul className="notif-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={item.isRead ? "notif-item notif-item-read" : "notif-item"}
                >
                  <span className="notif-item-top">
                    <span className={`badge ${SEVERITY_CLASS[item.severity] ?? "badge-info"}`}>
                      {item.type.replace(/_/g, " ")}
                    </span>
                    <span className="faint">{relativeTime(item.createdAt)}</span>
                  </span>
                  <span className="notif-item-title">{item.title}</span>
                  <span className="notif-item-message">{item.message}</span>
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
              ))}
            </ul>
          )}

          <footer className="notif-panel-foot">
            {/* The loaded page is capped, so the badge's authoritative count is
                the only number that cannot disagree with it. */}
            <span className="faint">
              {unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
            </span>
          </footer>
        </div>
      ) : null}

      <div className="notif-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`notif-toast ${SEVERITY_CLASS[toast.severity] ?? ""}`}>
            <span className="notif-item-title">{toast.title}</span>
            <span className="notif-item-message">{toast.message}</span>
            <button type="button" className="notif-link" onClick={() => dismissToast(toast.id)}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}