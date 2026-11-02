CREATE TABLE `task_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`task_id` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_criteria_task_position_unique` ON `task_criteria` (`task_id`,`position`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `backlog_rank` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `on_board` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimated_hours` integer;