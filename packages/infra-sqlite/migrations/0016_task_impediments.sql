CREATE TABLE `task_impediments` (
	`organization_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`owner_id` text,
	`opened_by` text NOT NULL,
	`opened_at` text NOT NULL,
	`resolved_by` text,
	`resolved_at` text,
	`resolution` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "task_impediments_status_check" CHECK("task_impediments"."status" IN ('open', 'resolved')),
	CONSTRAINT "task_impediments_reason_check" CHECK(length("task_impediments"."reason") BETWEEN 1 AND 280),
	CONSTRAINT "task_impediments_resolution_check" CHECK("task_impediments"."resolution" IS NULL OR length("task_impediments"."resolution") BETWEEN 1 AND 280),
	CONSTRAINT "task_impediments_resolved_pair_check" CHECK(("task_impediments"."resolved_at" IS NULL) = ("task_impediments"."resolved_by" IS NULL)),
	CONSTRAINT "task_impediments_open_state_check" CHECK(("task_impediments"."status" = 'open') = ("task_impediments"."resolved_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_impediments_one_open_per_task_unique` ON `task_impediments` (`organization_id`,`task_id`) WHERE "task_impediments"."status" = 'open';--> statement-breakpoint
CREATE INDEX `task_impediments_organization_task_index` ON `task_impediments` (`organization_id`,`task_id`);--> statement-breakpoint
CREATE INDEX `task_impediments_open_owner_index` ON `task_impediments` (`organization_id`,`owner_id`) WHERE "task_impediments"."status" = 'open';
--> statement-breakpoint
-- Backfill (M5.2a): cada tarefa bloqueada hoje vira um impedimento aberto, sem responsável. O id
-- reaproveita o da tarefa (ULID válido e único; impedimentos novos recebem ids novos). O autor é quem
-- bloqueou por último (evento `blocked`), ou o criador da tarefa se não houver evento.
INSERT INTO `task_impediments` (`organization_id`,`id`,`task_id`,`reason`,`status`,`owner_id`,`opened_by`,`opened_at`,`resolved_by`,`resolved_at`,`resolution`)
SELECT `t`.`organization_id`, `t`.`id`, `t`.`id`, `t`.`blocked_reason`, 'open', NULL,
  COALESCE((SELECT `e`.`actor_user_id` FROM `task_events` `e` WHERE `e`.`task_id` = `t`.`id` AND `e`.`type` = 'blocked' ORDER BY `e`.`at` DESC LIMIT 1), `t`.`created_by`),
  COALESCE(`t`.`blocked_at`, `t`.`updated_at`), NULL, NULL, NULL
FROM `tasks` `t`
WHERE `t`.`blocked_reason` IS NOT NULL;
