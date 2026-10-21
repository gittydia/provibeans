"use client";

import { useState } from "react";
import { ActionForm, Field } from "../ui/action-form";
import { canCreateRole, DEMO_PASSWORD, ROLE_LABELS, useMockStore, type FormState, type Role } from "@/lib/mock-store";

export function AccountForm({ actorRole }: { actorRole: Role }) {
  const { createUser } = useMockStore();
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter((role) => canCreateRole(actorRole, role));

  return (
    <ActionForm
      action={(formData) =>
        createUser({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          role: String(formData.get("role") ?? ""),
          password: String(formData.get("password") ?? "") || null,
        })
      }
      submitLabel="Create account"
    >
      {(state) => (
        <div className="form-grid">
          <Field label="Name" name="name" error={state.fieldErrors?.name}>
            <input placeholder="Rosa Delgado" />
          </Field>

          <Field label="Email" name="email" error={state.fieldErrors?.email}>
            <input type="email" placeholder="rosa@provibeans.ph" />
          </Field>

          <Field
            label="Role"
            name="role"
            error={state.fieldErrors?.role}
            hint={actorRole === "OWNER" ? "Administrator accounts can only be created by an administrator." : undefined}
          >
            <select defaultValue="INVENTORY_STAFF">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Password"
            name="password"
            error={state.fieldErrors?.password}
            hint={`Optional. Leave blank for the demo password ${DEMO_PASSWORD}.`}
          >
            <input type="password" placeholder="At least 6 characters" />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function AccountStateControl({ userId, email, isActive }: { userId: number; email: string; isActive: boolean }) {
  const { setUserActive } = useMockStore();
  const [state, setState] = useState<FormState>({});

  return (
    <div>
      {state.error ? (
        <span className="muted" role="alert">{state.error}</span>
      ) : state.message ? (
        <span className="muted" role="status">{state.message}</span>
      ) : null}
      <button
        type="button"
        className="btn btn-quiet btn-small"
        aria-label={`${isActive ? "Deactivate" : "Reactivate"} ${email}`}
        onClick={() => setState(setUserActive(userId, !isActive))}
      >
        {isActive ? "Deactivate" : "Reactivate"}
      </button>
    </div>
  );
}
