import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cartItems, carts, products } from "@/lib/db/schema";
import type { Product } from "@/lib/db/schema";
import { shouldUseSecureCookie } from "@/lib/auth/session";
import { productSummaries } from "@/lib/inventory/ledger";

const CART_COOKIE = "provi_cart";
const MAX_PER_LINE = 500;

async function currentCartId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.token, token))
    .limit(1);

  return rows[0]?.id ?? null;
}

async function ensureCart(): Promise<number> {
  const existing = await currentCartId();
  if (existing) return existing;

  const token = randomBytes(24).toString("hex");
  const created = await db.insert(carts).values({ token }).returning({ id: carts.id });

  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await shouldUseSecureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return created[0].id;
}

export function slugForProduct(product: Pick<Product, "sku">): string {
  return product.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function addToCart(productId: number, quantity: number): Promise<{ ok: boolean; message: string }> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: "Choose a quantity of at least 1." };
  }

  const product = await db.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product || !product.isActive) return { ok: false, message: "That coffee is not available." };

  const cartId = await ensureCart();
  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
    .limit(1);

  const next = Math.min(MAX_PER_LINE, (existing[0]?.quantity ?? 0) + quantity);

  if (existing[0]) {
    await db
      .update(cartItems)
      .set({ quantity: next })
      .where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({ cartId, productId, quantity: next });
  }

  await db.update(carts).set({ updatedAt: new Date().toISOString() }).where(eq(carts.id, cartId));

  return {
    ok: true,
    message: `${product.sku} — ${next} bag${next === 1 ? "" : "s"} in your cart.`,
  };
}

export async function setCartQuantity(
  productId: number,
  quantity: number,
): Promise<{ ok: boolean; message: string }> {
  const cartId = await currentCartId();
  if (!cartId) return { ok: true, message: "Cart updated." };

  if (quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
    return { ok: true, message: "Item removed." };
  }

  await db
    .update(cartItems)
    .set({ quantity: Math.min(MAX_PER_LINE, quantity) })
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));

  return { ok: true, message: "Cart updated." };
}

export async function removeFromCart(productId: number): Promise<void> {
  const cartId = await currentCartId();
  if (!cartId) return;
  await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
}

export type CartLine = {
  product: Product;
  quantity: number;
  lineTotal: number;
  available: number;
  exceedsAvailable: boolean;
};

export type CartView = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  hasUnavailable: boolean;
};

export async function getCart(): Promise<CartView> {
  const cartId = await currentCartId();
  if (!cartId) return { lines: [], itemCount: 0, subtotal: 0, hasUnavailable: false };

  const rows = await db
    .select({ item: cartItems, product: products })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(products.sku);

  if (rows.length === 0) return { lines: [], itemCount: 0, subtotal: 0, hasUnavailable: false };

  const summaries = await productSummaries();

  const lines: CartLine[] = rows.map(({ item, product }) => {
    const available = summaries.find((entry) => entry.product.id === product.id)?.available ?? 0;
    return {
      product,
      quantity: item.quantity,
      lineTotal: item.quantity * product.unitPrice,
      available,
      exceedsAvailable: item.quantity > available,
    };
  });

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    hasUnavailable: lines.some((line) => line.exceedsAvailable),
  };
}

export async function cartItemCount(): Promise<number> {
  const cartId = await currentCartId();
  if (!cartId) return 0;
  const row = await db
    .select({ total: sql<number>`coalesce(sum(quantity), 0)` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return row[0]?.total ?? 0;
}

export async function clearCart(): Promise<void> {
  const cartId = await currentCartId();
  if (!cartId) return;
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

export async function cartLinesForCheckout(): Promise<{ productId: number; quantity: number }[]> {
  const cartId = await currentCartId();
  if (!cartId) return [];
  const rows = await db
    .select({ productId: cartItems.productId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return rows.map((row) => ({ productId: row.productId, quantity: row.quantity }));
}

export async function findProductBySlug(slug: string) {
  const normalised = slug.trim().toLowerCase();
  const rows = await db.select().from(products).where(eq(products.isActive, true));
  return rows.find((product) => slugForProduct(product) === normalised) ?? null;
}

export async function listActiveProducts() {
  return db.select().from(products).where(eq(products.isActive, true)).orderBy(products.sku);
}

export { inArray };