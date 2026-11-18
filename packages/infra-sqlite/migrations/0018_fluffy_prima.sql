CREATE TABLE `project_modules` (
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`module_id` text NOT NULL,
	`state` text NOT NULL,
	`config` text,
	`changed_by` text,
	`changed_at` text,
	PRIMARY KEY(`project_id`, `module_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_modules_state_check" CHECK("project_modules"."state" IN ('active', 'winding_down', 'disabled')),
	CONSTRAINT "project_modules_config_json_check" CHECK("project_modules"."config" IS NULL OR json_valid("project_modules"."config"))
);
--> statement-breakpoint
CREATE INDEX `project_modules_organization_project_idx` ON `project_modules` (`organization_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `project_setup` (
	`project_id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`answers` text,
	`recommended_preset` text,
	`started_from_preset` text,
	`guide_level` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "project_setup_recommended_preset_check" CHECK("project_setup"."recommended_preset" IS NULL OR "project_setup"."recommended_preset" IN ('simples', 'kanban', 'agil', 'tradicional', 'hibrido')),
	CONSTRAINT "project_setup_started_from_preset_check" CHECK("project_setup"."started_from_preset" IS NULL OR "project_setup"."started_from_preset" IN ('simples', 'kanban', 'agil', 'tradicional', 'hibrido')),
	CONSTRAINT "project_setup_guide_level_check" CHECK("project_setup"."guide_level" IS NULL OR "project_setup"."guide_level" IN ('never', 'sometimes', 'always')),
	CONSTRAINT "project_setup_answers_json_check" CHECK("project_setup"."answers" IS NULL OR json_valid("project_setup"."answers"))
);
--> statement-breakpoint
-- Backfill (ADR-10, fase 1): cada projeto passa a ter os próprios módulos, copiados da ferramenta da equipe (team_modules) da organização do projeto. Copiamos module_id, state e config; changed_by e changed_at ficam nulos porque a migração não é uma edição de ninguém. team_modules, team_preferences e team_tools_audit não são alteradas nem apagadas.
INSERT INTO `project_modules` (`organization_id`, `project_id`, `module_id`, `state`, `config`, `changed_by`, `changed_at`) SELECT `projects`.`organization_id`, `projects`.`id`, `team_modules`.`module_id`, `team_modules`.`state`, `team_modules`.`config`, NULL, NULL FROM `projects` JOIN `team_modules` ON `team_modules`.`organization_id` = `projects`.`organization_id`;--> statement-breakpoint
-- Organização sem nenhuma linha em team_modules recebe o padrão histórico (os 13 módulos que toda equipe tinha antes do ADR-10), todos 'active'. É o mesmo padrão de defaultTeamTools em código (DEFAULT_TEAM_MODULE_IDS); o teste migration-project-modules.test.ts confere que as listas batem.
INSERT INTO `project_modules` (`organization_id`, `project_id`, `module_id`, `state`, `config`, `changed_by`, `changed_at`) SELECT `projects`.`organization_id`, `projects`.`id`, `modules`.`value`, 'active', NULL, NULL, NULL FROM `projects`, json_each('["core","agenda","backlog","sprints","checkins","impediments","estimates.hours","acceptance","wip","subtasks","flowMetrics","reviewRetro","burndown"]') AS `modules` WHERE NOT EXISTS (SELECT 1 FROM `team_modules` WHERE `team_modules`.`organization_id` = `projects`.`organization_id`);--> statement-breakpoint
-- Custo (cost) fica ligado em todo projeto. Se a linha já existia, só o estado vira 'active'; a configuração é preservada.
INSERT INTO `project_modules` (`organization_id`, `project_id`, `module_id`, `state`, `config`, `changed_by`, `changed_at`) SELECT `projects`.`organization_id`, `projects`.`id`, 'cost', 'active', NULL, NULL, NULL FROM `projects` WHERE 1 ON CONFLICT(`project_id`, `module_id`) DO UPDATE SET `state` = 'active';--> statement-breakpoint
-- Custo exige Estimativa em horas: garante estimates.hours 'active' em todo projeto em que ele não estava ativo (desligado, em encerramento ou ausente).
INSERT INTO `project_modules` (`organization_id`, `project_id`, `module_id`, `state`, `config`, `changed_by`, `changed_at`) SELECT `projects`.`organization_id`, `projects`.`id`, 'estimates.hours', 'active', NULL, NULL, NULL FROM `projects` WHERE 1 ON CONFLICT(`project_id`, `module_id`) DO UPDATE SET `state` = 'active';
