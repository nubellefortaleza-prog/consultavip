ALTER TABLE `users` ADD COLUMN `reportEmail` varchar(320);
ALTER TABLE `users` ADD COLUMN `logoUrl` text;
ALTER TABLE `appSettings` ADD COLUMN `reportDefaultEmail` varchar(320);
