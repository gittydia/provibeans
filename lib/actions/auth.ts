"use server";

import { redirect } from "next/navigation";
import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

export type LoginState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: Record<string, string> = {};

  if (!email) fieldErrors.email = "Enter your email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = found[0];

  const invalidPassword = await verifyPassword(password, user?.passwordHash ?? "scrypt$16384$8$1$AA$AA");

  if (!user || !invalidPassword || !user.isActive) {
    return { error: "That email and password combination was not recognised." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function pruneExpiredSessions(): Promise<number> {
  const removed = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date().toISOString()))
    .returning({ token: sessions.token });
  return removed.length;
}