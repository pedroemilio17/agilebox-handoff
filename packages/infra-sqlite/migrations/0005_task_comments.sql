CREATE TABLE `task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`task_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`mentions` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`edited_at` text,
	`as_manager` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "task_comments_body_check" CHECK(length("task_comments"."body") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE INDEX `task_comments_task_created_index` ON `task_comments` (`task_id`,`created_at`);