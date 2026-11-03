CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`initials` text NOT NULL,
	`role` text NOT NULL,
	`default_rate_cents` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "organization_id", "name", "email", "initials", "role", "default_rate_cents", "created_at") SELECT "id", "organization_id", "name", "email", "initials", "role", "default_rate_cents", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_organization_email_unique` ON `users` (`organization_id`,`email`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `default_rate_cents` integer DEFAULT 4500 NOT NULL;