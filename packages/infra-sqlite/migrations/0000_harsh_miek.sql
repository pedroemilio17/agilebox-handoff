CREATE TABLE `contributors` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text,
	`default_rate_cents` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `local_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meeting_participants` (
	`meeting_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`meeting_id`, `user_id`),
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meetings_organization_date_index` ON `meetings` (`organization_id`,`date`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`added_by` text NOT NULL,
	`added_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `user_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_organization_name_key_unique` ON `projects` (`organization_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`at` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`as_manager` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_events_task_at_index` ON `task_events` (`task_id`,`at`);--> statement-breakpoint
CREATE TABLE `task_opens` (
	`user_id` text NOT NULL,
	`task_id` text NOT NULL,
	`last_opened_at` text NOT NULL,
	`open_count` integer NOT NULL,
	PRIMARY KEY(`user_id`, `task_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_opens_user_last_opened_at_index` ON `task_opens` (`user_id`,`last_opened_at`);--> statement-breakpoint
CREATE TABLE `task_participations` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text,
	`contributor_id` text,
	`role` text NOT NULL,
	`hours_hundredths` integer NOT NULL,
	`rate_cents` integer NOT NULL,
	`added_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contributor_id`) REFERENCES `contributors`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "task_participations_exactly_one_owner_check" CHECK((("task_participations"."user_id" IS NOT NULL) AND ("task_participations"."contributor_id" IS NULL)) OR (("task_participations"."user_id" IS NULL) AND ("task_participations"."contributor_id" IS NOT NULL))),
	CONSTRAINT "task_participations_responsible_user_check" CHECK("task_participations"."role" <> 'responsible' OR "task_participations"."user_id" IS NOT NULL),
	CONSTRAINT "task_participations_role_check" CHECK("task_participations"."role" IN ('responsible', 'support'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_participations_task_user_unique` ON `task_participations` (`task_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_participations_task_contributor_unique` ON `task_participations` (`task_id`,`contributor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_participations_one_responsible_unique` ON `task_participations` (`task_id`) WHERE "task_participations"."role" = 'responsible';--> statement-breakpoint
CREATE INDEX `task_participations_user_index` ON `task_participations` (`user_id`);--> statement-breakpoint
CREATE INDEX `task_participations_contributor_index` ON `task_participations` (`contributor_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`deadline` text,
	`ticket_id` text,
	`ticket_url` text,
	`search_text` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tasks_status_check" CHECK("tasks"."status" IN ('planning', 'todo', 'in_progress', 'review', 'done'))
);
--> statement-breakpoint
CREATE INDEX `tasks_organization_project_index` ON `tasks` (`organization_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_organization_updated_at_index` ON `tasks` (`organization_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`initials` text NOT NULL,
	`role` text NOT NULL,
	`default_rate_cents` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_organization_email_unique` ON `users` (`organization_id`,`email`);