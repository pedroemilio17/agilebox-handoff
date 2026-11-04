CREATE TABLE `daily_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`progress` text DEFAULT '' NOT NULL,
	`next_step` text DEFAULT '' NOT NULL,
	`blocker` text DEFAULT '' NOT NULL,
	`no_news` integer DEFAULT false NOT NULL,
	`task_refs` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "daily_entries_answers_check" CHECK(length("daily_entries"."progress") <= 500 AND length("daily_entries"."next_step") <= 500 AND length("daily_entries"."blocker") <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_entries_org_user_date_unique` ON `daily_entries` (`organization_id`,`user_id`,`date`);