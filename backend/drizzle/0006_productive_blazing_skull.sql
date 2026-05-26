CREATE TABLE `market_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`artisan_id` text NOT NULL,
	`raw_tavily_data` text NOT NULL,
	`structured_json` text NOT NULL,
	`kannada_digest` text NOT NULL,
	`roadmap_kannada` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `created_at` text DEFAULT CURRENT_TIMESTAMP;