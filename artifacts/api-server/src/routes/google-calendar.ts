import { Router, type IRouter } from "express";
import { GetAdminGoogleCalendarStatusResponse } from "@workspace/api-zod";
import { requireAdmin } from "../lib/sofia-auth";
import {
  completeGoogleAuthorization,
  consumeGoogleOAuthState,
  createGoogleOAuthState,
  createGoogleAuthorizationUrl,
  getGoogleCalendarConnectionStatus,
} from "../lib/sofia-google-oauth";

const router: IRouter = Router();

router.get("/admin/google-calendar/status", requireAdmin, async (_req, res): Promise<void> => {
  const status = await getGoogleCalendarConnectionStatus();
  res.json(GetAdminGoogleCalendarStatusResponse.parse(status));
});

router.get("/admin/google-calendar/connect", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const state = await createGoogleOAuthState();
    const authorizationUrl = createGoogleAuthorizationUrl(state);
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, authorizationUrl);
  } catch {
    res.status(503).json({
      error: "Non è possibile avviare il collegamento Google Calendar. Riprova tra poco.",
    });
  }
});

router.get("/admin/google-calendar/callback", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  let validState: boolean;
  try {
    validState = await consumeGoogleOAuthState(req.query.state);
  } catch {
    req.log.error("Google Calendar OAuth state validation failed");
    res.status(503).json({
      error: "Non riesco a verificare la richiesta Google Calendar. Avvia di nuovo il collegamento dall'area admin.",
    });
    return;
  }
  if (!validState) {
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