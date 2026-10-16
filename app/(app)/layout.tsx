"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, useMockStore } from "@/lib/mock-store";
import { AppShell } from "./app-shell";
import { AppNav } from "./nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, hydrated, logout } = useMockStore();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) router.replace("/login?reason=auth");
  }, [hydrated, router, user]);

  if (!hydrated || !user) return null;

  return (
    <AppShell
      sidebar={
        <>
          <div>
            <Link className="side-mark" href="/dashboard">
              PROVI<span>BEANS</span>
            </Link>
            <p className="side-sub">Stock control</p>
          </div>

          <AppNav />

          <div className="side-foot">
            <strong>{user.name}</strong>
            {ROLE_LABELS[user.role]}
            <button type="button" onClick={() => { logout(); router.replace("/login?reason=signed-out"); }}>
              Sign out
            </button>
          </div>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
