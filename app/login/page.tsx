"use client";

import { useMockStore } from "@/lib/mock-store";
import { SignInForm, type DemoAccount } from "./signin-form";

const demoAccounts = [
  { email: "admin@provibeans.ph", password: "ProviBeans2026", label: "administrator" },
  { email: "staff@provibeans.ph", password: "ProviBeans2026", label: "inventory staff" },
  { email: "owner@provibeans.ph", password: "ProviBeans2026", label: "owner / manager" },
] as const satisfies readonly DemoAccount[];

export default function LoginPage() {
  const { hydrated } = useMockStore();
  const reason = hydrated ? new URLSearchParams(window.location.search).get("reason") : null;

  return (
    <div className="signin">
      <div className="signin-card">
        <p className="eyebrow">Provi Beans</p>
        <h1>Stock control</h1>
        <p>
          Sign in to the inventory and stock monitoring system. The demo administrator email is already
          filled in, or choose a demo account below to fill both fields.
        </p>

        {reason === "signed-out" ? (
          <p className="notice notice-ok" role="status">
            You have been signed out.
          </p>
        ) : null}

        <SignInForm demoAccounts={demoAccounts} />
      </div>
    </div>
  );
}
