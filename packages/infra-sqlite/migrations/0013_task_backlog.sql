ALTER TABLE `tasks` ADD `backlog_rank` integer;--> statement-breakpoint
CREATE INDEX `tasks_organization_project_backlog_index` ON `tasks` (`organization_id`,`project_id`,`backlog_rank`);