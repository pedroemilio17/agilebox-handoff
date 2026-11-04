ALTER TABLE `tasks` ADD `blocked_reason` text CHECK(`blocked_reason` IS NULL OR length(`blocked_reason`) BETWEEN 1 AND 280);--> statement-breakpoint
ALTER TABLE `tasks` ADD `blocked_at` text;
