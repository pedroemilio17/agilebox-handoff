CREATE TABLE `deliverables` (
	`organization_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "deliverables_position_check" CHECK("deliverables"."position" >= 0)
);
--> statement-breakpoint
CREATE INDEX `deliverables_organization_project_parent_position_index` ON `deliverables` (`organization_id`,`project_id`,`parent_id`,`position`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`organization_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`due_on` text NOT NULL,
	`deliverable_id` text,
	`criterion` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `milestones_organization_project_due_on_index` ON `milestones` (`organization_id`,`project_id`,`due_on`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `deliverable_id` text REFERENCES deliverables(id);--> statement-breakpoint
CREATE INDEX `tasks_organization_deliverable_index` ON `tasks` (`organization_id`,`deliverable_id`);