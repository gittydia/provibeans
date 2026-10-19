"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMockStore, type NotificationItem } from "@/lib/mock-store";
import { notificationTarget, type NotificationTarget } from "@/lib/notification-links";

export type { NotificationItem };

/* The destination is resolved once, here, where the whole state is in scope, so
   the page and the toast cannot disagree about where a notification leads. */
export type NotificationToast = {
  id: number;
  title: string;
  message: string;
  severity: string;
  target: NotificationTarget | null;
};

type NotificationsStore = {
  items: (NotificationItem & { isRead: boolean; target: NotificationTarget | null })[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  toasts: NotificationToast[];
  dismissToast: (id: number) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
};

const NotificationsContext = createContext<NotificationsStore | null>(null);

export function useNotifications(): NotificationsStore {
  const store = useContext(NotificationsContext);
  if (!store) throw new Error("useNotifications must be used inside NotificationsProvider");
  return store;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { state, hydrated, markNotificationRead, markAllNotificationsRead, pushNotification } = useMockStore();
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  useEffect(() => {
    if (!hydrated || state.notifications.some((item) => item.entityId === "demo-inbound")) return;
    const timer = window.setTimeout(() => {
      const item = pushNotification({
        type: "NEAR_EXPIRY",
        severity: "WARNING",
        title: "Batch nearing expiry",
        message: "Batch HN-2602-B reaches its use-by date soon. Issue it first.",
        entityType: "batch",
        entityId: "demo-inbound",
      });
      setToasts([
        {
          id: item.id,
          title: item.title,
          message: item.message,
          severity: item.severity,
          target: notificationTarget(item, state),
        },
      ]);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [hydrated, pushNotification, state.notifications]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => setToasts((current) => current.slice(1)), 6000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  const dismissToast = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const items = useMemo(
    () =>
      state.notifications.map((item) => ({
        ...item,
        isRead: item.readAt !== null,
        target: notificationTarget(item, state),
      })),
    [state],
  );
  const value = useMemo<NotificationsStore>(() => ({
    items,
    unreadCount: items.filter((item) => !item.isRead).length,
    loading: !hydrated,
    error: null,
    toasts,
    dismissToast,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
  }), [dismissToast, hydrated, items, markAllNotificationsRead, markNotificationRead, toasts]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
