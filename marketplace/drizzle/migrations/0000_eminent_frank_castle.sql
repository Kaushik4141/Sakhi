CREATE TABLE `artisans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`bio` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artisans_slug_unique` ON `artisans` (`slug`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`artisan_id` integer NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`description` text,
	`image_url` text,
	`is_gi_verified` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`artisan_id`) REFERENCES `artisans`(`id`) ON UPDATE no action ON DELETE cascade
);
