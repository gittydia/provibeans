import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { maybeRunDailySweep } from "@/lib/inventory/alerts";
import {
  listNotifications,
  unreadCount,
  type NotificationCursor,
} from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function parseLimit(value: string | null): number {
  if (value === null) return 20;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function decodeCursor(value: string): NotificationCursor {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid cursor");

  const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid cursor");

  const cursor = parsed as Record<string, unknown>;
  if (
    typeof cursor.createdAt !== "string" ||
    Number.isNaN(Date.parse(cursor.createdAt)) ||
    typeof cursor.id !== "number" ||
    !Number.isInteger(cursor.id) ||
    cursor.id <= 0
  ) {
    throw new Error("Invalid cursor");
  }

  return { createdAt: cursor.createdAt, id: cursor.id };
}

function encodeCursor(cursor: NotificationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // A lot can cross its expiry date with nobody touching the dashboard, so the
    // poller is what eventually notices. Bounded to once per calendar day per
    // process by the callee, which keeps the ledger fold off every other poll.
    await maybeRunDailySweep();

    const searchParams = new URL(request.url).searchParams;
    const limit = parseLimit(searchParams.get("limit"));
    const encodedCursor = searchParams.get("cursor");

    let cursor: NotificationCursor | null = null;
    if (encodedCursor !== null) {
      try {
        cursor = decodeCursor(encodedCursor);
      } catch {
        return json({ error: "Invalid cursor" }, 400);
      }
    }

    const [page, count] = await Promise.all([
      listNotifications(user.id, { limit, cursor }),
      unreadCount(user.id),
    ]);

    return json({
      unreadCount: count,
      items: page.items,
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    });
  } catch (error) {
    console.error("[notifications] poll failed", error);
    return json({ error: "Unable to load notifications" }, 500);
  }
}
