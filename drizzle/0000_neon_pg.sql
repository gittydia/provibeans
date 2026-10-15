CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'WARNING' NOT NULL,
	"product_id" integer,
	"lot_id" integer,
	"message" text NOT NULL,
	"resolved_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" text,
	"after" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "cart_items_quantity_positive" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"reference" text,
	"received_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"notes" text,
	"recorded_by" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"product_id" integer NOT NULL,
	"delivery_id" integer,
	"received_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"roast_date" text,
	"pack_date" text,
	"best_before_date" text,
	"expiry_date" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"quarantine_reason" text,
	"notes" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "lots_dates_ordered" CHECK (("lots"."expiry_date" IS NULL OR "lots"."best_before_date" IS NULL OR "lots"."expiry_date" >= "lots"."best_before_date")),
	CONSTRAINT "lots_expiry_after_received" CHECK (("lots"."expiry_date" IS NULL OR ("lots"."expiry_date")::date >= ("lots"."received_at")::date))
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"reference" text,
	"reverses_id" integer,
	"performed_by" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "movements_quantity_nonzero" CHECK ("stock_movements"."quantity" <> 0)
);
--> statement-breakpoint
CREATE TABLE "order_request_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_request_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity_requested" integer NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'RESERVED' NOT NULL,
	"note" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "order_lines_requested_positive" CHECK ("order_request_lines"."quantity_requested" > 0),
	CONSTRAINT "order_lines_reserved_not_negative" CHECK ("order_request_lines"."quantity_reserved" >= 0 and "order_request_lines"."quantity_reserved" <= "order_request_lines"."quantity_requested")
);
--> statement-breakpoint
CREATE TABLE "order_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"customer_name" text NOT NULL,
	"business" text,
	"email" text NOT NULL,
	"phone" text,
	"notes" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"handled_by" integer,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_request_line_id" integer NOT NULL,
	"lot_id" integer NOT NULL,
	"movement_id" integer,
	"quantity" integer NOT NULL,
	"released_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "order_reservations_positive" CHECK ("order_reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"origin_country" text DEFAULT 'Vietnam' NOT NULL,
	"origin_region" text,
	"species" text,
	"process" text,
	"roast_level" text,
	"weight_grams" integer NOT NULL,
	"unit_price" real NOT NULL,
	"low_stock_level" integer DEFAULT 10 NOT NULL,
	"reorder_point" integer DEFAULT 20 NOT NULL,
	"near_expiry_days" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "products_weight_positive" CHECK ("products"."weight_grams" > 0),
	CONSTRAINT "products_price_non_negative" CHECK ("products"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"country" text DEFAULT 'Vietnam' NOT NULL,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'INVENTORY_STAFF' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_request_lines" ADD CONSTRAINT "order_request_lines_order_request_id_order_requests_id_fk" FOREIGN KEY ("order_request_id") REFERENCES "public"."order_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_request_lines" ADD CONSTRAINT "order_request_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reservations" ADD CONSTRAINT "order_reservations_order_request_line_id_order_request_lines_id_fk" FOREIGN KEY ("order_request_line_id") REFERENCES "public"."order_request_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reservations" ADD CONSTRAINT "order_reservations_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reservations" ADD CONSTRAINT "order_reservations_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_type_idx" ON "alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "alerts_resolved_idx" ON "alerts" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_unique" ON "cart_items" USING btree ("cart_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_token_unique" ON "carts" USING btree ("token");--> statement-breakpoint
CREATE INDEX "deliveries_supplier_idx" ON "deliveries" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_reference_unique" ON "deliveries" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "lots_code_unique" ON "lots" USING btree ("code");--> statement-breakpoint
CREATE INDEX "lots_product_idx" ON "lots" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "movements_lot_idx" ON "stock_movements" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "movements_product_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "movements_type_idx" ON "stock_movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "movements_created_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_lines_request_idx" ON "order_request_lines" USING btree ("order_request_id");--> statement-breakpoint
CREATE INDEX "order_lines_product_idx" ON "order_request_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_requests_reference_unique" ON "order_requests" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "order_requests_status_idx" ON "order_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_reservations_line_idx" ON "order_reservations" USING btree ("order_request_line_id");--> statement-breakpoint
CREATE INDEX "order_reservations_lot_idx" ON "order_reservations" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_unique" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_name_unique" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");