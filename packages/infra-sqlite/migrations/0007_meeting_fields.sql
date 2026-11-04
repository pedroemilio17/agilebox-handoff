ALTER TABLE `meetings` ADD `end_time` text;--> statement-breakpoint
ALTER TABLE `meetings` ADD `kind` text DEFAULT 'meeting' NOT NULL CONSTRAINT "meetings_kind_check" CHECK("kind" IN ('meeting', 'review', 'retro'));--> statement-breakpoint
ALTER TABLE `meetings` ADD `recurrence` text DEFAULT 'none' NOT NULL CONSTRAINT "meetings_recurrence_check" CHECK("recurrence" IN ('none', 'weekly'));--> statement-breakpoint
ALTER TABLE `meetings` ADD `recurrence_until` text;
