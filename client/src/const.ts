export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const withBase64State = (redirectUri: string) => btoa(redirectUri);

function getManusLoginUrl() {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = withBase64State(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
}

function getSupabaseLoginUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const provider = import.meta.env.VITE_SUPABASE_AUTH_PROVIDER || "google";
  const redirectTo = `${window.location.origin}/auth/callback`;

  const url = new URL(`${supabaseUrl}/auth/v1/authorize`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  if (import.meta.env.VITE_AUTH_MODE === "supabase") {
    return getSupabaseLoginUrl();
  }
  return getManusLoginUrl();
};
