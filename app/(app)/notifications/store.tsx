"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMockStore, type NotificationItem } from "@/lib/mock-store";

export type { NotificationItem };

export type NotificationToast = {
  id: number;
  title: string;
  message: string;
  severity: string;
};

type NotificationsStore = {
  items: (NotificationItem & { isRead: boolean })[];
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
        message: "Batch HN-2602-B reaches its effective date soon. Issue it first.",
        entityType: "batch",
        entityId: "demo-inbound",
      });
      setToasts([{ id: item.id, title: item.title, message: item.message, severity: item.severity }]);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [hydrated, pushNotification, state.notifications]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => setToasts((current) => current.slice(1)), 6000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  const dismissToast = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const items = useMemo(() => state.notifications.map((item) => ({ ...item, isRead: item.readAt !== null })), [state.notifications]);
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
