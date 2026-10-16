import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Timestamps are stored as ISO-8601 UTC text rather than `timestamptz`, so that
 * lexicographic ordering matches chronological ordering and values round-trip
 * identically to JavaScript's `toISOString()`. Casting through `to_char` keeps the
 * server default in exactly that format; a plain `now()::text` would not.
 */
const now = sql`to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const NOTIFICATION_TYPES = [
  "LOW_STOCK",
  "REORDER",
  "NEAR_EXPIRY",
  "EXPIRED",
  "QUARANTINE",
  "COUNT_VARIANCE",
  "ORDER_RECEIVED",
  "ORDER_CONFIRMED",
  "ORDER_FULFILLED",
  "ORDER_CANCELLED",
] as const;

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["ADMIN", "INVENTORY_STAFF", "OWNER"] })
      .notNull()
      .default("INVENTORY_STAFF"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(now),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    country: text("country").notNull().default("Vietnam"),
    address: text("address"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [uniqueIndex("suppliers_name_unique").on(table.name)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    originCountry: text("origin_country").notNull().default("Vietnam"),
    originRegion: text("origin_region"),
    species: text("species"),
    process: text("process"),
    roastLevel: text("roast_level"),
    weightGrams: integer("weight_grams").notNull(),
    unitPrice: real("unit_price").notNull(),
    lowStockLevel: integer("low_stock_level").notNull().default(10),
    reorderPoint: integer("reorder_point").notNull().default(20),
    nearExpiryDays: integer("near_expiry_days").notNull().default(30),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("products_sku_unique").on(table.sku),
    check("products_weight_positive", sql`${table.weightGrams} > 0`),
    check("products_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    reference: text("reference"),
    receivedAt: text("received_at").notNull().default(now),
    notes: text("notes"),
    recordedBy: integer("recorded_by").references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("deliveries_supplier_idx").on(table.supplierId),
    uniqueIndex("deliveries_reference_unique").on(table.reference),
  ],
);

export const lots = pgTable(
  "lots",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    deliveryId: integer("delivery_id").references(() => deliveries.id),
    receivedAt: text("received_at").notNull().default(now),
    roastDate: text("roast_date"),
    packDate: text("pack_date"),
    bestBeforeDate: text("best_before_date"),
    expiryDate: text("expiry_date"),
    status: text("status", {
      enum: ["ACTIVE", "QUARANTINE", "DEPLETED", "DISPOSED"],
    })
      .notNull()
      .default("ACTIVE"),
    quarantineReason: text("quarantine_reason"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("lots_code_unique").on(table.code),
    index("lots_product_idx").on(table.productId),
    check(
      "lots_dates_ordered",
      sql`(${table.expiryDate} IS NULL OR ${table.bestBeforeDate} IS NULL OR ${table.expiryDate} >= ${table.bestBeforeDate})`,
    ),
    check(
      "lots_expiry_after_received",
      sql`(${table.expiryDate} IS NULL OR (${table.expiryDate})::date >= (${table.receivedAt})::date)`,
    ),
  ],
);

export const movements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    type: text("type", {
      enum: [
        "RECEIPT",
        "ISSUE",
        "RESERVE",
        "RELEASE",
        "CANCEL",
        "RETURN",
        "DAMAGE",
        "QUARANTINE",
        "UNQUARANTINE",
        "DISPOSE",
        "ADJUSTMENT",
        "COUNT",
      ],
    }).notNull(),
    quantity: integer("quantity").notNull(),
    reason: text("reason"),
    reference: text("reference"),
    reversesId: integer("reverses_id"),
    performedBy: integer("performed_by").references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("movements_lot_idx").on(table.lotId),
    index("movements_product_idx").on(table.productId),
    index("movements_type_idx").on(table.type),
    index("movements_created_idx").on(table.createdAt),
    check("movements_quantity_nonzero", sql`${table.quantity} <> 0`),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    type: text("type", {
      enum: [
        "LOW_STOCK",
        "REORDER",
        "NEAR_EXPIRY",
        "EXPIRED",
        "QUARANTINE",
        "COUNT_VARIANCE",
      ],
    }).notNull(),
    severity: text("severity", { enum: ["INFO", "WARNING", "CRITICAL"] })
      .notNull()
      .default("WARNING"),
    productId: integer("product_id").references(() => products.id),
    lotId: integer("lot_id").references(() => lots.id),
    message: text("message").notNull(),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("alerts_type_idx").on(table.type),
    index("alerts_resolved_idx").on(table.resolvedAt),
    // Makes "at most one open alert per (type, product, lot)" a database rule
    // rather than a read-then-insert assumption, which is what lets notification
    // fan-out key off the alert id. The COALESCE key MUST stay in sync with the
    // `identity()` helper in lib/inventory/alerts.ts.
    uniqueIndex("alerts_open_unique")
      .on(
        sql`${table.type}`,
        sql`coalesce(${table.productId}, 0)`,
        sql`coalesce(${table.lotId}, 0)`,
      )
      .where(sql`${table.resolvedAt} is null`),
  ],
);

/**
 * Per-recipient inbox entries, kept separate from `alerts` because an alert is
 * global derived state that resolves itself, while a notification is immutable
 * history owned by one person and must outlive the alert it came from. The
 * display text is copied rather than joined back for that reason.
 *
 * `dedupeKey` is the idempotency anchor: `alert:<id>` for alert-backed entries,
 * `order:<id>:<status>` for order lifecycle. It is stable for as long as the
 * condition is open and changes when the condition recurs, so a repeated
 * evaluation cannot duplicate an entry but a genuine recurrence still notifies.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    severity: text("severity", { enum: ["INFO", "WARNING", "CRITICAL"] })
      .notNull()
      .default("INFO"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    entityType: text("entity_type", {
      enum: ["alert", "order_request", "lot", "product"],
    }),
    entityId: text("entity_id"),
    // Source links are nullable and null out if the source is deleted, so losing
    // the link never deletes inbox history.
    alertId: integer("alert_id").references(() => alerts.id, {
      onDelete: "set null",
    }),
    orderRequestId: integer("order_request_id").references(
      () => orderRequests.id,
      { onDelete: "set null" },
    ),
    dedupeKey: text("dedupe_key").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("notifications_user_dedupe_idx").on(table.userId, table.dedupeKey),
    // id is the tiebreaker because created_at is millisecond text and two
    // notifications for one recipient can land in the same millisecond.
    index("notifications_user_recent_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("notifications_user_unread_idx")
      .on(table.userId)
      .where(sql`${table.readAt} is null`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: text("before"),
    after: text("after"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("audit_created_idx").on(table.createdAt),
    index("audit_entity_idx").on(table.entity),
  ],
);

export const carts = pgTable(
  "carts",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [uniqueIndex("carts_token_unique").on(table.token)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    cartId: integer("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("cart_items_unique").on(table.cartId, table.productId),
    check("cart_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const orderRequests = pgTable(
  "order_requests",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull(),
    customerName: text("customer_name").notNull(),
    business: text("business"),
    email: text("email").notNull(),
    phone: text("phone"),
    notes: text("notes"),
    status: text("status", { enum: ["NEW", "CONFIRMED", "FULFILLED", "CANCELLED"] })
      .notNull()
      .default("NEW"),
    handledBy: integer("handled_by").references(() => users.id),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (table) => [
    uniqueIndex("order_requests_reference_unique").on(table.reference),
    index("order_requests_status_idx").on(table.status),
  ],
);

export const orderRequestLines = pgTable(
  "order_request_lines",
  {
    id: serial("id").primaryKey(),
    orderRequestId: integer("order_request_id")
      .notNull()
      .references(() => orderRequests.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantityRequested: integer("quantity_requested").notNull(),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    status: text("status", { enum: ["RESERVED", "PARTIAL", "SHORT", "CANCELLED"] })
      .notNull()
      .default("RESERVED"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("order_lines_request_idx").on(table.orderRequestId),
    index("order_lines_product_idx").on(table.productId),
    check("order_lines_requested_positive", sql`${table.quantityRequested} > 0`),
    check(
      "order_lines_reserved_not_negative",
      sql`${table.quantityReserved} >= 0 and ${table.quantityReserved} <= ${table.quantityRequested}`,
    ),
  ],
);

export const orderReservations = pgTable(
  "order_reservations",
  {
    id: serial("id").primaryKey(),
    orderRequestLineId: integer("order_request_line_id")
      .notNull()
      .references(() => orderRequestLines.id, { onDelete: "cascade" }),
    lotId: integer("lot_id")
      .notNull()
      .references(() => lots.id),
    movementId: integer("movement_id").references(() => movements.id),
    quantity: integer("quantity").notNull(),
    releasedAt: text("released_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (table) => [
    index("order_reservations_line_idx").on(table.orderRequestLineId),
    index("order_reservations_lot_idx").on(table.lotId),
    check("order_reservations_positive", sql`${table.quantity} > 0`),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  movements: many(movements),
  notifications: many(notifications),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  deliveries: many(deliveries),
}));

export const productsRelations = relations(products, ({ many }) => ({
  lots: many(lots),
  movements: many(movements),
  alerts: many(alerts),
}));

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [deliveries.supplierId],
    references: [suppliers.id],
  }),
  lots: many(lots),
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  product: one(products, { fields: [lots.productId], references: [products.id] }),
  delivery: one(deliveries, {
    fields: [lots.deliveryId],
    references: [deliveries.id],
  }),
  movements: many(movements),
  alerts: many(alerts),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  lot: one(lots, { fields: [movements.lotId], references: [lots.id] }),
  product: one(products, { fields: [movements.productId], references: [products.id] }),
  user: one(users, { fields: [movements.performedBy], references: [users.id] }),
}));

type MovementRow = typeof movements.$inferSelect;
type UserRow = typeof users.$inferSelect;
type LotRow = typeof lots.$inferSelect;

export type User = UserRow;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Lot = LotRow;
export type Movement = MovementRow;
export type MovementType = MovementRow["type"];
export type Supplier = typeof suppliers.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Role = UserRow["role"];
export type LotStatus = LotRow["status"];
export type OrderRequest = typeof orderRequests.$inferSelect;
export type OrderRequestLine = typeof orderRequestLines.$inferSelect;
export type OrderRequestStatus = (typeof orderRequests.$inferSelect)["status"];
export type OrderLineStatus = (typeof orderRequestLines.$inferSelect)["status"];

export type Notification = typeof notifications.$inferSelect;
export type NotificationSeverity = Notification["severity"];
export type NotificationEntityType = NonNullable<Notification["entityType"]>;

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  RECEIPT: "Stock received",
  ISSUE: "Issued",
  RESERVE: "Reserved",
  RELEASE: "Reservation released",
  CANCEL: "Reservation cancelled",
  RETURN: "Returned",
  DAMAGE: "Damaged",
  QUARANTINE: "Quarantined",
  UNQUARANTINE: "Released from quarantine",
  DISPOSE: "Disposed",
  ADJUSTMENT: "Adjusted",
  COUNT: "Physical count",
};