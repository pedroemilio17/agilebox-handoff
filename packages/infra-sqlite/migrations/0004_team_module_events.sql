CREATE TABLE `team_module_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`module_id` text NOT NULL,
	`from_state` text NOT NULL,
	`to_state` text NOT NULL,
	`changed_by` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_module_events_org_at_index` ON `team_module_events` (`organization_id`,`changed_at`);