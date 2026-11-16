ALTER TABLE `projects` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `archived_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `archived_by` text REFERENCES users(id);