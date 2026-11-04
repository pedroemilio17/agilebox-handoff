CREATE TABLE `retro_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`title` text NOT NULL,
	`responsible_id` text,
	`due_date` text,
	`done` integer DEFAULT false NOT NULL,
	`done_at` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responsible_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "retro_actions_title_check" CHECK(length("retro_actions"."title") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE INDEX `retro_actions_meeting_occurrence_index` ON `retro_actions` (`meeting_id`,`occurrence_date`);