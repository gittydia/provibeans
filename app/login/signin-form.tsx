"use client";

import { useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useMockStore, type FormState } from "@/lib/mock-store";

export type DemoAccount = {
  email: string;
  password: string;
  label: string;
};

export function SignInForm({ demoAccounts }: { demoAccounts: readonly DemoAccount[] }) {
  const { login } = useMockStore();
  const router = useRouter();
  const [state, setState] = useState<FormState>({});
  const [email, setEmail] = useState("admin@provibeans.ph");
  const [password, setPassword] = useState("");

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
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
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
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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

      <div className="demo">
        <strong>Demo accounts</strong> — password <code>ProviBeans2026</code>
        {demoAccounts.map((account) => (
          <button
            key={account.email}
            type="button"
            className="demo-account"
            onClick={() => {
              setEmail(account.email);
              setPassword(account.password);
              setState({});
            }}
          >
            <code>{account.email}</code> {account.label}
          </button>
        ))}
      </div>
    </form>
  );
}
