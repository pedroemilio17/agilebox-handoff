CREATE TABLE `task_acceptance_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`task_id` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_acceptance_criteria_text_check" CHECK(length("task_acceptance_criteria"."text") BETWEEN 1 AND 200),
	CONSTRAINT "task_acceptance_criteria_position_check" CHECK("task_acceptance_criteria"."position" >= 0)
);
--> statement-breakpoint
CREATE INDEX `task_acceptance_criteria_task_position_index` ON `task_acceptance_criteria` (`task_id`,`position`);--> statement-breakpoint
CREATE INDEX `task_acceptance_criteria_organization_task_index` ON `task_acceptance_criteria` (`organization_id`,`task_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimated_hours_hundredths` integer;