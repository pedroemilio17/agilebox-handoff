CREATE TABLE `risks` (
	`organization_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`probability` integer NOT NULL,
	`impact` integer NOT NULL,
	`response` text,
	`owner_id` text,
	`deliverable_id` text,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "risks_probability_check" CHECK("risks"."probability" BETWEEN 1 AND 3),
	CONSTRAINT "risks_impact_check" CHECK("risks"."impact" BETWEEN 1 AND 3),
	CONSTRAINT "risks_status_check" CHECK("risks"."status" IN ('open', 'mitigated', 'occurred', 'closed'))
);
--> statement-breakpoint
CREATE INDEX `risks_organization_project_index` ON `risks` (`organization_id`,`project_id`);