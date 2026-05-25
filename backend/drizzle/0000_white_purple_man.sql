CREATE TABLE `artisans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`shop_slug` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`artisan_id` text NOT NULL,
	`name` text NOT NULL,
	`price_inr` integer NOT NULL,
	`stock` integer NOT NULL,
	`image_url` text NOT NULL,
	FOREIGN KEY (`artisan_id`) REFERENCES `artisans`(`id`) ON UPDATE no action ON DELETE no action
);
