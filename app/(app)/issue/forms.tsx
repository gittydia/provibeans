"use client";

import { ActionForm, Field } from "../ui/action-form";
import { useState } from "react";
import { useMockStore, type AdjustmentDirection, type MovementType } from "@/lib/mock-store";

type Option = { id: number; label: string };
type LotOption = Option & { available: number; issuable: boolean };

export function IssueForm({ products, batches }: { products: Option[]; batches: LotOption[] }) {
  const { issueStock } = useMockStore();
  return (
    <ActionForm action={(formData) => issueStock({
      productId: Number(formData.get("productId")),
      quantity: Number(formData.get("quantity")),
      batchId: formData.get("batchId") ? Number(formData.get("batchId")) : null,
      reason: String(formData.get("reason") || "") || null,
      reference: String(formData.get("reference") || "") || null,
    })} submitLabel="Issue stock">
      {(state) => (
        <div className="form-grid">
          <Field label="Product" name="productId" error={state.fieldErrors?.productId}>
            <select>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Quantity" name="quantity" error={state.fieldErrors?.quantity}>
            <input type="number" min={1} step={1} defaultValue={1} />
          </Field>

          <Field
            label="Batch"
            name="batchId"
            hint="Leave blank to use the batch that expires soonest."
          >
            <select>
              <option value="">Soonest expiry first — recommended</option>
              {batches
                .filter((batch) => batch.issuable && batch.available > 0)
                .map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.label}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Reference" name="reference" hint="Sales order or customer reference.">
            <input placeholder="SO-1104" />
          </Field>

          <Field label="Reason" name="reason">
            <input placeholder="Stock release" />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

const MOVEMENTS = [
  { value: "RESERVE", label: "Reserve for an order" },
  { value: "RELEASE", label: "Release a reservation" },
  { value: "CANCEL", label: "Cancel a reservation" },
  { value: "RETURN", label: "Return stock in" },
  { value: "DAMAGE", label: "Record damage" },
  { value: "DISPOSE", label: "Dispose stock" },
  { value: "ADJUSTMENT", label: "Manual adjustment" },
  { value: "COUNT", label: "Reconcile a physical count" },
];

export function AdjustForm({ batches }: { batches: LotOption[] }) {
  const { adjustStock } = useMockStore();
  const [type, setType] = useState<MovementType>("RESERVE");
  const isAdjustment = type === "ADJUSTMENT";
  const isCount = type === "COUNT";
  return (
    <ActionForm action={(formData) => adjustStock({
      batchId: Number(formData.get("batchId")),
      type,
      quantity: Number(formData.get("quantity")),
      adjustmentDirection: isAdjustment
        ? String(formData.get("adjustmentDirection")) as AdjustmentDirection
        : null,
      reason: String(formData.get("reason") ?? ""),
      reference: String(formData.get("reference") || "") || null,
    })}       submitLabel="Record stock change">
      {(state) => (
        <div className="form-grid">
          <Field label="Batch" name="batchId" error={state.fieldErrors?.batchId}>
            <select>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Stock change" name="type">
            <select value={type} onChange={(event) => setType(event.target.value as MovementType)}>
              {MOVEMENTS.map((movement) => (
                <option key={movement.value} value={movement.value}>
                  {movement.label}
                </option>
              ))}
            </select>
          </Field>

          {isAdjustment ? (
            <Field label="Adjustment direction" name="adjustmentDirection" error={state.fieldErrors?.adjustmentDirection}>
              <select defaultValue="INCREASE">
                <option value="INCREASE">Increase stock</option>
                <option value="DECREASE">Decrease stock</option>
              </select>
            </Field>
          ) : null}

          <Field
            label={isCount ? "Counted quantity" : "Quantity"}
            name="quantity"
            error={state.fieldErrors?.quantity}
            hint={isCount ? "Enter the quantity physically counted. The variance is calculated automatically." : undefined}
          >
            <input type="number" min={isCount ? 0 : 1} step={1} defaultValue={isCount ? 0 : 1} />
          </Field>

          <Field label="Reason" name="reason" error={state.fieldErrors?.reason}>
            <input placeholder="Split seam on two bags" />
          </Field>

          <Field label="Reference" name="reference">
            <input placeholder="RMA-118" />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function ReverseForm({ movementId }: { movementId: number }) {
  const { reverseMovement } = useMockStore();
  return (
    <ActionForm action={(formData) => reverseMovement(movementId, String(formData.get("reason") ?? ""))} submitLabel="Reverse">
      {() => (
        <div className="form-grid">
          <input type="hidden" name="movementId" value={movementId} />
          <Field label="Reason" name="reason" hint="History is never deleted, only reversed.">
            <input placeholder="Keyed against the wrong batch" />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}
