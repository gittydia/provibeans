"use client";

import { cloneElement, isValidElement, useState, type SyntheticEvent } from "react";
import type { ReactElement } from "react";
import type { FormState } from "@/lib/mock-store";

type Action = (formData: FormData) => FormState;

type RenderFields = (state: FormState) => React.ReactNode;

export function ActionForm({
  action,
  submitLabel,
  formId,
  children,
}: {
  action: Action;
  submitLabel: string;
  formId?: string;
  children: React.ReactNode | RenderFields;
}) {
  const [state, setState] = useState<FormState>({});

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(action(new FormData(event.currentTarget)));
  }

  return (
    <form onSubmit={submit} noValidate data-form={formId}>
      {state.ok && state.message ? (
        <p className="notice notice-ok" role="status">
          {state.message}
        </p>
      ) : null}

      {state.error ? (
        <p className="notice notice-crit" role="alert">
          {state.error}
        </p>
      ) : null}

      {typeof children === "function" ? children(state) : children}

      <div className="actions">
        <button type="submit" className="btn">{submitLabel}</button>
      </div>
    </form>
  );
}

/**
 * Wraps a single input and wires the accessibility attributes onto it directly,
 * so the visible error text is genuinely associated with the control.
 */
export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: ReactElement;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: name,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <label className="field" htmlFor={name}>
      <span>{label}</span>
      {control}
      {hint ? <small id={hintId}>{hint}</small> : null}
      {error ? (
        <small id={errorId} data-error="true">
          {error}
        </small>
      ) : null}
    </label>
  );
}
