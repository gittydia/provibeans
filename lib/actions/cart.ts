"use server";

import { revalidatePath } from "next/cache";
import {
  addToCart,
  cartLinesForCheckout,
  clearCart,
  getCart,
  removeFromCart,
  setCartQuantity,
} from "@/lib/cart";
import { submitOrderRequest } from "@/lib/inventory/orders";

export type CartState = {
  ok?: boolean;
  message?: string;
  error?: string;
  reference?: string;
  shortLines?: { sku: string; requested: number; reserved: number; note: string | null }[];
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

function refresh(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

export async function addToCartAction(_prev: CartState, formData: FormData): Promise<CartState> {
  const productId = Number(formData.get("productId"));
  const quantity = Number.parseInt(text(formData, "quantity"), 10) || 1;

  const result = await addToCart(productId, quantity);
  if (!result.ok) return { error: result.message };

  refresh(["/cart", "/"]);
  return { ok: true, message: result.message };
}

export async function updateCartItemAction(_prev: CartState, formData: FormData): Promise<CartState> {
  const productId = Number(formData.get("productId"));
  const quantity = Number.parseInt(text(formData, "quantity"), 10);

  if (!Number.isInteger(quantity)) return { error: "Enter a whole number." };

  const result = await setCartQuantity(productId, quantity);
  refresh(["/cart", "/"]);
  return result.ok ? { ok: true, message: result.message } : { error: result.message };
}

export async function removeCartItemAction(_prev: CartState, formData: FormData): Promise<CartState> {
  await removeFromCart(Number(formData.get("productId")));
  refresh(["/cart", "/"]);
  return { ok: true, message: "Item removed from your cart." };
}

/**
 * Turns the cart into an order request. The reservation happens inside
 * submitOrderRequest, so stock is held the same way a staff-raised request
 * holds it, and the customer sees the same allocation breakdown.
 */
export async function checkoutAction(_prev: CartState, formData: FormData): Promise<CartState> {
  const lines = await cartLinesForCheckout();

  if (lines.length === 0) {
    return { error: "Your cart is empty." };
  }

  const result = await submitOrderRequest({
    customerName: text(formData, "customerName"),
    business: optional(formData, "business"),
    email: text(formData, "email"),
    phone: optional(formData, "phone"),
    notes: optional(formData, "notes"),
    lines,
  });

  if (!result.ok) return { error: result.error };

  await clearCart();
  revalidatePath("/cart");
  revalidatePath("/requests");

  return {
    ok: true,
    reference: result.reference,
    message: result.message,
    shortLines: result.lines
      .filter((line) => line.reserved < line.requested)
      .map((line) => ({
        sku: line.sku,
        requested: line.requested,
        reserved: line.reserved,
        note: line.note,
      })),
  };
}