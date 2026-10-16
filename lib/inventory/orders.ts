import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditLogs,
  lots,
  movements,
  orderRequestLines,
  orderRequests,
  orderReservations,
  products,
} from "@/lib/db/schema";
import type { OrderRequestStatus } from "@/lib/db/schema";
import { publishOrderNotification } from "@/lib/notifications/service";
import { orderDedupeKey, titleFor } from "@/lib/notifications/policy";
import { allocateFefo, buildLotViews, fefoPlan, type FefoAllocation } from "./ledger";
import { evaluateAlertsSafely } from "./alerts";

export type OrderLineInput = { productId: number; quantity: number };

/** Thrown inside a transaction to abort it when a compare-and-set finds no row. */
class StaleOrderState extends Error {}

export type OrderLineResult = {
  productId: number;
  sku: string;
  requested: number;
  reserved: number;
  status: "RESERVED" | "PARTIAL" | "SHORT" | "CANCELLED";
  allocations: { lotCode: string; quantity: number }[];
  note: string | null;
};

export type SubmitResult =
  | {
      ok: true;
      reference: string;
      lines: OrderLineResult[];
      message: string;
    }
  | { ok: false; error: string };

function nextReference(id: number): string {
  return `ORD-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;
}

/**
 * Accepts a B2B request and reserves stock immediately.
 *
 * The request is deliberately tolerant: a line that cannot be fully covered is
 * recorded as PARTIAL or SHORT with a note rather than rejecting the whole
 * order, because a customer asking for 200 bags is still a real lead even if
 * only 150 are issuable today. Expired and quarantined lots never contribute.
 */
export async function submitOrderRequest(input: {
  customerName: string;
  business?: string | null;
  email: string;
  phone?: string | null;
  notes?: string | null;
  lines: OrderLineInput[];
}): Promise<SubmitResult> {
  const customerName = input.customerName.trim();
  const email = input.email.trim();

  if (!customerName) return { ok: false, error: "Please give a contact name." };
  if (!email || !email.includes("@")) return { ok: false, error: "Please give a valid email address." };

  const wanted = new Map<number, number>();
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) continue;
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
  }

  if (wanted.size === 0) {
    return { ok: false, error: "Choose at least one coffee and a quantity above zero." };
  }

  const productRows = await db
    .select()
    .from(products)
    .where(sql`${products.id} in ${[...wanted.keys()]}`);

  const missing = [...wanted.keys()].filter((id) => !productRows.some((row) => row.id === id));
  if (missing.length > 0) return { ok: false, error: "One of the selected coffees no longer exists." };

  // Allocations are computed before the transaction opens: the database is
  // requires a synchronous callback, and a FEFO plan is a read.
  const plans = new Map<number, { allocations: FefoAllocation[]; shortfall: number }>();
  for (const product of productRows) {
    const requested = wanted.get(product.id) ?? 0;
    plans.set(product.id, await allocateFefo(product.id, requested));
  }

  const created = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(orderRequests)
      .values({
        reference: "PENDING",
        customerName,
        business: input.business?.trim() || null,
        email,
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
        status: "NEW",
      })
      .returning();

    const reference = nextReference(request.id);
    await tx.update(orderRequests).set({ reference }).where(eq(orderRequests.id, request.id));

    const results: OrderLineResult[] = [];

    for (const product of productRows) {
      const requested = wanted.get(product.id) ?? 0;
      const plan = plans.get(product.id);
      const allocations = plan?.allocations ?? [];
      const shortfall = plan?.shortfall ?? requested;
      const reserved = requested - shortfall;

      const lineStatus: OrderLineResult["status"] =
        reserved === 0 ? "SHORT" : reserved < requested ? "PARTIAL" : "RESERVED";

      const note =
        reserved === 0
          ? "No issuable stock. Every lot is expired, quarantined or depleted."
          : shortfall > 0
            ? `Short by ${shortfall}. We will confirm the balance when stock arrives.`
            : null;

      const [line] = await tx
        .insert(orderRequestLines)
        .values({
          orderRequestId: request.id,
          productId: product.id,
          quantityRequested: requested,
          quantityReserved: reserved,
          status: lineStatus,
          note,
        })
        .returning();

      const allocationsForResult: OrderLineResult["allocations"] = [];

      for (const allocation of allocations) {
        const [movement] = await tx
          .insert(movements)
          .values({
            lotId: allocation.lotId,
            productId: product.id,
            type: "RESERVE",
            quantity: allocation.quantity,
            reason: `Held for order ${reference}`,
            reference,
            performedBy: null,
          })
          .returning();

        await tx.insert(orderReservations).values({
          orderRequestLineId: line.id,
          lotId: allocation.lotId,
          movementId: movement.id,
          quantity: allocation.quantity,
        });

        allocationsForResult.push({
          lotCode: allocation.lotCode,
          quantity: allocation.quantity,
        });
      }

      results.push({
        productId: product.id,
        sku: product.sku,
        requested,
        reserved,
        status: lineStatus,
        allocations: allocationsForResult,
        note,
      });
    }

    await tx.insert(auditLogs).values({
        actorId: null,
        actorName: customerName,
        action: "ORDER_REQUEST",
        entity: "order_request",
        entityId: reference,
        after: JSON.stringify({ lines: results.map((r) => `${r.sku}:${r.requested}`) }),
      });

    await publishOrderNotification(tx, {
      type: "ORDER_RECEIVED",
      severity: "INFO",
      title: titleFor("ORDER_RECEIVED"),
      message: `Request ${reference} from ${customerName} is awaiting confirmation.`,
      orderRequestId: request.id,
      dedupeKey: orderDedupeKey(request.id, "NEW"),
    });

    return { reference, results };
  });

  await evaluateAlertsSafely();

  const summary = created.results
    .map((line) => `${line.sku}: ${line.reserved}/${line.requested}`)
    .join(", ");

  return {
    ok: true,
    reference: created.reference,
    lines: created.results,
    message: `Request ${created.reference} received. ${summary}. We will confirm by email.`,
  };
}

export async function listOrderRequests() {
  return db
    .select()
    .from(orderRequests)
    .orderBy(desc(orderRequests.createdAt), desc(orderRequests.id))
    .limit(100);
}

export async function loadOrderRequest(id: number) {
  const request = await db.query.orderRequests.findFirst({ where: eq(orderRequests.id, id) });
  if (!request) return null;

  const lines = await db
    .select({ line: orderRequestLines, product: products })
    .from(orderRequestLines)
    .innerJoin(products, eq(orderRequestLines.productId, products.id))
    .where(eq(orderRequestLines.orderRequestId, id));

  const reservations = await db
    .select({ reservation: orderReservations, lot: lots })
    .from(orderReservations)
    .innerJoin(lots, eq(orderReservations.lotId, lots.id))
    .where(
      and(
        isNull(orderReservations.releasedAt),
        sql`${orderReservations.orderRequestLineId} in ${lines.map((entry) => entry.line.id)}`,
      ),
    );

  return { request, lines, reservations };
}

/** Cancelling releases every live reservation so the stock returns to available. */
export async function cancelOrderRequest(
  id: number,
  actor: string,
  actorId?: number | null,
): Promise<{ ok: boolean; message: string }> {
  const loaded = await loadOrderRequest(id);
  if (!loaded) return { ok: false, message: "That request does not exist." };
  if (loaded.request.status === "CANCELLED") return { ok: false, message: "That request is already cancelled." };
  if (loaded.request.status === "FULFILLED") {
    return { ok: false, message: "A fulfilled request cannot be cancelled. Issue a reversal instead." };
  }

  try {
    await db.transaction(async (tx) => {
      const now = new Date().toISOString();

      const claimed = await tx
        .update(orderRequests)
        .set({ status: "CANCELLED", updatedAt: now })
        .where(and(eq(orderRequests.id, id), inArray(orderRequests.status, ["NEW", "CONFIRMED"])))
        .returning({ id: orderRequests.id });

      // The pre-read above is a fast path only. This compare-and-set is the
      // authority: if another operator moved the row first it matches no row and
      // rolls the whole transaction back rather than issuing a second set of
      // CANCEL movements against stock someone else already released.
      if (claimed.length === 0) throw new StaleOrderState("request is no longer cancellable");

      for (const { reservation } of loaded.reservations) {
        if (reservation.movementId === null) continue;
        await tx.insert(movements).values({
          lotId: reservation.lotId,
          productId: loaded.lines.find((entry) => entry.line.id === reservation.orderRequestLineId)?.line
            .productId ?? 0,
          type: "CANCEL",
          quantity: reservation.quantity,
          reason: `Order ${loaded.request.reference} cancelled`,
          reference: loaded.request.reference,
          performedBy: null,
        });
        await tx
          .update(orderReservations)
          .set({ releasedAt: now })
          .where(eq(orderReservations.id, reservation.id));
      }

      for (const { line } of loaded.lines) {
        await tx.update(orderRequestLines).set({ status: "CANCELLED" }).where(eq(orderRequestLines.id, line.id));
      }

      await tx.insert(auditLogs).values({
        actorId: null,
        actorName: actor,
        action: "ORDER_CANCEL",
        entity: "order_request",
        entityId: loaded.request.reference,
        before: JSON.stringify({ status: loaded.request.status }),
        after: JSON.stringify({ status: "CANCELLED" }),
      });

      await publishOrderNotification(tx, {
        type: "ORDER_CANCELLED",
        severity: "INFO",
        title: titleFor("ORDER_CANCELLED"),
        message: `${loaded.request.reference} was cancelled by ${actor}; reserved stock released.`,
        orderRequestId: id,
        dedupeKey: orderDedupeKey(id, "CANCELLED"),
        excludeUserId: actorId ?? null,
      });
    });
  } catch (error) {
    if (error instanceof StaleOrderState) {
      return { ok: false, message: "That request was already handled by someone else." };
    }
    throw error;
  }

  await evaluateAlertsSafely();
  return { ok: true, message: `${loaded.request.reference} cancelled and stock released.` };
}

/** Fulfilment issues the reserved stock and closes the request. */
export async function fulfilOrderRequest(
  id: number,
  actor: string,
  actorId?: number | null,
): Promise<{ ok: boolean; message: string }> {
  const loaded = await loadOrderRequest(id);
  if (!loaded) return { ok: false, message: "That request does not exist." };
  if (loaded.request.status !== "NEW" && loaded.request.status !== "CONFIRMED") {
    return { ok: false, message: "Only a new or confirmed request can be fulfilled." };
  }

  try {
    await db.transaction(async (tx) => {
      const now = new Date().toISOString();

      const claimed = await tx
        .update(orderRequests)
        .set({ status: "FULFILLED", updatedAt: now })
        .where(and(eq(orderRequests.id, id), inArray(orderRequests.status, ["NEW", "CONFIRMED"])))
        .returning({ id: orderRequests.id });

      if (claimed.length === 0) throw new StaleOrderState("request is no longer fulfillable");

      for (const { reservation } of loaded.reservations) {
        const line = loaded.lines.find((entry) => entry.line.id === reservation.orderRequestLineId);
        if (!line) continue;

        await tx.insert(movements).values({
          lotId: reservation.lotId,
          productId: line.line.productId,
          type: "ISSUE",
          quantity: reservation.quantity,
          reason: `Fulfilled order ${loaded.request.reference}`,
          reference: loaded.request.reference,
          performedBy: null,
        });

        await tx.insert(movements).values({
          lotId: reservation.lotId,
          productId: line.line.productId,
          type: "RELEASE",
          quantity: reservation.quantity,
          reason: `Reservation consumed by ${loaded.request.reference}`,
          reference: loaded.request.reference,
          performedBy: null,
        });

        await tx
          .update(orderReservations)
          .set({ releasedAt: now })
          .where(eq(orderReservations.id, reservation.id));
      }

      await tx.insert(auditLogs).values({
        actorId: null,
        actorName: actor,
        action: "ORDER_FULFIL",
        entity: "order_request",
        entityId: loaded.request.reference,
        before: JSON.stringify({ status: loaded.request.status }),
        after: JSON.stringify({ status: "FULFILLED" }),
      });

      await publishOrderNotification(tx, {
        type: "ORDER_FULFILLED",
        severity: "INFO",
        title: titleFor("ORDER_FULFILLED"),
        message: `${loaded.request.reference} was fulfilled by ${actor}; stock has been issued.`,
        orderRequestId: id,
        dedupeKey: orderDedupeKey(id, "FULFILLED"),
        excludeUserId: actorId ?? null,
      });
    });
  } catch (error) {
    if (error instanceof StaleOrderState) {
      return { ok: false, message: "That request was already handled by someone else." };
    }
    throw error;
  }

  await evaluateAlertsSafely();
  return { ok: true, message: `${loaded.request.reference} fulfilled and stock issued.` };
}

export async function confirmOrderRequest(
  id: number,
  actor: string,
  actorId?: number | null,
): Promise<{ ok: boolean; message: string }> {
  const request = await db.query.orderRequests.findFirst({ where: eq(orderRequests.id, id) });
  if (!request) return { ok: false, message: "That request does not exist." };
  if (request.status !== "NEW") return { ok: false, message: "Only a new request can be confirmed." };

  try {
    await db.transaction(async (tx) => {
      const now = new Date().toISOString();

      const claimed = await tx
        .update(orderRequests)
        .set({ status: "CONFIRMED", updatedAt: now })
        .where(and(eq(orderRequests.id, id), eq(orderRequests.status, "NEW")))
        .returning({ id: orderRequests.id });

      if (claimed.length === 0) throw new StaleOrderState("request is no longer new");

      await tx.insert(auditLogs).values({
        actorId: null,
        actorName: actor,
        action: "ORDER_CONFIRM",
        entity: "order_request",
        entityId: request.reference,
        before: JSON.stringify({ status: request.status }),
        after: JSON.stringify({ status: "CONFIRMED" }),
      });

      await publishOrderNotification(tx, {
        type: "ORDER_CONFIRMED",
        severity: "INFO",
        title: titleFor("ORDER_CONFIRMED"),
        message: `${request.reference} was confirmed by ${actor}.`,
        orderRequestId: id,
        dedupeKey: orderDedupeKey(id, "CONFIRMED"),
        excludeUserId: actorId ?? null,
      });
    });
  } catch (error) {
    if (error instanceof StaleOrderState) {
      return { ok: false, message: "That request was already handled by someone else." };
    }
    throw error;
  }

  return { ok: true, message: `${request.reference} confirmed.` };
}

export async function openRequestCounts() {
  const rows = await db
    .select({ status: orderRequests.status, count: sql<number>`count(*)` })
    .from(orderRequests)
    .groupBy(orderRequests.status);

  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.status] = row.count;

  return {
    NEW: totals.NEW ?? 0,
    CONFIRMED: totals.CONFIRMED ?? 0,
    FULFILLED: totals.FULFILLED ?? 0,
    CANCELLED: totals.CANCELLED ?? 0,
  };
}

export { buildLotViews, fefoPlan };
export type { OrderRequestStatus };