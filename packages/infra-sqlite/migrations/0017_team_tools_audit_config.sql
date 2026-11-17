PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_team_tools_audit` (
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
	CONSTRAINT "team_tools_audit_kind_check" CHECK("__new_team_tools_audit"."kind" IN ('module_state', 'level', 'preset', 'config')),
	CONSTRAINT "team_tools_audit_module_check" CHECK("__new_team_tools_audit"."kind" NOT IN ('module_state', 'config') OR "__new_team_tools_audit"."module_id" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO `__new_team_tools_audit`("id", "organization_id", "actor_id", "kind", "module_id", "before", "after", "created_at") SELECT "id", "organization_id", "actor_id", "kind", "module_id", "before", "after", "created_at" FROM `team_tools_audit`;--> statement-breakpoint
DROP TABLE `team_tools_audit`;--> statement-breakpoint
ALTER TABLE `__new_team_tools_audit` RENAME TO `team_tools_audit`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `team_tools_audit_organization_created_idx` ON `team_tools_audit` (`organization_id`,`created_at`);