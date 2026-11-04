CREATE TABLE `task_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`done_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_checklist_items_title_check" CHECK(length("task_checklist_items"."title") BETWEEN 1 AND 200),
	CONSTRAINT "task_checklist_items_position_check" CHECK("task_checklist_items"."position" >= 0)
);
--> statement-breakpoint
CREATE INDEX `task_checklist_items_task_position_index` ON `task_checklist_items` (`task_id`,`position`);