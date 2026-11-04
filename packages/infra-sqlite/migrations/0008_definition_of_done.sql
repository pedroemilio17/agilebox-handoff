CREATE TABLE `definition_of_done_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "definition_of_done_items_title_check" CHECK(length("definition_of_done_items"."title") BETWEEN 1 AND 200),
	CONSTRAINT "definition_of_done_items_position_check" CHECK("definition_of_done_items"."position" >= 0)
);
--> statement-breakpoint
CREATE INDEX `definition_of_done_items_project_position_index` ON `definition_of_done_items` (`project_id`,`position`);