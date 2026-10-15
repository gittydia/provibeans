import { and, eq, sql } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { auditLogs, lots, movements, products } from "@/lib/db/schema";
import type { Lot, MovementType } from "@/lib/db/schema";
import { allocateFefo, balancesForLots, buildLotViews } from "./ledger";

export type Actor = { id: number; name: string };

export type MutationResult<T = void> =
  | { ok: true; data?: T; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const fail = (error: string, fieldErrors?: Record<string, string>): MutationResult<never> => ({
  ok: false,
  error,
  fieldErrors,
});

function writeAudit(
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
) {
  db.insert(auditLogs)
    .values({
      actorId: actor.id,
      actorName: actor.name,
      action,
      entity,
      entityId,
      before: before === undefined ? null : JSON.stringify(before),
      after: after === undefined ? null : JSON.stringify(after),
    })
    .run();
}

function isValidDate(value: string | null | undefined): boolean {
  if (!value) return true;
  return !Number.isNaN(new Date(value).getTime());
}

export type LotDates = {
  roastDate?: string | null;
  packDate?: string | null;
  bestBeforeDate?: string | null;
  expiryDate?: string | null;
};

/**
 * Date ordering is enforced here as well as in the CHECK constraint.
 * The constraint is the floor; this produces the message the operator sees.
 */
export function validateLotDates(dates: LotDates, receivedAt: string): Record<string, string> | null {
  const problems: Record<string, string> = {};
  const entries = Object.entries(dates);

  for (const [key, value] of entries) {
    if (!isValidDate(value)) problems[key] = "Enter a valid date.";
  }
  if (Object.keys(problems).length > 0) return problems;

  const effective = dates.expiryDate ?? dates.bestBeforeDate ?? null;
  if (effective && effective < receivedAt.slice(0, 10)) {
    problems.expiryDate = "Expiry cannot fall before the receiving date.";
  }
  if (dates.expiryDate && dates.bestBeforeDate && dates.expiryDate < dates.bestBeforeDate) {
    problems.expiryDate = "Expiry must not fall before the best-before date.";
  }
  if (dates.packDate && dates.roastDate && dates.packDate < dates.roastDate) {
    problems.packDate = "Packing cannot fall before the roasting date.";
  }

  return Object.keys(problems).length > 0 ? problems : null;
}

export async function createLot(input: {
  actor: Actor;
  code: string;
  productId: number;
  deliveryId?: number | null;
  receivedAt?: string;
  quantity: number;
  dates: LotDates;
  notes?: string | null;
}): Promise<MutationResult<{ lotId: number; code: string }>> {
  const code = input.code.trim().toUpperCase();
  if (!code) return fail("Lot code is required.", { code: "Lot code is required." });

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return fail("Quantity must be a whole number above zero.", {
      quantity: "Enter a whole number above zero.",
    });
  }

  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const dateProblems = validateLotDates(input.dates, receivedAt);
  if (dateProblems) return fail("The dates on this lot are not consistent.", dateProblems);

  const product = await db.query.products.findFirst({ where: eq(products.id, input.productId) });
  if (!product) return fail("That product does not exist.", { productId: "Choose a product." });

  const existing = await db.query.lots.findFirst({ where: eq(lots.code, code) });
  if (existing) return fail(`Lot code ${code} already exists.`, { code: "This lot code is already in use." });

  try {
    const created = await sqlite.transaction(() => {
      const inserted = db
        .insert(lots)
        .values({
          code,
          productId: input.productId,
          deliveryId: input.deliveryId ?? null,
          receivedAt,
          roastDate: input.dates.roastDate ?? null,
          packDate: input.dates.packDate ?? null,
          bestBeforeDate: input.dates.bestBeforeDate ?? null,
          expiryDate: input.dates.expiryDate ?? null,
          notes: input.notes ?? null,
          status: "ACTIVE",
        })
        .returning()
        .get();

      db.insert(movements)
        .values({
          lotId: inserted.id,
          productId: input.productId,
          type: "RECEIPT",
          quantity: input.quantity,
          reason: "Lot received",
          performedBy: input.actor.id,
        })
        .run();

      writeAudit(input.actor, "RECEIVE", "lot", code, null, {
        quantity: input.quantity,
        dates: input.dates,
      });

      return inserted;
    })();

    return { ok: true, data: { lotId: created.id, code }, message: `Lot ${code} received.` };
  } catch (error) {
    return fail(`Could not record lot ${code}: ${(error as Error).message}`);
  }
}

type IssueOptions = {
  actor: Actor;
  productId: number;
  quantity: number;
  lotId?: number | null;
  reason?: string | null;
  reference?: string | null;
};

export async function issueStock(input: IssueOptions): Promise<MutationResult<{ allocations: string[] }>> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return fail("Quantity must be a whole number above zero.", {
      quantity: "Enter a whole number above zero.",
    });
  }

  const product = await db.query.products.findFirst({ where: eq(products.id, input.productId) });
  if (!product) return fail("That product does not exist.");

  if (input.lotId) {
    const views = await buildLotViews();
    const view = views.find((entry) => entry.lot.id === input.lotId);

    if (!view) return fail("That lot does not exist.");
    if (view.isExpired) {
      return fail(
        `Lot ${view.lot.code} expired ${Math.abs(view.daysToExpiry)} day(s) ago and cannot be issued. Use a reversal or disposal instead.`,
      );
    }
    if (view.isQuarantined) {
      return fail(`Lot ${view.lot.code} is quarantined and cannot be issued.`);
    }
    if (view.available < input.quantity) {
      return fail(
        `Lot ${view.lot.code} only has ${view.available} available. Reduce the quantity or release from another lot.`,
      );
    }

    return commitMovements(input.actor, [
      {
        lotId: view.lot.id,
        productId: view.product.id,
        type: "ISSUE",
        quantity: input.quantity,
        reason: input.reason ?? null,
        reference: input.reference ?? null,
      },
    ], `Issued ${input.quantity} from lot ${view.lot.code}.`);
  }

  const { allocations, shortfall } = await allocateFefo(input.productId, input.quantity);

  if (allocations.length === 0) {
    const views = await buildLotViews({ productId: input.productId });
    const blocked = views.some((view) => view.isExpired || view.isQuarantined);
    return fail(
      blocked
        ? `No issuable stock for ${product.sku}. Every lot is expired or quarantined.`
        : `No issuable stock available for ${product.sku}.`,
    );
  }

  if (shortfall > 0) {
    return fail(
      `Only ${input.quantity - shortfall} of ${input.quantity} can be issued from valid lots. Expired and quarantined stock is excluded.`,
    );
  }

  const result = await commitMovements(
    input.actor,
    allocations.map((allocation) => ({
      lotId: allocation.lotId,
      productId: input.productId,
      type: "ISSUE" as MovementType,
      quantity: allocation.quantity,
      reason: input.reason ?? null,
      reference: input.reference ?? null,
    })),
    `Issued ${input.quantity} across ${allocations.length} lot(s) in FEFO order.`,
  );

  if (result.ok) {
    result.data = { allocations: allocations.map((allocation) => allocation.lotCode) };
  }
  return result;
}

type MovementInput = {
  lotId: number;
  productId: number;
  type: MovementType;
  quantity: number;
  reason?: string | null;
  reference?: string | null;
};

async function commitMovements(
  actor: Actor,
  inputs: MovementInput[],
  successMessage: string,
): Promise<MutationResult<{ allocations: string[] }>> {
  try {
    await sqlite.transaction(() => {
      for (const input of inputs) {
        db.insert(movements).values({
          lotId: input.lotId,
          productId: input.productId,
          type: input.type,
          quantity: input.quantity,
          reason: input.reason ?? null,
          reference: input.reference ?? null,
          performedBy: actor.id,
        }).run();
      }
      writeAudit(actor, inputs[0]?.type ?? "MOVEMENT", "movement", String(inputs.length), null, inputs);
    })();

    return { ok: true, data: { allocations: [] }, message: successMessage };
  } catch (error) {
    return fail(`Could not save the movement: ${(error as Error).message}`);
  }
}

type LotAdjustmentOptions = {
  actor: Actor;
  lotId: number;
  quantity: number;
  reason: string;
  reference?: string | null;
  type: MovementType;
  successVerb: string;
};

export async function adjustLotStock(input: LotAdjustmentOptions): Promise<MutationResult> {
  const view = (await buildLotViews()).find((entry) => entry.lot.id === input.lotId);
  if (!view) return fail("That lot does not exist.");

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return fail("Quantity must be a whole number above zero.", {
      quantity: "Enter a whole number above zero.",
    });
  }

  const consumes = input.type === "DAMAGE" || input.type === "DISPOSE";
  if (consumes && input.quantity > view.onHand) {
    return fail(
      `Lot ${view.lot.code} only holds ${view.onHand} unit(s); you cannot ${input.successVerb.toLowerCase()} ${input.quantity}.`,
    );
  }

  if (input.type === "RESERVE" && input.quantity > view.available) {
    return fail(`Lot ${view.lot.code} only has ${view.available} available to reserve.`);
  }

  if ((input.type === "RELEASE" || input.type === "CANCEL") && input.quantity > view.reserved) {
    return fail(`Lot ${view.lot.code} only has ${view.reserved} unit(s) reserved.`);
  }

  if (input.type === "RESERVE" && (view.isExpired || view.isQuarantined)) {
    return fail(`Lot ${view.lot.code} is not issuable and cannot be reserved.`);
  }

  const result = await commitMovements(
    input.actor,
    [
      {
        lotId: view.lot.id,
        productId: view.product.id,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        reference: input.reference ?? null,
      },
    ],
    `${input.successVerb} ${input.quantity} unit(s) on lot ${view.lot.code}.`,
  );

  if (result.ok) {
    return { ok: true, message: result.message };
  }
  return result;
}

export async function quarantineLot(
  actor: Actor,
  lotId: number,
  reason: string,
): Promise<MutationResult> {
  if (!reason.trim()) return fail("A reason is required before quarantining a lot.", { reason: "Give a reason." });

  const lot = await db.query.lots.findFirst({ where: eq(lots.id, lotId) });
  if (!lot) return fail("That lot does not exist.");
  if (lot.status === "QUARANTINE") return fail("That lot is already quarantined.");

  try {
    await sqlite.transaction(() => {
      db.update(lots)
        .set({ status: "QUARANTINE", quarantineReason: reason.trim() })
        .where(eq(lots.id, lotId))
        .run();
      writeAudit(actor, "QUARANTINE", "lot", lot.code, { status: lot.status }, {
        status: "QUARANTINE",
        reason,
      });
    })();
    return { ok: true, message: `Lot ${lot.code} quarantined.` };
  } catch (error) {
    return fail(`Could not quarantine the lot: ${(error as Error).message}`);
  }
}

export async function releaseQuarantine(actor: Actor, lotId: number): Promise<MutationResult> {
  const lot = await db.query.lots.findFirst({ where: eq(lots.id, lotId) });
  if (!lot) return fail("That lot does not exist.");
  if (lot.status !== "QUARANTINE") return fail("That lot is not quarantined.");

  try {
    await sqlite.transaction(() => {
      db.update(lots)
        .set({ status: "ACTIVE", quarantineReason: null })
        .where(eq(lots.id, lotId))
        .run();
      writeAudit(actor, "UNQUARANTINE", "lot", lot.code, { status: lot.status }, { status: "ACTIVE" });
    })();
    return { ok: true, message: `Lot ${lot.code} released back to available stock.` };
  } catch (error) {
    return fail(`Could not release the lot: ${(error as Error).message}`);
  }
}

export async function reverseMovement(
  actor: Actor,
  movementId: number,
  reason: string,
): Promise<MutationResult> {
  if (!reason.trim()) return fail("Give a reason for the reversal.", { reason: "A reason is required." });

  const original = await db.query.movements.findFirst({ where: eq(movements.id, movementId) });
  if (!original) return fail("That movement does not exist.");

  const alreadyReversed = await db.query.movements.findFirst({
    where: and(eq(movements.reversesId, movementId)),
  });
  if (alreadyReversed) return fail("That movement has already been reversed.");

  try {
    await sqlite.transaction(() => {
      db.insert(movements)
        .values({
          lotId: original.lotId,
          productId: original.productId,
          type: "ADJUSTMENT",
          quantity: -original.quantity,
          reason: `Reversal of movement #${movementId}: ${reason.trim()}`,
          reversesId: movementId,
          performedBy: actor.id,
        })
        .run();
      writeAudit(actor, "REVERSE", "movement", String(movementId), original, { reason });
    })();
    return { ok: true, message: `Movement #${movementId} reversed.` };
  } catch (error) {
    return fail(`Could not reverse the movement: ${(error as Error).message}`);
  }
}

export async function balancesFor(lot: Lot) {
  const map = await balancesForLots([lot.id]);
  return map.get(lot.id) ?? { onHand: 0, reserved: 0 };
}

export { and, eq, sql };