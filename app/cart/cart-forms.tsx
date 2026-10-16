"use client";

import { ActionForm, Field } from "@/app/(app)/ui/action-form";
import { useMockStore, type FormState } from "@/lib/mock-store";

export function QuantityControl({ productId, quantity }: { productId: number; quantity: number }) {
  const { setCartQuantity } = useMockStore();
  return (
    <ActionForm action={(formData) => setCartQuantity(productId, Number(formData.get("quantity")))} submitLabel="Update">
      {() => (
        <>
          <input type="hidden" name="productId" value={productId} />
          <div className="qty-control">
            <label className="field" htmlFor={`cart-qty-${productId}`}>
              <span className="faint">Bags</span>
              <input
                id={`cart-qty-${productId}`}
                type="number"
                name="quantity"
                min={0}
                step={1}
                defaultValue={quantity}
              />
            </label>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function RemoveButton({ productId }: { productId: number }) {
  const { setCartQuantity } = useMockStore();
  return (
    <ActionForm action={() => setCartQuantity(productId, 0)} submitLabel="Remove">
      {() => <input type="hidden" name="productId" value={productId} />}
    </ActionForm>
  );
}

export function CheckoutForm() {
  const { checkout } = useMockStore();
  return (
    <ActionForm action={(formData) => checkout({
      customerName: String(formData.get("customerName") ?? ""),
      business: String(formData.get("business") || "") || null,
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") || "") || null,
      notes: String(formData.get("notes") || "") || null,
    })} submitLabel="Place order request" formId="checkout">
      {(state: FormState) => (
        <>
          {state.reference ? (
            <div className="notice notice-ok" role="status">
              <strong>{state.reference}</strong> — {state.message}
              {state.shortLines?.length ? (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {state.shortLines.map((line) => (
                    <li key={line.sku}>
                      {line.sku}: {line.reserved} of {line.requested} held
                      {line.note ? ` — ${line.note}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p style={{ margin: "8px 0 0" }}>
                <a href="/">Continue browsing</a>
              </p>
            </div>
          ) : null}

          {state.error ? (
            <p className="notice notice-crit" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="form-grid">
            <Field label="Your name" name="customerName">
              <input required />
            </Field>
            <Field label="Business" name="business" hint="Coffee shop, cafe, or office.">
              <input />
            </Field>
            <Field label="Email" name="email">
              <input type="email" required />
            </Field>
            <Field label="Phone" name="phone">
              <input />
            </Field>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <span>Notes</span>
            <textarea name="notes" placeholder="Delivery schedule, where to drop off, anything we should know." />
          </div>

          <p className="faint" style={{ marginTop: 12 }}>
            Placing an order request holds the stock that expires soonest. Nothing is charged online — we
            confirm by email and invoice you.
          </p>
        </>
      )}
    </ActionForm>
  );
}
