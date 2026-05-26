ALTER TABLE `artisans` ADD `phone` text NOT NULL;--> statement-breakpoint
ALTER TABLE `artisans` ADD `uin_number` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `artisans_phone_unique` ON `artisans` (`phone`);