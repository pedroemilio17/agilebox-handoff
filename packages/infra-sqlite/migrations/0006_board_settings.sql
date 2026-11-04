CREATE TABLE `board_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`wip_limits` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "board_settings_wip_limits_json_check" CHECK(json_valid("board_settings"."wip_limits"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `board_settings_organization_id_unique` ON `board_settings` (`organization_id`);