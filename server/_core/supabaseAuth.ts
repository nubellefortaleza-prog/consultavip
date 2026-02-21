import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
    [key: string]: unknown;
  };
};

function getSupabaseConfig() {
  const url = ENV.supabaseUrl;
  const anonKey = ENV.supabaseAnonKey;

  // For /auth/v1/user token validation, anon key is enough and safer than service role key.
  if (!url || !anonKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    apiKey: anonKey,
  };
}

export function isSupabaseAuthEnabled() {
  return Boolean(getSupabaseConfig());
}

export async function getSupabaseUser(accessToken: string): Promise<SupabaseUser | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SupabaseUser;
}

export async function createLocalSessionFromSupabaseToken(accessToken: string): Promise<string | null> {
  const user = await getSupabaseUser(accessToken);
  if (!user?.id) return null;

  await db.upsertUser({
    openId: user.id,
    name: user.user_metadata?.name || user.user_metadata?.full_name || user.email || "",
    email: user.email ?? null,
    loginMethod: "supabase",
    lastSignedIn: new Date(),
  });

  return sdk.createSessionToken(user.id, {
    name: user.user_metadata?.name || user.user_metadata?.full_name || user.email || "",
  });
}

export async function authenticateSupabaseRequest(accessToken: string): Promise<User | null> {
  const user = await getSupabaseUser(accessToken);
  if (!user?.id) return null;

  await db.upsertUser({
    openId: user.id,
    name: user.user_metadata?.name || user.user_metadata?.full_name || user.email || "",
    email: user.email ?? null,
    loginMethod: "supabase",
    lastSignedIn: new Date(),
  });

  return (await db.getUserByOpenId(user.id)) ?? null;
}
