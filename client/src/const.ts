export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const withBase64State = (redirectUri: string) => btoa(redirectUri);

const safeFallbackUrl = () => `${window.location.origin}/404`;

const normalizeBaseUrl = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
};

function getManusLoginUrl() {
  const oauthPortalUrl = normalizeBaseUrl(import.meta.env.VITE_OAUTH_PORTAL_URL);
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = withBase64State(redirectUri);

  if (!oauthPortalUrl || !appId) {
    return safeFallbackUrl();
  }

  try {
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (error) {
    console.error("[Auth] Invalid Manus OAuth URL config", error);
    return safeFallbackUrl();
  }
}

function getSupabaseLoginUrl() {
  const supabaseUrl = normalizeBaseUrl(import.meta.env.VITE_SUPABASE_URL);
  const provider = (import.meta.env.VITE_SUPABASE_AUTH_PROVIDER || "google").trim();
  const redirectTo = `${window.location.origin}/auth/callback`;

  if (!supabaseUrl) {
    return safeFallbackUrl();
  }

  try {
    const url = new URL(`${supabaseUrl}/auth/v1/authorize`);
    url.searchParams.set("provider", provider || "google");
    url.searchParams.set("redirect_to", redirectTo);
    return url.toString();
  } catch (error) {
    console.error("[Auth] Invalid Supabase URL config", error);
    return safeFallbackUrl();
  }
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  if (import.meta.env.VITE_AUTH_MODE === "supabase") {
    return getSupabaseLoginUrl();
  }
  return getManusLoginUrl();
};
