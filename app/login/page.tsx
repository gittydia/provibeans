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
          Sign in to the inventory and stock monitoring system. The demo administrator email is already
          filled in.
        </p>

        {reason === "signed-out" ? (
          <p className="notice notice-ok" role="status">
            You have been signed out.
          </p>
        ) : null}

        <SignInForm />
      </div>
    </div>
  );
}
