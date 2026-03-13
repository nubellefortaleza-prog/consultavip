import { eq, desc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, consultations, InsertConsultation,
  settings, establishments, InsertEstablishment, Establishment,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { hashPassword } from './_core/auth-utils';

let _db: ReturnType<typeof drizzle> | null = null;
let _initialized = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  if (_db && !_initialized) {
    _initialized = true;
    await initializeSchema(_db);
  }
  return _db;
}

// Helper: run an ALTER and ignore specific MySQL error codes
async function tryAlter(db: ReturnType<typeof drizzle>, statement: string, ignoreErrNos: number[] = [1060]) {
  try {
    await db.execute(sql.raw(statement));
  } catch (e: any) {
    const errNo = e?.errno ?? e?.cause?.errno;
    if (!ignoreErrNos.includes(errNo)) {
      console.warn("[Database] migration warning:", e?.message ?? e);
    }
  }
}

async function initializeSchema(db: ReturnType<typeof drizzle>) {
  try {
    // ── Establishments ──────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`establishments\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`slug\` varchar(100),
        \`logoUrl\` text,
        \`active\` enum('yes','no') NOT NULL DEFAULT 'yes',
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`establishments_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`establishments_slug_unique\` UNIQUE(\`slug\`)
      )
    `);

    // Seed establishment 1 (Vip Estetic) if not present
    await db.execute(sql`
      INSERT IGNORE INTO \`establishments\` (\`id\`, \`name\`, \`slug\`) VALUES (1, 'Vip Estetic', 'vipestetic')
    `);

    // ── Users ───────────────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`openId\` varchar(64) NOT NULL,
        \`name\` text,
        \`email\` varchar(320),
        \`loginMethod\` varchar(64),
        \`passwordHash\` text,
        \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
        CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
        CONSTRAINT \`users_openId_unique\` UNIQUE(\`openId\`)
      )
    `);

    await tryAlter(db, "ALTER TABLE `users` ADD COLUMN `passwordHash` text");
    await tryAlter(db, "ALTER TABLE `users` ADD COLUMN `profilePhoto` text");
    await tryAlter(db, "ALTER TABLE `users` ADD COLUMN `reportEmail` varchar(320)");
    await tryAlter(db, "ALTER TABLE `users` ADD COLUMN `establishmentId` int NOT NULL DEFAULT 1");

    // ── Consultations ───────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`consultations\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`userId\` int NOT NULL,
        \`audioUrl\` text,
        \`audioKey\` varchar(512),
        \`transcription\` text,
        \`patientName\` varchar(255),
        \`patientPhone\` varchar(32),
        \`consultationDate\` varchar(64),
        \`patientProfile\` text,
        \`mainComplaints\` text,
        \`treatmentPlan\` text,
        \`budgetPresented\` text,
        \`closedDeal\` text,
        \`additionalNotes\` text,
        \`emailSent\` enum('yes','no') NOT NULL DEFAULT 'no',
        \`emailSentAt\` timestamp,
        \`createdAt\` timestamp NOT NULL DEFAULT (now()),
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`consultations_id\` PRIMARY KEY(\`id\`)
      )
    `);

    await tryAlter(db, "ALTER TABLE `consultations` ADD COLUMN `patientPhone` varchar(32)");
    await tryAlter(db, "ALTER TABLE `consultations` ADD COLUMN `establishmentId` int NOT NULL DEFAULT 1");

    // ── Settings (composite PK: establishmentId + key) ──────────────────────
    // Try to recreate as composite-PK table if it exists with old simple PK
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`settings\` (
        \`establishmentId\` int NOT NULL DEFAULT 1,
        \`key\` varchar(100) NOT NULL,
        \`value\` text,
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`establishmentId\`, \`key\`)
      )
    `);

    // Migration for old single-column PK settings table
    await tryAlter(db, "ALTER TABLE `settings` ADD COLUMN `establishmentId` int NOT NULL DEFAULT 1", [1060, 1068]);
    await tryAlter(db, "ALTER TABLE `settings` DROP PRIMARY KEY", [1091]); // 1091 = can't drop non-existent
    await tryAlter(db, "ALTER TABLE `settings` ADD PRIMARY KEY (`establishmentId`, `key`)", [1068]); // 1068 = multiple def

    console.log("[Database] Schema initialized successfully");
  } catch (error) {
    console.warn("[Database] Schema initialization warning:", error);
  }
}

// ── User helpers ──────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers(establishmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users)
    .where(eq(users.establishmentId, establishmentId))
    .orderBy(desc(users.createdAt));
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash: string;
  role: "user" | "admin";
  reportEmail?: string;
  establishmentId: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values({
    openId: `local:${data.establishmentId}:${data.email}`,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    role: data.role,
    reportEmail: data.reportEmail ?? null,
    loginMethod: "password",
    establishmentId: data.establishmentId,
    lastSignedIn: new Date(),
  });
}

export async function updateUserById(id: number, data: {
  name?: string;
  email?: string;
  role?: "user" | "admin";
  reportEmail?: string | null;
  passwordHash?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.email !== undefined) updateSet.email = data.email;
  if (data.role !== undefined) updateSet.role = data.role;
  if (data.reportEmail !== undefined) updateSet.reportEmail = data.reportEmail;
  if (data.passwordHash !== undefined) updateSet.passwordHash = data.passwordHash;
  if (Object.keys(updateSet).length > 0) {
    await db.update(users).set(updateSet).where(eq(users.id, id));
  }
}

export async function updateUserProfile(id: number, data: {
  name?: string;
  profilePhoto?: string;
  reportEmail?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.profilePhoto !== undefined) updateSet.profilePhoto = data.profilePhoto;
  if (data.reportEmail !== undefined) updateSet.reportEmail = data.reportEmail;
  if (Object.keys(updateSet).length > 0) {
    await db.update(users).set(updateSet).where(eq(users.id, id));
  }
}

export async function deleteUser(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

export async function seedAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  const db = await getDb();
  if (!db) return;

  const existing = await getUserByEmail(adminEmail);
  if (existing) {
    if (!existing.passwordHash) {
      const passwordHash = await hashPassword(adminPassword);
      await db.update(users).set({ passwordHash }).where(eq(users.email, adminEmail));
      console.log("[Auth] Admin password hash updated");
    }
    return;
  }

  const passwordHash = await hashPassword(adminPassword);
  await db.insert(users).values({
    openId: `local:1:${adminEmail}`,
    name: "Administrador",
    email: adminEmail,
    loginMethod: "password",
    passwordHash,
    role: "admin",
    establishmentId: 1,
    lastSignedIn: new Date(),
  });
  console.log("[Auth] Admin user created:", adminEmail);
}

// ── Establishment helpers ─────────────────────────────────────────────────────

export async function getAllEstablishments(): Promise<Establishment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(establishments).orderBy(desc(establishments.createdAt));
}

export async function getEstablishmentById(id: number): Promise<Establishment | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(establishments).where(eq(establishments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createEstablishment(data: {
  name: string;
  slug?: string;
  logoUrl?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(establishments).values({
    name: data.name,
    slug: data.slug ?? null,
    logoUrl: data.logoUrl ?? null,
    active: "yes",
  });
  return result[0].insertId;
}

export async function updateEstablishment(id: number, data: {
  name?: string;
  slug?: string | null;
  logoUrl?: string | null;
  active?: "yes" | "no";
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.slug !== undefined) updateSet.slug = data.slug;
  if (data.logoUrl !== undefined) updateSet.logoUrl = data.logoUrl;
  if (data.active !== undefined) updateSet.active = data.active;
  if (Object.keys(updateSet).length > 0) {
    await db.update(establishments).set(updateSet).where(eq(establishments.id, id));
  }
}

// ── Settings helpers (per establishment) ──────────────────────────────────────

export async function getSetting(key: string, establishmentId: number = 1): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(settings)
    .where(and(eq(settings.key, key), eq(settings.establishmentId, establishmentId)))
    .limit(1);
  return result.length > 0 ? (result[0].value ?? null) : null;
}

export async function setSetting(key: string, value: string, establishmentId: number = 1): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(settings).values({ key, value, establishmentId })
    .onDuplicateKeyUpdate({ set: { value } });
}

export async function getAllSettings(establishmentId: number = 1): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(settings).where(eq(settings.establishmentId, establishmentId));
  return Object.fromEntries(rows.map(r => [r.key, r.value ?? ""]));
}

// ── Consultation helpers ──────────────────────────────────────────────────────

export async function createConsultation(data: InsertConsultation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(consultations).values(data);
  return result[0].insertId;
}

export async function updateConsultation(id: number, data: Partial<InsertConsultation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(consultations).set(data).where(eq(consultations.id, id));
}

export async function getConsultationById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(consultations).where(eq(consultations.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getConsultationsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(consultations)
    .where(eq(consultations.userId, userId))
    .orderBy(desc(consultations.createdAt));
}
