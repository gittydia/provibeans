"use client";

import Link from "next/link";
import { ActionForm } from "@/app/(app)/ui/action-form";
import { addToCartAction, type CartState } from "@/lib/actions/cart";

export function AddToCartForm({
  productId,
  available,
  sku,
}: {
  productId: number;
  available: number;
  sku: string;
}) {
  if (available === 0) {
    return (
      <div>
        <p className="notice notice-crit" role="status">
          {sku} is fully reserved or out of stock right now.
        </p>
      </div>
    );
  }

  return (
    <ActionForm action={addToCartAction} submitLabel="Add to cart" formId={`add-to-cart-${productId}`}>
      {(state: CartState) => (
        <>
          <input type="hidden" name="productId" value={productId} />

          {state.ok ? (
            <p className="notice notice-ok" role="status">
              {state.message} <Link href="/cart">View cart →</Link>
            </p>
          ) : null}

          {state.error ? (
            <p className="notice notice-crit" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="add-to-cart">
            <label className="field" htmlFor={`qty-${productId}`}>
              <span>Bags</span>
              <input
                id={`qty-${productId}`}
                type="number"
                name="quantity"
                min={1}
                max={available}
                step={1}
                defaultValue={1}
              />
            </label>
          </div>

          <p className="faint">
            {available} bag{available === 1 ? "" : "s"} available to order now.
          </p>
        </>
      )}
    </ActionForm>
  );
}