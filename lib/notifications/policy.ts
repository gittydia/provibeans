import type { Notification, Role } from "@/lib/db/schema";

/**
 * Which roles a notification is addressed to.
 *
 * A single global alert cannot be "for" everyone: an EXPIRED lot is a purchasing
 * and disposal decision for the owner, while a QUARANTINE blocks stock that any
 * clerk might otherwise issue. Getting this wrong is either notification spam or
 * a silent miss, so the routing is declared here as data rather than inferred at
 * each call site.
 */
const RECIPIENT_ROLES: Record<Notification["type"], Role[] | "ALL"> = {
  LOW_STOCK: ["OWNER", "ADMIN"],
  REORDER: ["OWNER", "ADMIN"],
  NEAR_EXPIRY: ["OWNER", "ADMIN"],
  EXPIRED: ["OWNER", "ADMIN"],
  COUNT_VARIANCE: ["OWNER", "ADMIN"],
  QUARANTINE: "ALL",
  ORDER_RECEIVED: ["ADMIN", "INVENTORY_STAFF"],
  ORDER_CONFIRMED: ["ADMIN", "INVENTORY_STAFF"],
  ORDER_FULFILLED: ["ADMIN", "INVENTORY_STAFF"],
  ORDER_CANCELLED: ["ADMIN", "INVENTORY_STAFF"],
};

const TITLES: Record<Notification["type"], string> = {
  LOW_STOCK: "Low stock",
  REORDER: "Reorder point reached",
  NEAR_EXPIRY: "Lot nearing expiry",
  EXPIRED: "Lot expired",
  QUARANTINE: "Lot quarantined",
  COUNT_VARIANCE: "Count variance",
  ORDER_RECEIVED: "New order request",
  ORDER_CONFIRMED: "Order confirmed",
  ORDER_FULFILLED: "Order fulfilled",
  ORDER_CANCELLED: "Order cancelled",
};

export function rolesFor(type: Notification["type"]): Role[] | "ALL" {
  return RECIPIENT_ROLES[type];
}

export function titleFor(type: Notification["type"]): string {
  return TITLES[type];
}

/**
 * Alert-backed notifications are keyed to the alert row rather than to the
 * condition, so idempotency is inherited from the derivation: a repeat
 * evaluation opens no new alert and therefore produces no new notification, while
 * a condition that clears and later returns opens a fresh alert row and so does
 * notify again. Anchoring to a timestamp or a condition string instead would
 * need a time window to allow genuine recurrences through.
 */
export function alertDedupeKey(alertId: number): string {
  return `alert:${alertId}`;
}

export function orderDedupeKey(requestId: number, status: string): string {
  return `order:${requestId}:${status}`;
}