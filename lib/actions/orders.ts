"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import {
  cancelOrderRequest,
  confirmOrderRequest,
  fulfilOrderRequest,
  submitOrderRequest,
} from "@/lib/inventory/orders";

export type OrderFormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  reference?: string;
  lines?: {
    sku: string;
    requested: number;
    reserved: number;
    status: string;
    note: string | null;
    allocations: { lotCode: string; quantity: number }[];
  }[];
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optional(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

export async function submitOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const lines = formData
    .getAll("lines[]")
    .map((entry) => JSON.parse(String(entry)) as { productId: number; quantity: number })
    .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);

  const result = await submitOrderRequest({
    customerName: text(formData, "customerName"),
    business: optional(formData, "business"),
    email: text(formData, "email"),
    phone: optional(formData, "phone"),
    notes: optional(formData, "notes"),
    lines,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/requests");
  revalidatePath("/dashboard");

  return {
    ok: true,
    reference: result.reference,
    lines: result.lines,
    message: result.message,
  };
}

async function guard(
  run: (actor: string, actorId: number) => Promise<{ ok: boolean; message: string }>,
): Promise<OrderFormState> {
  try {
    const user = await requireUser();
    const result = await run(user.name, user.id);
    if (!result.ok) return { error: result.message };
    revalidatePath("/requests");
    revalidatePath("/dashboard");
    revalidatePath("/lots");
    return { ok: true, message: result.message };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function confirmOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const id = Number(formData.get("requestId"));
  return guard((actor, actorId) => confirmOrderRequest(id, actor, actorId));
}

export async function cancelOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const id = Number(formData.get("requestId"));
  return guard((actor, actorId) => cancelOrderRequest(id, actor, actorId));
}

export async function fulfilOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const id = Number(formData.get("requestId"));
  return guard((actor, actorId) => fulfilOrderRequest(id, actor, actorId));
}