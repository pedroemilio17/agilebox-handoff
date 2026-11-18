CREATE TABLE `task_dependencies` (
	`organization_id` text NOT NULL,
	`predecessor_id` text NOT NULL,
	`successor_id` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`predecessor_id`, `successor_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`predecessor_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`successor_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "task_dependencies_not_self_check" CHECK("task_dependencies"."predecessor_id" <> "task_dependencies"."successor_id")
);
--> statement-breakpoint
CREATE INDEX `task_dependencies_organization_successor_index` ON `task_dependencies` (`organization_id`,`successor_id`);--> statement-breakpoint
CREATE INDEX `task_dependencies_organization_predecessor_index` ON `task_dependencies` (`organization_id`,`predecessor_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `starts_on` text;