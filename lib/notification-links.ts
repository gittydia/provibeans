import type { MockState, NotificationItem } from "./mock-store";

/**
 * Where a notification takes you when it is clicked.
 *
 * A notification names an entity, and every screen here is a list, so the
 * destination is the list that owns that entity plus a `focus` key the list can
 * scroll to and highlight. No detail route is invented: this demo has none, and
 * a notification that opened one would be a new screen rather than a link.
 */
export type NotificationTarget = {
  href: string;
  label: string;
};

/* The batch code and SKU shapes as they are written in alert text. Text is the
   fallback because the near-expiry push stores a synthetic entity id -- it is
   deliberately re-raisable across reloads -- so its message naming
   "Batch HN-2602-B" is the only thing left that identifies the batch. */
const BATCH_CODE = /\b[A-Z]{2,4}-\d{4}-[A-Z]{1,3}\b/;
const SKU = /\bPB-[A-Z]{2,4}-\d{3}\b/;

/* An entity id is either the record's id as a string or, for a notification
   written by hand, the code itself. */
function batchCodeFor(item: NotificationItem, state: MockState): string | null {
  const batch = state.batches.find(
    (candidate) => String(candidate.id) === item.entityId || candidate.code === item.entityId,
  );
  return batch?.code ?? item.message.match(BATCH_CODE)?.[0] ?? null;
}

function skuFor(item: NotificationItem, state: MockState): string | null {
  const product = state.products.find(
    (candidate) => String(candidate.id) === item.entityId || candidate.sku === item.entityId,
  );
  return product?.sku ?? item.message.match(SKU)?.[0] ?? null;
}

export function notificationTarget(item: NotificationItem, state: MockState): NotificationTarget | null {
  if (item.entityType === "batch") {
    const code = batchCodeFor(item, state);
    return code ? { href: `/batches?focus=${encodeURIComponent(code)}`, label: `Batch ${code}` } : null;
  }

  if (item.entityType === "product") {
    const sku = skuFor(item, state);
    return sku ? { href: `/catalog?focus=${encodeURIComponent(sku)}`, label: sku } : null;
  }

  /* A notification with no entity still came from a screen that computes it. */
  switch (item.type) {
    case "EXPIRED":
    case "NEAR_EXPIRY":
      return { href: "/batches", label: "All batches" };
    case "QUARANTINE":
      return { href: "/batches/quarantine", label: "Quarantine" };
    case "LOW_STOCK":
      return { href: "/catalog", label: "Products" };
    default:
      return null;
  }
}
