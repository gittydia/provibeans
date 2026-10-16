"use client";

import { ActionForm } from "../ui/action-form";
import { useMockStore, type FormState } from "@/lib/mock-store";

function Row({ requestId }: { requestId: number }) {
  const { updateRequest } = useMockStore();
  return (
    <div className="request-actions">
      <ActionForm action={() => updateRequest(requestId, "CONFIRMED")} submitLabel="Confirm">
        {(state: FormState) => (
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

      <ActionForm action={() => updateRequest(requestId, "FULFILLED")} submitLabel="Fulfil">
        {(state: FormState) => (
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

      <ActionForm action={() => updateRequest(requestId, "CANCELLED")} submitLabel="Cancel">
        {(state: FormState) => (
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
