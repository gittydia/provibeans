CREATE TABLE `enquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`business` text,
	`email` text NOT NULL,
	`phone` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'NEW' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `enquiries_status_idx` ON `enquiries` (`status`);--> statement-breakpoint
CREATE TABLE `order_request_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_request_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity_requested` integer NOT NULL,
	`quantity_reserved` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'RESERVED' NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`order_request_id`) REFERENCES `order_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_lines_requested_positive" CHECK("order_request_lines"."quantity_requested" > 0),
	CONSTRAINT "order_lines_reserved_not_negative" CHECK("order_request_lines"."quantity_reserved" >= 0 and "order_request_lines"."quantity_reserved" <= "order_request_lines"."quantity_requested")
);
--> statement-breakpoint
CREATE INDEX `order_lines_request_idx` ON `order_request_lines` (`order_request_id`);--> statement-breakpoint
CREATE INDEX `order_lines_product_idx` ON `order_request_lines` (`product_id`);--> statement-breakpoint
CREATE TABLE `order_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`customer_name` text NOT NULL,
	`business` text,
	`email` text NOT NULL,
	`phone` text,
	`notes` text,
	`status` text DEFAULT 'NEW' NOT NULL,
	`handled_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_requests_reference_unique` ON `order_requests` (`reference`);--> statement-breakpoint
CREATE INDEX `order_requests_status_idx` ON `order_requests` (`status`);--> statement-breakpoint
CREATE TABLE `order_reservations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_request_line_id` integer NOT NULL,
	`lot_id` integer NOT NULL,
	`movement_id` integer,
	`quantity` integer NOT NULL,
	`released_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`order_request_line_id`) REFERENCES `order_request_lines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`movement_id`) REFERENCES `stock_movements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_reservations_positive" CHECK("order_reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `order_reservations_line_idx` ON `order_reservations` (`order_request_line_id`);--> statement-breakpoint
CREATE INDEX `order_reservations_lot_idx` ON `order_reservations` (`lot_id`);