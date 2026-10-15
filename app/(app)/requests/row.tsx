"use client";

import { ActionForm } from "../ui/action-form";
import {
  cancelOrderAction,
  confirmOrderAction,
  fulfilOrderAction,
  type OrderFormState,
} from "@/lib/actions/orders";

function Row({ requestId }: { requestId: number }) {
  return (
    <div className="request-actions">
      <ActionForm action={confirmOrderAction} submitLabel="Confirm">
        {(state: OrderFormState) => (
          <>
            <input type="hidden" name="requestId" value={requestId} />
            {state.error ? (
              <p className="faint" style={{ color: "var(--app-crit)" }}>
                {state.error}
              </p>
            ) : null}
          </>
        )}
      </ActionForm>

      <ActionForm action={fulfilOrderAction} submitLabel="Fulfil">
        {(state: OrderFormState) => (
          <>
            <input type="hidden" name="requestId" value={requestId} />
            {state.error ? (
              <p className="faint" style={{ color: "var(--app-crit)" }}>
                {state.error}
              </p>
            ) : null}
          </>
        )}
      </ActionForm>

      <ActionForm action={cancelOrderAction} submitLabel="Cancel">
        {(state: OrderFormState) => (
          <>
            <input type="hidden" name="requestId" value={requestId} />
            {state.error ? (
              <p className="faint" style={{ color: "var(--app-crit)" }}>
                {state.error}
              </p>
            ) : null}
          </>
        )}
      </ActionForm>
    </div>
  );
}

export function RequestRow({ requestId }: { requestId: number }) {
  return <Row requestId={requestId} />;
}