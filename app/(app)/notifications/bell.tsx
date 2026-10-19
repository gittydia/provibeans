"use client";

import Link from "next/link";
import { requestRowFocus } from "@/lib/row-focus";
import { SEVERITY_CLASS } from "./shared";
import { useNotifications } from "./store";

/* The bell no longer owns a panel: it is the way in to the notifications page,
   so it is a link and the shell has no overlay state to keep in sync with it.
   Toasts stay here because they are transient and belong to whatever screen
   raised them, not to the page they would have to be dismissed from. */
export function NotificationBell({ variant }: { variant: "sidebar" | "bar" }) {
  const { unreadCount, toasts, dismissToast, markRead } = useNotifications();

  return (
    <div className={`notif notif-${variant}`}>
      <Link
        href="/notifications"
        className="notif-toggle"
        aria-label={
          unreadCount === 0
            ? "Notifications, none unread"
            : `Notifications, ${unreadCount} unread`
        }
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
      </Link>

      <div className="notif-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const target = toast.target;
          return (
            <div key={toast.id} className={`notif-toast ${SEVERITY_CLASS[toast.severity] ?? ""}`}>
              {target ? (
                <Link
                  href={target.href}
                  className="notif-item-link"
                  onClick={() => {
                    requestRowFocus(target.href);
                    void markRead(toast.id);
                  }}
                >
                  <span className="notif-item-title">{toast.title}</span>
                  <span className="notif-item-message">{toast.message}</span>
                  <span className="notif-item-go">Open {target.label}</span>
                </Link>
              ) : (
                <>
                  <span className="notif-item-title">{toast.title}</span>
                  <span className="notif-item-message">{toast.message}</span>
                </>
              )}
              <button type="button" className="notif-link" onClick={() => dismissToast(toast.id)}>
                Dismiss
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
