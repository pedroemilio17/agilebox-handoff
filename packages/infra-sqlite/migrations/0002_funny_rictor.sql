ALTER TABLE `tasks` ADD `priority` text DEFAULT 'normal' NOT NULL CHECK(`priority` IN ('normal', 'high'));
