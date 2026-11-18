CREATE TABLE `baseline_tasks` (
	`organization_id` text NOT NULL,
	`baseline_id` text NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`starts_on` text,
	`ends_on` text,
	`estimated_hours_hundredths` integer,
	`planned_cost_cents` integer,
	PRIMARY KEY(`baseline_id`, `task_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`baseline_id`) REFERENCES `baselines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `baselines` (
	`organization_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`taken_at` text NOT NULL,
	`taken_by` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taken_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `baselines_organization_project_taken_at_index` ON `baselines` (`organization_id`,`project_id`,`taken_at`);