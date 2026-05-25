ALTER TABLE `products` ADD `title_original` text NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `title_en` text NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `description_seo` text;--> statement-breakpoint
ALTER TABLE `products` ADD `is_live` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `products` ADD `created_at` text DEFAULT CURRENT_TIMESTAMP;