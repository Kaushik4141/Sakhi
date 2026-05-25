DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`address` text,
	`city` text,
	`state` text,
	`pincode` text
);

CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
