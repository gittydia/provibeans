/**
 * Hardcoded notification fixtures.
 *
 * The notification feature is not implemented until capstone 2, so the UI runs on this
 * instead of the database. Nothing here reads or writes a server: read state lives in
 * `localStorage`, so it survives a refresh without a round-trip.
 *
 * The content mirrors what `lib/inventory/alerts.ts` actually derives, so a demo shows
 * the same vocabulary the real system will produce.
 */

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type NotificationItem = {
  id: number;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

const READ_KEY = "provi-notifications-read-v1";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

type Seed = Omit<NotificationItem, "createdAt" | "isRead" | "readAt"> & {
  age: number;
  read?: boolean;
};

const SEEDS: Seed[] = [
  {
    id: 101,
    type: "EXPIRED",
    severity: "CRITICAL",
    title: "Lot expired",
    message: "Lot HN-2601-A expired 3 day(s) ago and still holds 24 unit(s). It cannot be issued.",
    entityType: "lot",
    entityId: "1",
    age: 4 * MINUTE,
  },
  {
    id: 102,
    type: "LOW_STOCK",
    severity: "CRITICAL",
    title: "Low stock",
    message: "PB-SGN-250 is below its low-stock level: 6 available against a low-stock level of 20.",
    entityType: "product",
    entityId: "3",
    age: 26 * MINUTE,
  },
  {
    id: 103,
    type: "ORDER_RECEIVED",
    severity: "INFO",
    title: "New order request",
    message: "Request ORD-2026-0007 from Kettle and Co is awaiting confirmation.",
    entityType: "order_request",
    entityId: "7",
    age: 2 * HOUR,
  },
  {
    id: 104,
    type: "REORDER",
    severity: "WARNING",
    title: "Reorder point reached",
    message: "PB-HN-250 is at its reorder point: 18 available against a reorder point of 20.",
    entityType: "product",
    entityId: "1",
    age: 5 * HOUR,
  },
  {
    id: 105,
    type: "NEAR_EXPIRY",
    severity: "WARNING",
    title: "Lot nearing expiry",
    message: "Lot SG-2603-C reaches its effective date in 6 day(s). Issue it first.",
    entityType: "lot",
    entityId: "3",
    age: DAY,
  },
  {
    id: 106,
    type: "QUARANTINE",
    severity: "WARNING",
    title: "Lot quarantined",
    message: "Lot HN-2602-B is quarantined: seal damaged on arrival.",
    entityType: "lot",
    entityId: "2",
    age: 2 * DAY,
    read: true,
  },
  {
    id: 107,
    type: "COUNT_VARIANCE",
    severity: "INFO",
    title: "Count variance",
    message: "Physical count on lot #4 found a variance of -3 unit(s). No closing note recorded yet.",
    entityType: "lot",
    entityId: "4",
    age: 2 * DAY + 5 * HOUR,
    read: true,
  },
  {
    id: 108,
    type: "ORDER_FULFILLED",
    severity: "INFO",
    title: "Order fulfilled",
    message: "ORD-2026-0005 was fulfilled by Rina Bautista; stock has been issued.",
    entityType: "order_request",
    entityId: "5",
    age: 3 * DAY,
    read: true,
  },
];

/**
 * One notification that "arrives" after the first few seconds so the live path is
 * demonstrable without a server. Returned at most once per page load; the caller
 * records that it has fired so reload loops do not stack up toasts.
 */
const INBOUND: Omit<NotificationItem, "createdAt" | "isRead" | "readAt"> = {
  id: 109,
  type: "NEAR_EXPIRY",
  severity: "WARNING",
  title: "Lot nearing expiry",
  message: "Lot SG-2604-A reaches its effective date in 9 day(s). Issue it first.",
  entityType: "lot",
  entityId: "5",
};

export function buildMockNotifications(): NotificationItem[] {
  const readMap = loadReadMap();
  return SEEDS.map((seed) => toItem(seed, readMap));
}

export function buildInboundMockNotification(): NotificationItem {
  return { ...INBOUND, createdAt: new Date().toISOString(), isRead: false, readAt: null };
}

function toItem(seed: Seed, readMap: ReadMap): NotificationItem {
  const saved = readMap[seed.id];
  const isRead = seed.read === true || saved != null;
  return {
    id: seed.id,
    type: seed.type,
    severity: seed.severity,
    title: seed.title,
    message: seed.message,
    entityType: seed.entityType,
    entityId: seed.entityId,
    isRead,
    readAt: saved ?? (seed.read === true ? ago(seed.age) : null),
    createdAt: ago(seed.age),
  };
}

type ReadMap = Record<string, string>;

function loadReadMap(): ReadMap {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(READ_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return typeof parsed === "object" && parsed !== null ? (parsed as ReadMap) : {};
  } catch {
    // Private-mode or quota failures must not take the dropdown down with them.
    return {};
  }
}

export function persistRead(id: number, readAt: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...loadReadMap(), [id]: readAt };
    window.localStorage.setItem(READ_KEY, JSON.stringify(next));
  } catch {
    // Best effort: read state is a convenience, not the source of truth.
  }
}

export function persistAllRead(at: string): number[] {
  if (typeof window === "undefined") return [];
  const ids = SEEDS.map((seed) => seed.id);
  try {
    const next: ReadMap = { ...loadReadMap() };
    for (const id of ids) next[id] = at;
    window.localStorage.setItem(READ_KEY, JSON.stringify(next));
  } catch {
    // Best effort.
  }
  return ids;
}

export function subscribeToReadChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key === READ_KEY) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}