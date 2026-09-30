import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { GetAdminGoogleCalendarStatusResponse } from "@workspace/api-zod";
import { requireAdmin } from "../lib/sofia-auth";
import {
  completeGoogleAuthorization,
  createGoogleAuthorizationUrl,
  getGoogleCalendarConnectionStatus,
} from "../lib/sofia-google-oauth";

const router: IRouter = Router();
const stateCookieName = "sofia_google_calendar_oauth_state";
const callbackPath = "/api/admin/google-calendar/callback";
const stateLifetime = 10 * 60 * 1000;

function secureCookie(req: { secure: boolean }): boolean {
  return req.secure || process.env.NODE_ENV === "production";
}

function stateMatches(cookieValue: unknown, queryValue: unknown): boolean {
  if (typeof cookieValue !== "string" || typeof queryValue !== "string") return false;
  const cookie = Buffer.from(cookieValue);
  const query = Buffer.from(queryValue);
  return cookie.length === query.length && timingSafeEqual(cookie, query);
}

router.get("/admin/google-calendar/status", requireAdmin, async (_req, res): Promise<void> => {
  const status = await getGoogleCalendarConnectionStatus();
  res.json(GetAdminGoogleCalendarStatusResponse.parse(status));
});

router.get("/admin/google-calendar/connect", requireAdmin, (req, res): void => {
  try {
    const state = randomBytes(32).toString("base64url");
    const authorizationUrl = createGoogleAuthorizationUrl(state);
    res.cookie(stateCookieName, state, {
      httpOnly: true,
      secure: secureCookie(req),
      sameSite: "lax",
      maxAge: stateLifetime,
      path: callbackPath,
    });
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, authorizationUrl);
  } catch {
    res.status(503).json({
      error: "Configura le variabili OAuth Google nel servizio Render prima di collegare Calendar.",
    });
  }
});

router.get("/admin/google-calendar/callback", async (req, res): Promise<void> => {
  const stateCookie = req.cookies?.[stateCookieName] as unknown;
  const stateQuery = typeof req.query.state === "string" ? req.query.state : null;
  res.setHeader("Cache-Control", "no-store");
  res.clearCookie(stateCookieName, {
    secure: secureCookie(req),
    sameSite: "lax",
    path: callbackPath,
  });

  if (!stateMatches(stateCookie, stateQuery)) {
    res.status(400).json({
      error: "Richiesta Google Calendar scaduta o non valida. Avvia di nuovo il collegamento dall'area admin.",
    });
    return;
  }

  if (typeof req.query.error === "string" || typeof req.query.code !== "string") {
    res.redirect(302, "/admin?calendar=error");
    return;
  }

  try {
    await completeGoogleAuthorization(req.query.code);
    res.redirect(302, "/admin?calendar=connected");
  } catch {
    req.log.warn("Google Calendar authorization callback failed");
    res.redirect(302, "/admin?calendar=error");
  }
});

export default router;