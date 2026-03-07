import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  reportEmail: varchar("reportEmail", { length: 320 }),
  logoUrl: text("logoUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "recorder"])
    .default("user")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const consultations = mysqlTable("consultations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  audioUrl: text("audioUrl"),
  audioKey: varchar("audioKey", { length: 512 }),
  transcription: text("transcription"),
  // Keep integral transcription explicitly for auditing and exports.
  fullTranscription: text("fullTranscription"),
  patientName: varchar("patientName", { length: 255 }),
  consultationDate: varchar("consultationDate", { length: 64 }),
  patientProfile: text("patientProfile"),
  mainComplaints: text("mainComplaints"),
  treatmentPlan: text("treatmentPlan"),
  budgetPresented: text("budgetPresented"),
  closedDeal: text("closedDeal"),
  additionalNotes: text("additionalNotes"),
  emailSent: mysqlEnum("emailSent", ["yes", "no"]).default("no").notNull(),
  emailSentAt: timestamp("emailSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  aiApiKey: text("aiApiKey"),
  reportDefaultEmail: varchar("reportDefaultEmail", { length: 320 }),
  webhookUrl: text("webhookUrl"),
  webhookEnabled: boolean("webhookEnabled").default(false).notNull(),
  googleCalendarEnabled: boolean("googleCalendarEnabled")
    .default(false)
    .notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = typeof consultations.$inferInsert;
export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = typeof appSettings.$inferInsert;
