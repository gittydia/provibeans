"use client";

import { ActionForm, Field } from "@/app/(app)/ui/action-form";
import {
  checkoutAction,
  removeCartItemAction,
  updateCartItemAction,
  type CartState,
} from "@/lib/actions/cart";

export function QuantityControl({ productId, quantity }: { productId: number; quantity: number }) {
  return (
    <ActionForm action={updateCartItemAction} submitLabel="Update">
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
  return (
    <ActionForm action={removeCartItemAction} submitLabel="Remove">
      {() => <input type="hidden" name="productId" value={productId} />}
    </ActionForm>
  );
}

export function CheckoutForm() {
  return (
    <ActionForm action={checkoutAction} submitLabel="Place order request" formId="checkout">
      {(state: CartState) => (
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