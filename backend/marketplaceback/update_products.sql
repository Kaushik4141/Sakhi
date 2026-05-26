DROP TABLE IF EXISTS `products`;

CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`artisan_id` integer NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`description` text,
	`image_url` text,
	`category` text DEFAULT 'All Crafts' NOT NULL,
	`is_gi_verified` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`artisan_id`) REFERENCES `artisans`(`id`) ON UPDATE no action ON DELETE cascade
);
