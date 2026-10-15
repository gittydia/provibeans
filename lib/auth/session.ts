import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import type { Role, User } from "@/lib/db/schema";

const COOKIE_NAME = "provi_session";
const SESSION_DAYS = 7;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

/**
 * Security-relevant: browsers drop a `Secure` cookie served over plain HTTP.
 * `npm run start` sets NODE_ENV=production, so keying this off NODE_ENV alone
 * breaks local production runs — login appears to do nothing because the
 * session never returns on the next request. Loopback is exempt because there
 * is no plaintext path to intercept; a forwarded proto header is trusted.
 */
export async function shouldUseSecureCookie(): Promise<boolean> {
  if (process.env.SESSION_COOKIE_SECURE) {
    return process.env.SESSION_COOKIE_SECURE === "true";
  }

  const requestHeaders = await headers();
  const hostname = (requestHeaders.get("host") ?? "").split(":")[0];
  if (LOCAL_HOSTS.has(hostname)) return false;

  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";

  return process.env.NODE_ENV === "production";
}

function expiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    token,
    userId,
    expiresAt: expiry().toISOString(),
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await shouldUseSecureCookie(),
    path: "/",
    expires: expiry(),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!row.user.isActive) return null;
  return row.user;
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("You need to sign in to continue.");
  return user;
}

export async function requireRole(...allowed: Role[]): Promise<User> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError("Your role does not permit this action.");
  }
  return user;
}

export function canManageMasterData(role: Role): boolean {
  return role === "ADMIN" || role === "OWNER";
}

export function canViewReports(role: Role): boolean {
  return role === "ADMIN" || role === "OWNER";
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  INVENTORY_STAFF: "Inventory staff",
  OWNER: "Owner / manager",
};