ALTER TABLE `artisans` ADD `language` text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE `artisans` ADD `theme` text DEFAULT 'terracotta';--> statement-breakpoint
ALTER TABLE `products` ADD `is_gi_certified` integer DEFAULT false;