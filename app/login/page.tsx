"use client";

import { useMockStore } from "@/lib/mock-store";
import { SignInForm } from "./signin-form";

export default function LoginPage() {
  const { hydrated } = useMockStore();
  const reason = hydrated ? new URLSearchParams(window.location.search).get("reason") : null;

  return (
    <div className="signin">
      <div className="signin-card">
        <p className="eyebrow">Provi Beans</p>
        <h1>Stock control</h1>
        <p>
          Sign in to the inventory and stock monitoring system. The demo administrator account is already
          filled in — press <strong>Sign in</strong> to continue.
        </p>

        {reason === "signed-out" ? (
          <p className="notice notice-ok" role="status">
            You have been signed out.
          </p>
        ) : null}

        <SignInForm />

        <div className="demo">
          <strong>Demo accounts</strong> — password <code>ProviBeans2026</code>
          <br />
          <code>admin@provibeans.ph</code> administrator
          <br />
          <code>staff@provibeans.ph</code> inventory staff
          <br />
          <code>owner@provibeans.ph</code> owner / manager
        </div>
      </div>
    </div>
  );
}
