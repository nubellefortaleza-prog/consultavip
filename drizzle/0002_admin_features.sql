ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','recorder') NOT NULL DEFAULT 'user';
ALTER TABLE `consultations` ADD COLUMN `fullTranscription` text;

CREATE TABLE `appSettings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `aiApiKey` text,
  `webhookUrl` text,
  `webhookEnabled` boolean NOT NULL DEFAULT false,
  `googleCalendarEnabled` boolean NOT NULL DEFAULT false,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `appSettings_id` PRIMARY KEY(`id`)
);
