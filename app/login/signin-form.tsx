"use client";

import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useMockStore, type FormState } from "@/lib/mock-store";

export function SignInForm() {
  const { login } = useMockStore();
  const router = useRouter();
  const [state, setState] = useState<FormState>({});

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    setState(result);
    if (result.ok) router.replace("/dashboard");
  }

  return (
    <form onSubmit={submit} noValidate>
      {state.error ? (
        <p className="notice notice-crit" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue="admin@provibeans.ph"
          required
          aria-invalid={state.fieldErrors?.email ? "true" : undefined}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email ? (
          <small id="email-error" data-error="true">
            {state.fieldErrors.email}
          </small>
        ) : null}
      </div>

      <div className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue="ProviBeans2026"
          required
          aria-invalid={state.fieldErrors?.password ? "true" : undefined}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        {state.fieldErrors?.password ? (
          <small id="password-error" data-error="true">
            {state.fieldErrors.password}
          </small>
        ) : null}
      </div>

      <div className="actions">
        <button type="submit" className="btn">Sign in</button>
      </div>
    </form>
  );
}
