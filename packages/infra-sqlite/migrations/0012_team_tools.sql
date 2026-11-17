CREATE TABLE `team_modules` (
	`organization_id` text NOT NULL,
	`module_id` text NOT NULL,
	`state` text NOT NULL,
	`config` text,
	`changed_by` text,
	`changed_at` text,
	PRIMARY KEY(`organization_id`, `module_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "team_modules_state_check" CHECK("team_modules"."state" IN ('active', 'winding_down', 'disabled')),
	CONSTRAINT "team_modules_config_json_check" CHECK("team_modules"."config" IS NULL OR json_valid("team_modules"."config"))
);
--> statement-breakpoint
CREATE TABLE `team_preferences` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`experience_level` text NOT NULL,
	`changed_by` text,
	`changed_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "team_preferences_level_check" CHECK("team_preferences"."experience_level" IN ('basic', 'intermediate', 'advanced'))
);
--> statement-breakpoint
CREATE TABLE `team_tools_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL,
	`module_id` text,
	`before` text,
	`after` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "team_tools_audit_kind_check" CHECK("team_tools_audit"."kind" IN ('module_state', 'level', 'preset')),
	CONSTRAINT "team_tools_audit_module_check" CHECK("team_tools_audit"."kind" <> 'module_state' OR "team_tools_audit"."module_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `team_tools_audit_organization_created_idx` ON `team_tools_audit` (`organization_id`,`created_at`);--> statement-breakpoint
-- Backfill: organizações que já existiam recebem o padrão de defaultTeamTools (todas as ferramentas do catálogo, exceto estimates.points e integrations, no nível Avançado), para preservar o comportamento atual. Organização criada depois não tem linha e cai no mesmo padrão em código (defaultTeamTools). O teste migration-team-tools.test.ts confere que as duas listas são iguais.
INSERT INTO `team_preferences` (`organization_id`, `experience_level`, `changed_by`, `changed_at`) SELECT `id`, 'advanced', NULL, NULL FROM `organizations`;--> statement-breakpoint
INSERT INTO `team_modules` (`organization_id`, `module_id`, `state`, `config`, `changed_by`, `changed_at`) SELECT `organizations`.`id`, `modules`.`value`, 'active', NULL, NULL, NULL FROM `organizations`, json_each('["core","agenda","backlog","sprints","checkins","impediments","estimates.hours","acceptance","wip","subtasks","flowMetrics","reviewRetro","burndown"]') AS `modules`;
