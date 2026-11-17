CREATE TABLE `guide_progress` (
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`step_key` text NOT NULL,
	`done_at` text,
	`dismissed` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`project_id`, `user_id`, `step_key`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "guide_progress_dismissed_check" CHECK("guide_progress"."dismissed" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `guide_progress_organization_project_user_idx` ON `guide_progress` (`organization_id`,`project_id`,`user_id`);