import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  consultations,
  InsertConsultation,
  appSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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
  return _db;
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
      values.role = "admin";
      updateSet.role = "admin";
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

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// --- Consultation helpers ---

export async function createConsultation(data: InsertConsultation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(consultations).values(data);
  return result[0].insertId;
}

export async function updateConsultation(
  id: number,
  data: Partial<InsertConsultation>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(consultations).set(data).where(eq(consultations.id, id));
}

export async function getConsultationById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(consultations)
    .where(eq(consultations.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getConsultationsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(consultations)
    .where(eq(consultations.userId, userId))
    .orderBy(desc(consultations.createdAt));
}

export async function listUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(
  openId: string,
  role: "user" | "admin" | "recorder"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.openId, openId));
}

export async function createUserByAdmin(data: {
  openId: string;
  name?: string | null;
  email?: string | null;
  role?: "user" | "admin" | "recorder";
  reportEmail?: string | null;
  logoUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(users).values({
    openId: data.openId,
    name: data.name ?? null,
    email: data.email ?? null,
    role: data.role ?? "user",
    reportEmail: data.reportEmail ?? null,
    logoUrl: data.logoUrl ?? null,
    loginMethod: "admin_created",
    lastSignedIn: new Date(),
  });
}

export async function updateUserProfileByAdmin(
  openId: string,
  data: Partial<{
    name: string | null;
    email: string | null;
    role: "user" | "admin" | "recorder";
    reportEmail: string | null;
    logoUrl: string | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.openId, openId));
}

export async function getAppSettings() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(appSettings).limit(1);
  if (rows.length > 0) return rows[0];

  const inserted = await db.insert(appSettings).values({});
  const id = inserted[0]?.insertId;
  if (!id) return null;
  const created = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, id))
    .limit(1);
  return created[0] ?? null;
}

export async function updateAppSettings(
  data: Partial<{
    aiApiKey: string | null;
    reportDefaultEmail: string | null;
    webhookUrl: string | null;
    webhookEnabled: boolean;
    googleCalendarEnabled: boolean;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const current = await getAppSettings();
  if (!current) throw new Error("Could not initialize app settings");

  await db.update(appSettings).set(data).where(eq(appSettings.id, current.id));
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, current.id))
    .limit(1);
  return rows[0] ?? null;
}
