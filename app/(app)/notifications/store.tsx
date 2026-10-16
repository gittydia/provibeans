"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildInboundMockNotification,
  buildMockNotifications,
  persistAllRead,
  persistRead,
  subscribeToReadChanges,
  type NotificationItem,
} from "./mock";

export type { NotificationItem };

export type NotificationToast = {
  id: number;
  title: string;
  message: string;
  severity: string;
};

const INBOUND_AFTER_MS = 6000;
const TOAST_LIFETIME_MS = 6000;
const MAX_TOASTS = 3;

type NotificationsStore = {
  items: NotificationItem[];
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
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const [loading, setLoading] = useState(true);

  const itemsRef = useRef<NotificationItem[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const inboundRef = useRef(false);

  const track = useCallback((id: ReturnType<typeof setTimeout>) => {
    timersRef.current.add(id);
  }, []);

  useEffect(() => {
    const first = buildMockNotifications();
    itemsRef.current = first;
    setItems(first);
    setLoading(false);

    // Stands in for the server pushing a new event, so the badge, the dropdown and
    // the toast path are demonstrably live without a backend.
    const inbound = setTimeout(() => {
      if (inboundRef.current) return;
      inboundRef.current = true;
      const arrived = buildInboundMockNotification();
      itemsRef.current = [arrived, ...itemsRef.current];
      setItems(itemsRef.current);
      setToasts((current) =>
        [...current, {
          id: arrived.id,
          title: arrived.title,
          message: arrived.message,
          severity: arrived.severity,
        }].slice(-MAX_TOASTS),
      );
    }, INBOUND_AFTER_MS);
    track(inbound);

    // Read state is shared through localStorage, so a second tab follows along.
    const unsubscribe = subscribeToReadChanges(() => {
      const current = buildMockNotifications();
      itemsRef.current = current;
      setItems(current);
    });

    const pending = timersRef.current;
    return () => {
      unsubscribe();
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, [track]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, TOAST_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const markRead = useCallback((id: number) => {
    const now = new Date().toISOString();
    const target = itemsRef.current.find((item) => item.id === id);
    if (!target || target.isRead) return;

    persistRead(id, now);
    const next = itemsRef.current.map((item) =>
      item.id === id ? { ...item, isRead: true, readAt: now } : item,
    );
    itemsRef.current = next;
    setItems(next);
  }, []);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    const touched = persistAllRead(now);
    if (touched.length === 0) return;

    const next = itemsRef.current.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? now }));
    itemsRef.current = next;
    setItems(next);
  }, []);

  const value = useMemo<NotificationsStore>(
    () => ({
      items,
      unreadCount: items.reduce((total, item) => total + (item.isRead ? 0 : 1), 0),
      loading,
      error: null,
      toasts,
      dismissToast,
      markRead,
      markAllRead,
    }),
    [items, loading, toasts, dismissToast, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}