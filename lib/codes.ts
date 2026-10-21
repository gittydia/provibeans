/**
 * Human-readable code suggestions for the create forms.
 *
 * These only *propose* values: the operator can overwrite any suggestion, and
 * `createProduct` / `createLot` still enforce uniqueness, so a suggestion is
 * never a way around validation.
 */

const SKU_PREFIX = "PB";

/** `2026-01-15` or a full ISO timestamp -> `2601`. Falls back to today's month. */
export function monthStamp(receivedAt: string, now: Date = new Date()): string {
  const match = /^(\d{4})-(\d{2})/.exec(receivedAt.trim());
  if (match) return `${match[1].slice(2)}${match[2]}`;
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${String(now.getFullYear()).slice(2)}${month}`;
}

/**
 * Suggested SKU: `PB-<first three letters of the name>-<weight>`.
 * `SAIGON 500g` at 500 g -> `PB-SAI-500`. Appends `-2`, `-3`, ... on collision.
 * Returns an empty string when the name has no letters yet.
 */
export function suggestSku(name: string, weightGrams: number, taken: readonly string[]): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters) return "";
  const grams = Number.isFinite(weightGrams) && weightGrams > 0 ? Math.trunc(weightGrams) : 250;
  const base = `${SKU_PREFIX}-${letters.slice(0, 3)}-${grams}`;
  const used = new Set(taken.map((sku) => sku.trim().toUpperCase()));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** `PB-HN-250` -> `HN`. Falls back to the first three letters of the product name. */
export function codePrefix(sku: string, name: string): string {
  const segment = sku.split("-")[1]?.toUpperCase() ?? "";
  if (/^[A-Z]{2,4}$/.test(segment)) return segment;
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  return letters.slice(0, 3) || "LOT";
}

/**
 * Next free lot code for one product in one month.
 * Existing `HN-2601-A` and `HN-2601-B` produce `HN-2601-C`; suffixes such as
 * `HUE-2603-DMG` are ignored when looking for the highest letter.
 */
export function nextBatchCode(
  prefix: string,
  receivedAt: string,
  productId: number,
  batches: readonly { code: string; productId: number }[],
  now: Date = new Date(),
): string {
  const stem = `${prefix}-${monthStamp(receivedAt, now)}-`;
  let highest = 0;
  for (const batch of batches) {
    if (batch.productId !== productId) continue;
    const code = batch.code.trim().toUpperCase();
    if (!code.startsWith(stem)) continue;
    const tail = code.slice(stem.length);
    if (!/^[A-Z]$/.test(tail)) continue;
    highest = Math.max(highest, tail.charCodeAt(0) - 64);
  }
  return `${stem}${String.fromCharCode(65 + highest)}`;
}
