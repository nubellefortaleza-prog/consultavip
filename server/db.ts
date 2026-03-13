import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, consultations, InsertConsultation, settings } from "../drizzle/schema";
import { ENV } from './_core/env';
import { hashPassword } from './_core/auth-utils';

let _db: ReturnType<typeof drizzle> | null = null;
let _initialized = false;

// Lazily create the drizzle instance so local tooling can run without a DB.
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

async function initializeSchema(db: ReturnType<typeof drizzle>) {
  try {
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

    // Incremental migrations — ignore "duplicate column" errors (errno 1060)
    const addColumn = async (alter: string) => {
      try { await db.execute(sql.raw(alter)); } catch (e: any) {
        const errNo = e?.errno ?? e?.cause?.errno;
        if (errNo !== 1060) console.warn("[Database] migration warning:", e?.message);
      }
    };

    await addColumn("ALTER TABLE `users` ADD COLUMN `passwordHash` text");
    await addColumn("ALTER TABLE `users` ADD COLUMN `profilePhoto` text");
    await addColumn("ALTER TABLE `users` ADD COLUMN `reportEmail` varchar(320)");

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

    await addColumn("ALTER TABLE `consultations` ADD COLUMN `patientPhone` varchar(32)");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`settings\` (
        \`key\` varchar(100) NOT NULL,
        \`value\` text,
        \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`settings_key\` PRIMARY KEY(\`key\`)
      )
    `);

    console.log("[Database] Schema initialized successfully");
  } catch (error) {
    console.warn("[Database] Schema initialization warning:", error);
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash: string;
  role: "user" | "admin";
  reportEmail?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(users).values({
    openId: `local:${data.email}`,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    role: data.role,
    reportEmail: data.reportEmail ?? null,
    loginMethod: "password",
    lastSignedIn: new Date(),
  });
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
    openId: `local:${adminEmail}`,
    name: "Administrador",
    email: adminEmail,
    loginMethod: "password",
    passwordHash,
    role: "admin",
    lastSignedIn: new Date(),
  });
  console.log("[Auth] Admin user created:", adminEmail);
}

// --- Settings helpers ---

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result.length > 0 ? (result[0].value ?? null) : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map(r => [r.key, r.value ?? ""]));
}

// --- Consultation helpers ---

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
  return db.select().from(consultations).where(eq(consultations.userId, userId)).orderBy(desc(consultations.createdAt));
}
