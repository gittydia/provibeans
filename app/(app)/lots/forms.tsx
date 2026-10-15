"use client";

import { ActionForm, Field } from "../ui/action-form";
import { createLotAction, quarantineLotAction, releaseQuarantineAction } from "@/lib/actions/inventory";

type Option = { id: number; label: string };

export function CreateLotForm({
  products,
  deliveries,
}: {
  products: Option[];
  deliveries: Option[];
}) {
  return (
    <ActionForm action={createLotAction} submitLabel="Receive lot">
      {(state) => (
        <div className="form-grid">
          <Field label="Lot code" name="code" error={state.fieldErrors?.code} hint="Unique across all stock.">
            <input placeholder="HN-2603-A" />
          </Field>

          <Field label="Product" name="productId" error={state.fieldErrors?.productId}>
            <select>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Delivery" name="deliveryId" hint="Optional. Links this lot to a supplier delivery.">
            <select>
              <option value="">Not linked</option>
              {deliveries.map((delivery) => (
                <option key={delivery.id} value={delivery.id}>
                  {delivery.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Quantity" name="quantity" error={state.fieldErrors?.quantity}>
            <input type="number" min={1} step={1} defaultValue={1} />
          </Field>

          <Field label="Received" name="receivedAt" hint="Defaults to today.">
            <input type="date" />
          </Field>

          <Field label="Roasted" name="roastDate">
            <input type="date" />
          </Field>

          <Field label="Packed" name="packDate">
            <input type="date" />
          </Field>

          <Field label="Best before" name="bestBeforeDate" error={state.fieldErrors?.bestBeforeDate}>
            <input type="date" />
          </Field>

          <Field label="Expires" name="expiryDate" error={state.fieldErrors?.expiryDate}>
            <input type="date" />
          </Field>

          <Field label="Notes" name="notes">
            <textarea placeholder="Anything worth remembering about this lot." />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function QuarantineForm({ lotId, reason }: { lotId: number; reason?: string | null }) {
  return (
    <ActionForm action={quarantineLotAction} submitLabel="Quarantine">
      {() => (
        <div className="form-grid">
          <input type="hidden" name="lotId" value={lotId} />
          <Field label="Reason" name="reason" hint={reason ? `Currently: ${reason}` : "Required."}>
            <input placeholder="Transit damage" />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function ReleaseForm({ lotId }: { lotId: number }) {
  return (
    <ActionForm action={releaseQuarantineAction} submitLabel="Release to available">
      {() => (
        <div className="form-grid">
          <input type="hidden" name="lotId" value={lotId} />
        </div>
      )}
    </ActionForm>
  );
}