import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, consultations, InsertConsultation } from "../drizzle/schema";
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
    // Add passwordHash to existing tables (compatible with MySQL 5.7+)
    try {
      await db.execute(sql`ALTER TABLE \`users\` ADD COLUMN \`passwordHash\` text`);
    } catch (e: any) {
      // Drizzle wraps mysql2 errors: errno may be on e.cause, not on e directly
      const errNo = e?.errno ?? e?.cause?.errno;
      if (errNo !== 1060) console.warn("[Database] passwordHash migration:", e?.message);
    }
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
    // Add patientPhone to existing consultations tables (after CREATE TABLE IF NOT EXISTS)
    try {
      await db.execute(sql`ALTER TABLE \`consultations\` ADD COLUMN \`patientPhone\` varchar(32)`);
    } catch (e: any) {
      const errNo = e?.errno ?? e?.cause?.errno;
      if (errNo !== 1060) console.warn("[Database] patientPhone migration:", e?.message);
    }
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

export async function seedAdminUser(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  const db = await getDb();
  if (!db) return;

  const existing = await getUserByEmail(adminEmail);
  if (existing) {
    // Update password hash if it's missing
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
