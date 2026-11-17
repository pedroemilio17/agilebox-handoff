CREATE TABLE `sprint_tasks` (
	`organization_id` text NOT NULL,
	`sprint_id` text NOT NULL,
	`task_id` text NOT NULL,
	`added_at` text NOT NULL,
	`added_by` text NOT NULL,
	`removed_at` text,
	`removed_by` text,
	`outcome` text NOT NULL,
	PRIMARY KEY(`sprint_id`, `task_id`, `added_at`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`removed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sprint_tasks_outcome_check" CHECK("sprint_tasks"."outcome" IN ('open', 'completed', 'returned_to_backlog', 'carried_over', 'removed', 'left_on_board')),
	CONSTRAINT "sprint_tasks_open_outcome_check" CHECK(("sprint_tasks"."removed_at" IS NULL) = ("sprint_tasks"."outcome" = 'open')),
	CONSTRAINT "sprint_tasks_removed_pair_check" CHECK(("sprint_tasks"."removed_at" IS NULL) = ("sprint_tasks"."removed_by" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sprint_tasks_one_open_per_task_unique` ON `sprint_tasks` (`organization_id`,`task_id`) WHERE "sprint_tasks"."removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX `sprint_tasks_organization_sprint_index` ON `sprint_tasks` (`organization_id`,`sprint_id`);--> statement-breakpoint
CREATE TABLE `sprints` (
	`organization_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`goal` text,
	`planned_start` text NOT NULL,
	`planned_end` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text,
	`closed_at` text,
	`close_policy` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`discarded_at` text,
	`discarded_by` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`discarded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sprints_status_check" CHECK("sprints"."status" IN ('draft', 'active', 'closed')),
	CONSTRAINT "sprints_discard_pair_check" CHECK(("sprints"."discarded_at" IS NULL) = ("sprints"."discarded_by" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sprints_organization_project_number_unique` ON `sprints` (`organization_id`,`project_id`,`number`);--> statement-breakpoint
CREATE INDEX `sprints_organization_project_status_index` ON `sprints` (`organization_id`,`project_id`,`status`);