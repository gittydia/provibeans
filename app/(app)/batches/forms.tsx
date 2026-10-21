"use client";

import { useState } from "react";
import { ActionForm, Field } from "../ui/action-form";
import { codePrefix, nextBatchCode } from "@/lib/codes";
import { useMockStore } from "@/lib/mock-store";

type Option = { id: number; label: string };
type ProductOption = { id: number; label: string; sku: string; name: string };

export function CreateLotForm({
  products,
  deliveries,
  batches,
}: {
  products: ProductOption[];
  deliveries: Option[];
  batches: { code: string; productId: number }[];
}) {
  const { createLot } = useMockStore();
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const [receivedAt, setReceivedAt] = useState("");
  const [code, setCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);
  const selectedProduct = products.find((entry) => entry.id === productId);
  const codeValue = codeEdited
    ? code
    : selectedProduct
      ? nextBatchCode(codePrefix(selectedProduct.sku, selectedProduct.name), receivedAt, productId, batches)
      : "";

  return (
    <ActionForm action={(formData) => createLot({
      code: codeValue,
      productId: Number(formData.get("productId")),
      deliveryId: formData.get("deliveryId") ? Number(formData.get("deliveryId")) : null,
      quantity: Number(formData.get("quantity")),
      receivedAt: String(formData.get("receivedAt") || new Date().toISOString()),
      roastDate: String(formData.get("roastDate") || "") || null,
      packDate: String(formData.get("packDate") || "") || null,
      bestBeforeDate: String(formData.get("bestBeforeDate") || "") || null,
      expiryDate: String(formData.get("expiryDate") || "") || null,
      notes: String(formData.get("notes") || "") || null,
    })} submitLabel="Receive batch">
      {(state) => (
        <div className="form-grid">
          <Field
            label="Batch code"
            name="code"
            error={state.fieldErrors?.code}
            hint="Suggested from the product and receipt month. Edit to override."
          >
            <input
              placeholder="HN-2603-A"
              value={codeValue}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeEdited(event.target.value.trim().length > 0);
              }}
            />
          </Field>

          <Field label="Product" name="productId" error={state.fieldErrors?.productId}>
            <select value={productId} onChange={(event) => setProductId(Number(event.target.value))}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Delivery" name="deliveryId" hint="Optional. Links this batch to a supplier delivery.">
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
            <input
              type="date"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
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
            <textarea placeholder="Anything worth remembering about this batch." />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function QuarantineForm({ batchId, reason }: { batchId: number; reason?: string | null }) {
  const { quarantineLot } = useMockStore();
  return (
    <ActionForm action={(formData) => quarantineLot(batchId, String(formData.get("reason") ?? ""))} submitLabel="Quarantine">
      {() => (
        <div className="form-grid">
          <input type="hidden" name="batchId" value={batchId} />
          <Field label="Reason" name="reason" hint={reason ? `Currently: ${reason}` : "Required."}>
            <input placeholder="Transit damage" />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function ReleaseForm({ batchId }: { batchId: number }) {
  const { releaseLot } = useMockStore();
  return (
    <ActionForm action={() => releaseLot(batchId)} submitLabel="Release to available">
      {() => (
        <div className="form-grid">
          <input type="hidden" name="batchId" value={batchId} />
        </div>
      )}
    </ActionForm>
  );
}
