"use client";

import { ActionForm, Field } from "../ui/action-form";
import {
  createDeliveryAction,
  createProductAction,
  createSupplierAction,
} from "@/lib/actions/inventory";

type Option = { id: number; label: string };

export function ProductForm() {
  return (
    <ActionForm action={createProductAction} submitLabel="Add product">
      {(state) => (
        <div className="form-grid">
          <Field label="SKU" name="sku" error={state.fieldErrors?.sku}>
            <input placeholder="PB-SGN-500" />
          </Field>

          <Field label="Name" name="name" error={state.fieldErrors?.name}>
            <input placeholder="Saigon Say Hi 500g" />
          </Field>

          <Field label="Weight (g)" name="weightGrams" error={state.fieldErrors?.weightGrams}>
            <input type="number" min={1} step={1} defaultValue={250} />
          </Field>

          <Field label="Unit price" name="unitPrice" error={state.fieldErrors?.unitPrice}>
            <input type="number" min={0} step="0.01" defaultValue={265} />
          </Field>

          <Field label="Origin country" name="originCountry">
            <input defaultValue="Vietnam" />
          </Field>

          <Field label="Origin region" name="originRegion">
            <input placeholder="Ho Chi Minh City" />
          </Field>

          <Field label="Species / blend" name="species">
            <input placeholder="100% Robusta" />
          </Field>

          <Field label="Process" name="process">
            <input placeholder="Natural" />
          </Field>

          <Field label="Roast level" name="roastLevel">
            <input placeholder="Dark" />
          </Field>

          <Field label="Low-stock level" name="lowStockLevel" hint="Warn at or below this.">
            <input type="number" min={0} step={1} defaultValue={10} />
          </Field>

          <Field label="Reorder point" name="reorderPoint" hint="Signals replenishment.">
            <input type="number" min={0} step={1} defaultValue={20} />
          </Field>

          <Field label="Near-expiry days" name="nearExpiryDays" hint="Flag this many days ahead.">
            <input type="number" min={1} step={1} defaultValue={30} />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function SupplierForm() {
  return (
    <ActionForm action={createSupplierAction} submitLabel="Add supplier">
      {(state) => (
        <div className="form-grid">
          <Field label="Name" name="name" error={state.fieldErrors?.name}>
            <input placeholder="Central Highlands Cooperative" />
          </Field>

          <Field label="Contact" name="contactName">
            <input />
          </Field>

          <Field label="Email" name="email">
            <input type="email" />
          </Field>

          <Field label="Phone" name="phone">
            <input />
          </Field>

          <Field label="Country" name="country">
            <input defaultValue="Vietnam" />
          </Field>

          <Field label="Address" name="address">
            <input />
          </Field>

          <Field label="Notes" name="notes">
            <textarea />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}

export function DeliveryForm({ suppliers }: { suppliers: Option[] }) {
  return (
    <ActionForm action={createDeliveryAction} submitLabel="Record delivery">
      {(state) => (
        <div className="form-grid">
          <Field label="Supplier" name="supplierId" error={state.fieldErrors?.supplierId}>
            <select>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Reference"
            name="reference"
            error={state.fieldErrors?.reference}
            hint="Supplier document number. Must be unique."
          >
            <input placeholder="CH-2026-031" />
          </Field>

          <Field label="Received" name="receivedAt">
            <input type="date" />
          </Field>

          <Field label="Notes" name="notes">
            <textarea placeholder="Partial receipt, second pallet short." />
          </Field>
        </div>
      )}
    </ActionForm>
  );
}