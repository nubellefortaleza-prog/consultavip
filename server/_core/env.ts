const nonEmpty = (value: string | undefined): string => (value && value.trim().length > 0 ? value : "");

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // New provider-neutral AI config
  aiBaseUrl: nonEmpty(process.env.AI_BASE_URL) || nonEmpty(process.env.OPENAI_BASE_URL),
  aiApiKey: nonEmpty(process.env.AI_API_KEY) || nonEmpty(process.env.OPENAI_API_KEY),
  aiModel: process.env.AI_MODEL ?? "gpt-4o-mini",

  // Legacy Manus/Forge compatibility (fallback only)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // Storage provider
  storageProvider: process.env.STORAGE_PROVIDER ?? "s3",
};
