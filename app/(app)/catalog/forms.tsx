"use client";

import { ActionForm, Field } from "../ui/action-form";
import { useMockStore } from "@/lib/mock-store";

type Option = { id: number; label: string };

export function ProductForm() {
  const { createProduct } = useMockStore();
  return (
    <ActionForm action={(formData) => createProduct({
      sku: String(formData.get("sku") ?? ""),
      name: String(formData.get("name") ?? ""),
      weightGrams: Number(formData.get("weightGrams")),
      unitPrice: Number(formData.get("unitPrice")),
      originCountry: String(formData.get("originCountry") || "Vietnam"),
      originRegion: String(formData.get("originRegion") || "") || null,
      species: String(formData.get("species") || "") || null,
      process: String(formData.get("process") || "") || null,
      roastLevel: String(formData.get("roastLevel") || "") || null,
      lowStockLevel: Number(formData.get("lowStockLevel")) || 10,
      reorderPoint: Number(formData.get("reorderPoint")) || 20,
      nearExpiryDays: Number(formData.get("nearExpiryDays")) || 30,
    })} submitLabel="Add product">
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
  const { createSupplier } = useMockStore();
  return (
    <ActionForm action={(formData) => createSupplier({
      name: String(formData.get("name") ?? ""),
      contactName: String(formData.get("contactName") || "") || null,
      email: String(formData.get("email") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      country: String(formData.get("country") || "Vietnam"),
      address: String(formData.get("address") || "") || null,
      notes: String(formData.get("notes") || "") || null,
    })} submitLabel="Add supplier">
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
  const { createDelivery } = useMockStore();
  return (
    <ActionForm action={(formData) => createDelivery({
      supplierId: Number(formData.get("supplierId")),
      reference: String(formData.get("reference") || "") || null,
      receivedAt: String(formData.get("receivedAt") || new Date().toISOString()),
      notes: String(formData.get("notes") || "") || null,
    })} submitLabel="Record delivery">
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
