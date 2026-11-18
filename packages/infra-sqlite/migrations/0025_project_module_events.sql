CREATE TABLE `project_module_events` (
	`organization_id` text NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`module_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`auto` integer NOT NULL,
	`related_module_id` text,
	`at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_module_events_action_check" CHECK("project_module_events"."action" IN ('enabled', 'disabled', 'winding_down', 'scheduled_disable', 'cancelled')),
	CONSTRAINT "project_module_events_actor_role_check" CHECK("project_module_events"."actor_role" IN ('collaborator', 'manager'))
);
--> statement-breakpoint
CREATE INDEX `project_module_events_organization_project_at_idx` ON `project_module_events` (`organization_id`,`project_id`,`at`);