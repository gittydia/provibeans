"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/service";

export async function markNotificationReadAction(
  notificationId: number,
): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return { ok: false, changed: false, error: "Invalid notification." };
  }

  const user = await requireUser();
  const result = await markNotificationRead(user.id, notificationId);
  if (!result.ok) {
    return { ok: false, changed: false, error: "Notification not found." };
  }

  revalidatePath("/dashboard");
  return result;
}

export async function markAllNotificationsReadAction(): Promise<{
  ok: boolean;
  changed: number;
  error?: string;
}> {
  const user = await requireUser();
  const changed = await markAllNotificationsRead(user.id);
  revalidatePath("/dashboard");
  return { ok: true, changed };
}
