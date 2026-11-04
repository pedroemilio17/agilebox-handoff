ALTER TABLE `organizations` ADD `task_prefix` text DEFAULT 'AB' NOT NULL CHECK(length(`task_prefix`) BETWEEN 2 AND 5);--> statement-breakpoint
ALTER TABLE `tasks` ADD `number` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `tasks` SET `number` = (
	SELECT COUNT(*) + 1 FROM `tasks` AS `earlier`
	WHERE `earlier`.`organization_id` = `tasks`.`organization_id`
		AND (`earlier`.`created_at` < `tasks`.`created_at`
			OR (`earlier`.`created_at` = `tasks`.`created_at` AND `earlier`.`id` < `tasks`.`id`))
);--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_organization_number_unique` ON `tasks` (`organization_id`,`number`);