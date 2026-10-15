"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { LoginState } from "@/lib/actions/auth";

type Action = (state: LoginState, formData: FormData) => Promise<LoginState>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Checking…" : "Sign in"}
    </button>
  );
}

export function SignInForm({ action, initialState }: { action: Action; initialState: LoginState }) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} noValidate>
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
        <SubmitButton />
      </div>
    </form>
  );
}