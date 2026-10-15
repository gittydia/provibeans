"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deliveries, products, suppliers } from "@/lib/db/schema";
import type { MovementType } from "@/lib/db/schema";
import { requireUser, canManageMasterData } from "@/lib/auth/session";
import { evaluateAlerts } from "@/lib/inventory/alerts";
import {
  adjustLotStock,
  createLot,
  issueStock,
  quarantineLot,
  releaseQuarantine,
  reverseMovement,
  type MutationResult,
} from "@/lib/inventory/record";

export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value === "" ? null : value;
}

function integer(formData: FormData, key: string): number {
  return Number.parseInt(text(formData, key), 10);
}

function toState(result: MutationResult<unknown>): FormState {
  if (result.ok) return { ok: true, message: result.message };
  return { error: result.error, fieldErrors: result.fieldErrors };
}

function refresh(paths: string[]) {
  for (const path of ["/dashboard", ...paths]) revalidatePath(path);
}

export async function createLotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const result = await createLot({
    actor: { id: user.id, name: user.name },
    code: text(formData, "code"),
    productId: integer(formData, "productId"),
    deliveryId: optionalText(formData, "deliveryId") ? integer(formData, "deliveryId") : null,
    receivedAt: optionalText(formData, "receivedAt") ?? new Date().toISOString(),
    quantity: integer(formData, "quantity"),
    dates: {
      roastDate: optionalText(formData, "roastDate"),
      packDate: optionalText(formData, "packDate"),
      bestBeforeDate: optionalText(formData, "bestBeforeDate"),
      expiryDate: optionalText(formData, "expiryDate"),
    },
    notes: optionalText(formData, "notes"),
  });

  if (result.ok) {
    await evaluateAlerts();
    refresh(["/lots"]);
  }
  return toState(result);
}

export async function issueStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const lotId = optionalText(formData, "lotId") ? integer(formData, "lotId") : null;

  const result = await issueStock({
    actor: { id: user.id, name: user.name },
    productId: integer(formData, "productId"),
    quantity: integer(formData, "quantity"),
    lotId,
    reason: optionalText(formData, "reason"),
    reference: optionalText(formData, "reference"),
  });

  if (result.ok) {
    await evaluateAlerts();
    refresh(["/issue"]);
  }
  return toState(result);
}

const ADJUSTMENT_TYPES: { value: MovementType; verb: string }[] = [
  { value: "RESERVE", verb: "Reserved" },
  { value: "RELEASE", verb: "Released" },
  { value: "CANCEL", verb: "Cancelled reservation on" },
  { value: "RETURN", verb: "Returned onto" },
  { value: "DAMAGE", verb: "Damaged on" },
  { value: "DISPOSE", verb: "Disposed from" },
  { value: "COUNT", verb: "Counted variance on" },
];

export async function adjustStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const type = text(formData, "type") as MovementType;
  const config = ADJUSTMENT_TYPES.find((entry) => entry.value === type);
  if (!config) return { error: "Choose a valid movement type." };

  const result = await adjustLotStock({
    actor: { id: user.id, name: user.name },
    lotId: integer(formData, "lotId"),
    quantity: integer(formData, "quantity"),
    reason: text(formData, "reason") || config.verb,
    reference: optionalText(formData, "reference"),
    type,
    successVerb: config.verb,
  });

  if (result.ok) {
    await evaluateAlerts();
    refresh(["/issue", "/lots"]);
  }
  return toState(result);
}

export async function quarantineLotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await quarantineLot(user, integer(formData, "lotId"), text(formData, "reason"));
  if (result.ok) {
    await evaluateAlerts();
    refresh(["/lots", "/issue"]);
  }
  return toState(result);
}

export async function releaseQuarantineAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const result = await releaseQuarantine(user, integer(formData, "lotId"));
  if (result.ok) refresh(["/lots", "/issue"]);
  return toState(result);
}

export async function reverseMovementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const result = await reverseMovement(user, integer(formData, "movementId"), text(formData, "reason"));
  if (result.ok) {
    await evaluateAlerts();
    refresh(["/reports", "/dashboard"]);
  }
  return toState(result);
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canManageMasterData(user.role)) {
    return { error: "Only an administrator or the owner may change the product catalogue." };
  }

  const fieldErrors: Record<string, string> = {};
  const sku = text(formData, "sku").toUpperCase();
  const name = text(formData, "name");
  const weightGrams = integer(formData, "weightGrams");
  const unitPrice = Number(text(formData, "unitPrice"));

  if (!sku) fieldErrors.sku = "A SKU is required.";
  if (!name) fieldErrors.name = "A product name is required.";
  if (!Number.isInteger(weightGrams) || weightGrams <= 0) {
    fieldErrors.weightGrams = "Enter a whole number above zero.";
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    fieldErrors.unitPrice = "Enter a price of zero or more.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Check the highlighted fields.", fieldErrors };
  }

  const duplicate = await db.query.products.findFirst({ where: eq(products.sku, sku) });
  if (duplicate) return { error: `SKU ${sku} is already in use.`, fieldErrors: { sku: "Already in use." } };

  await db.insert(products).values({
    sku,
    name,
    originCountry: text(formData, "originCountry") || "Vietnam",
    originRegion: optionalText(formData, "originRegion"),
    species: optionalText(formData, "species"),
    process: optionalText(formData, "process"),
    roastLevel: optionalText(formData, "roastLevel"),
    weightGrams,
    unitPrice,
    lowStockLevel: integer(formData, "lowStockLevel") || 10,
    reorderPoint: integer(formData, "reorderPoint") || 20,
    nearExpiryDays: integer(formData, "nearExpiryDays") || 30,
  });

  refresh(["/catalog"]);
  return { ok: true, message: `${sku} added to the catalogue.` };
}

export async function createSupplierAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!canManageMasterData(user.role)) {
    return { error: "Only an administrator or the owner may add suppliers." };
  }

  const name = text(formData, "name");
  if (!name) return { error: "A supplier name is required.", fieldErrors: { name: "Required." } };

  const duplicate = await db.query.suppliers.findFirst({ where: eq(suppliers.name, name) });
  if (duplicate) {
    return { error: `${name} is already recorded.`, fieldErrors: { name: "Already recorded." } };
  }

  await db.insert(suppliers).values({
    name,
    contactName: optionalText(formData, "contactName"),
    email: optionalText(formData, "email"),
    phone: optionalText(formData, "phone"),
    country: text(formData, "country") || "Vietnam",
    address: optionalText(formData, "address"),
    notes: optionalText(formData, "notes"),
  });

  refresh(["/catalog"]);
  return { ok: true, message: `${name} added.` };
}

export async function createDeliveryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const supplierId = integer(formData, "supplierId");
  const reference = optionalText(formData, "reference");

  if (!supplierId) return { error: "Choose the supplier this delivery came from." };

  if (reference) {
    const existing = await db.query.deliveries.findFirst({ where: eq(deliveries.reference, reference) });
    if (existing) {
      return {
        error: `Reference ${reference} has already been recorded.`,
        fieldErrors: { reference: "Already used." },
      };
    }
  }

  await db.insert(deliveries).values({
    supplierId,
    reference,
    receivedAt: optionalText(formData, "receivedAt") ?? new Date().toISOString(),
    notes: optionalText(formData, "notes"),
    recordedBy: user.id,
  });

  refresh(["/catalog", "/lots"]);
  return { ok: true, message: reference ? `Delivery ${reference} recorded.` : "Delivery recorded." };
}