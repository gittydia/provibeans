import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { lots, movements, products } from "@/lib/db/schema";
import type { MovementType } from "@/lib/db/schema";
import { canViewReports, getCurrentUser } from "@/lib/auth/session";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canViewReports(user.role)) {
    return new Response("Not permitted", { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conditions: SQL[] = [];
  if (type) conditions.push(eq(movements.type, type as MovementType));
  if (from) conditions.push(gte(movements.createdAt, new Date(from).toISOString()));
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(movements.createdAt, end.toISOString()));
  }

  const rows = await db
    .select({
      id: movements.id,
      createdAt: movements.createdAt,
      type: movements.type,
      quantity: movements.quantity,
      reason: movements.reason,
      reference: movements.reference,
      reversesId: movements.reversesId,
      lotCode: lots.code,
      sku: products.sku,
    })
    .from(movements)
    .innerJoin(lots, eq(movements.lotId, lots.id))
    .innerJoin(products, eq(movements.productId, products.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(movements.createdAt, movements.id);

  const header = [
    "id",
    "timestamp",
    "type",
    "lot",
    "sku",
    "quantity",
    "reason",
    "reference",
    "reverses_id",
  ];

  const body = rows.map((row) =>
    [
      row.id,
      row.createdAt,
      row.type,
      row.lotCode,
      row.sku,
      row.quantity,
      row.reason ?? "",
      row.reference ?? "",
      row.reversesId ?? "",
    ]
      .map(csvCell)
      .join(","),
  );

  return new Response([header.join(","), ...body].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="provi-beans-movements.csv"`,
      "Cache-Control": "no-store",
    },
  });
}