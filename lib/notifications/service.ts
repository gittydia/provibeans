import { and, count, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { alerts, notifications, users } from "@/lib/db/schema";
import type { Notification } from "@/lib/db/schema";
import { alertDedupeKey, rolesFor, titleFor } from "./policy";

type Executor = Pick<typeof db, "select" | "insert" | "update">;

const nowExpression = sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export type NotificationDraft = {
  userId: number;
  type: Notification["type"];
  severity: Notification["severity"];
  title: string;
  message: string;
  entityType?: Notification["entityType"];
  entityId?: string | null;
  alertId?: number | null;
  orderRequestId?: number | null;
  dedupeKey: string;
};

export type NotificationCursor = { createdAt: string; id: number };

export type NotificationView = {
  id: number;
  type: Notification["type"];
  severity: Notification["severity"];
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

function toView(row: Notification): NotificationView {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    entityType: row.entityType,
    entityId: row.entityId,
    isRead: row.readAt !== null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

function addressedTo(type: Notification["type"], role: (typeof users.$inferSelect)["role"]): boolean {
  const roles = rolesFor(type);
  return roles === "ALL" || roles.includes(role);
}

async function activeRecipients(
  executor: Executor,
  excludeUserId?: number | null,
): Promise<{ id: number; role: (typeof users.$inferSelect)["role"] }[]> {
  const rows = await executor
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.isActive, true));

  return excludeUserId == null ? rows : rows.filter((row) => row.id !== excludeUserId);
}

async function insertDrafts(executor: Executor, drafts: NotificationDraft[]): Promise<number> {
  if (drafts.length === 0) return 0;

  const rows = await executor
    .insert(notifications)
    .values(drafts)
    .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
    .returning({ id: notifications.id });

  return rows.length;
}

/**
 * Creates inbox entries for open alerts that a given recipient has none of, so a
 * failed fan-out is repaired on the next run rather than lost.
 *
 * The "already delivered" test is per (alert, recipient), never per alert:
 * testing it per alert would leave a recipient permanently un-notified whenever
 * a fan-out partially succeeded, because one user's row landing would mask
 * another's that never did.
 */
export async function reconcileAlertNotifications(
  executor: Executor = db,
  options: { excludeUserId?: number | null } = {},
): Promise<number> {
  const open = await executor
    .select({
      id: alerts.id,
      type: alerts.type,
      severity: alerts.severity,
      message: alerts.message,
      productId: alerts.productId,
      lotId: alerts.lotId,
    })
    .from(alerts)
    .where(isNull(alerts.resolvedAt));

  if (open.length === 0) return 0;

  const recipients = await activeRecipients(executor, options.excludeUserId);
  if (recipients.length === 0) return 0;

  const delivered = await executor
    .select({ alertId: notifications.alertId, userId: notifications.userId })
    .from(notifications)
    .where(
      and(
        isNotNull(notifications.alertId),
        inArray(
          notifications.userId,
          recipients.map((user) => user.id),
        ),
      ),
    );

  const alreadyDelivered = new Set(delivered.map((row) => `${row.alertId}:${row.userId}`));
  const drafts: NotificationDraft[] = [];

  for (const alert of open) {
    for (const user of recipients) {
      if (!addressedTo(alert.type, user.role)) continue;
      if (alreadyDelivered.has(`${alert.id}:${user.id}`)) continue;

      drafts.push({
        userId: user.id,
        type: alert.type,
        severity: alert.severity,
        title: titleFor(alert.type),
        message: alert.message,
        entityType: alert.lotId != null ? "lot" : "product",
        entityId:
          alert.lotId != null
            ? String(alert.lotId)
            : alert.productId != null
              ? String(alert.productId)
              : null,
        alertId: alert.id,
        dedupeKey: alertDedupeKey(alert.id),
      });
    }
  }

  return insertDrafts(executor, drafts);
}

export async function unreadCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

export async function listNotifications(
  userId: number,
  options: { limit?: number; cursor?: NotificationCursor | null } = {},
): Promise<{ items: NotificationView[]; nextCursor: NotificationCursor | null }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const cursor = options.cursor ?? null;

  const boundary = cursor
    ? or(
        lt(notifications.createdAt, cursor.createdAt),
        and(eq(notifications.createdAt, cursor.createdAt), lt(notifications.id, cursor.id)),
      )
    : undefined;

  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), boundary))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return {
    items: page.map(toView),
    nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export async function markNotificationRead(
  userId: number,
  notificationId: number,
): Promise<{ ok: boolean; changed: boolean }> {
  const updated = await db
    .update(notifications)
    .set({ readAt: nowExpression })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });

  if (updated.length > 0) return { ok: true, changed: true };

  // Scoped to the caller on purpose: an id belonging to somebody else must look
  // exactly like one that does not exist, so the response cannot be used to
  // probe for valid notification ids.
  const owned = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .limit(1);

  return owned.length > 0 ? { ok: true, changed: false } : { ok: false, changed: false };
}

/**
 * Marks everything currently unread as read in a single statement.
 *
 * There is deliberately no client-supplied cutoff timestamp. Under PostgreSQL's
 * default READ COMMITTED isolation the statement takes its snapshot when it
 * begins, so a notification committed after that point is simply not visible to
 * it and stays unread — which is exactly the required behaviour, with no window
 * in which a concurrent arrival can be swallowed.
 */
export async function markAllNotificationsRead(userId: number): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ readAt: nowExpression })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });

  return rows.length;
}

export async function publishOrderNotification(
  executor: Executor,
  input: {
    type: Notification["type"];
    severity: Notification["severity"];
    title: string;
    message: string;
    orderRequestId: number;
    dedupeKey: string;
    excludeUserId?: number | null;
  },
): Promise<number> {
  const recipients = await activeRecipients(executor, input.excludeUserId);
  const targets = recipients.filter((user) => addressedTo(input.type, user.role));

  return insertDrafts(
    executor,
    targets.map((user) => ({
      userId: user.id,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      entityType: "order_request" as const,
      entityId: String(input.orderRequestId),
      orderRequestId: input.orderRequestId,
      dedupeKey: input.dedupeKey,
    })),
  );
}