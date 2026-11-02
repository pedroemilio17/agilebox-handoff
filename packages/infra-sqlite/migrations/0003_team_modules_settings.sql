CREATE TABLE `team_modules` (
	`organization_id` text NOT NULL,
	`module_id` text NOT NULL,
	`state` text NOT NULL,
	`config` text NOT NULL,
	`changed_by` text NOT NULL,
	`changed_at` text NOT NULL,
	PRIMARY KEY(`organization_id`, `module_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_settings` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`changed_by` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
