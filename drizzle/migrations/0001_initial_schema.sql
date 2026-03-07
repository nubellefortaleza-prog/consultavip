CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `users_id` PRIMARY KEY(`id`),
  CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

CREATE TABLE IF NOT EXISTS `consultations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `audioUrl` text,
  `audioKey` varchar(512),
  `transcription` text,
  `patientName` varchar(255),
  `consultationDate` varchar(64),
  `patientProfile` text,
  `mainComplaints` text,
  `treatmentPlan` text,
  `budgetPresented` text,
  `closedDeal` text,
  `additionalNotes` text,
  `emailSent` enum('yes','no') NOT NULL DEFAULT 'no',
  `emailSentAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `consultations_id` PRIMARY KEY(`id`)
);
