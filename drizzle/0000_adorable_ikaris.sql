CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contractor` text NOT NULL,
	`product` text NOT NULL,
	`owner` text NOT NULL,
	`probability` integer NOT NULL,
	`status` text NOT NULL,
	`value` integer NOT NULL,
	`deadline` text NOT NULL,
	`next_action` text NOT NULL
);
