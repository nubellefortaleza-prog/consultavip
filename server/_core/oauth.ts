import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { createLocalSessionFromSupabaseToken, isSupabaseAuthEnabled } from "./supabaseAuth";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  if (ENV.authMode === "manus") {
    app.get("/api/oauth/callback", async (req: Request, res: Response) => {
      const code = getQueryParam(req, "code");
      const state = getQueryParam(req, "state");

      if (!code || !state) {
        res.status(400).json({ error: "code and state are required" });
        return;
      }

      try {
        const tokenResponse = await sdk.exchangeCodeForToken(code, state);
        const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

        if (!userInfo.openId) {
          res.status(400).json({ error: "openId missing from user info" });
          return;
        }

        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: new Date(),
        });

        const sessionToken = await sdk.createSessionToken(userInfo.openId, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        res.redirect(302, "/");
      } catch (error) {
        console.error("[OAuth] Callback failed", error);
        res.status(500).json({ error: "OAuth callback failed" });
      }
    });
  }

  app.post("/api/auth/supabase/session", async (req: Request, res: Response) => {
    if (!isSupabaseAuthEnabled()) {
      res.status(400).json({ error: "Supabase auth is not configured" });
      return;
    }

    const accessToken =
      (typeof req.body?.accessToken === "string" ? req.body.accessToken : undefined) ||
      (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined);

    if (!accessToken) {
      res.status(400).json({ error: "accessToken is required" });
      return;
    }

    try {
      const sessionToken = await createLocalSessionFromSupabaseToken(accessToken);
      if (!sessionToken) {
        res.status(401).json({ error: "invalid supabase token" });
        return;
      }

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("[Supabase Auth] Session creation failed", error);
      res.status(500).json({ error: "failed to create session" });
    }
  });
}
