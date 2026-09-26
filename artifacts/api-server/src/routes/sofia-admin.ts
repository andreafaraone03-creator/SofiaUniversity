import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  GetAdminStatusResponse,
  GetAdminSummaryResponse,
  ListAdminOrientationRequestsResponse,
  ListAdminTourBookingsResponse,
  LoginAdminBody,
  LoginAdminResponse,
  LogoutAdminResponse,
  SetupAdminBody,
  SetupAdminResponse,
  UpdateTourBookingStatusBody,
  UpdateTourBookingStatusParams,
  UpdateTourBookingStatusResponse,
} from "@workspace/api-zod";
import {
  clearAdminSession,
  hashPassword,
  isAdminAuthenticated,
  newPasswordSalt,
  requireAdmin,
  setAdminSession,
} from "../lib/sofia-auth";
import {
  bookingColumns,
  nowInRome,
  orientationColumns,
  sqlite,
  type OrientationRequest,
  type TourBooking,
} from "../lib/sofia-db";

const router: IRouter = Router();
const loginAttempts = new Map<string, { count: number; expires: number }>();

function setupComplete(): boolean {
  return Boolean(sqlite.prepare("SELECT id FROM utenti_admin WHERE id = 1").get());
}

router.get("/admin/status", (req, res): void => {
  res.json(GetAdminStatusResponse.parse({
    setupComplete: setupComplete(),
    authenticated: isAdminAuthenticated(req),
  }));
});

router.post("/admin/setup", (req, res): void => {
  const parsed = SetupAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Inserisci un nome utente e una password di almeno 10 caratteri." });
    return;
  }
  if (setupComplete()) {
    res.status(409).json({ error: "L'account amministratore è già configurato." });
    return;
  }

  const { username, password } = parsed.data;
  const salt = newPasswordSalt();
  sqlite.prepare(`
    INSERT INTO utenti_admin (id, username, password_hash, password_salt, created_at)
    VALUES (1, ?, ?, ?, ?)
  `).run(username.trim().toLowerCase(), hashPassword(password, salt), salt, new Date().toISOString());
  setAdminSession(req, res);
  res.status(201).json(SetupAdminResponse.parse({ setupComplete: true, authenticated: true }));
});

router.post("/admin/login", (req, res): void => {
  const key = req.ip ?? "unknown";
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.expires > Date.now() && attempt.count >= 5) {
    res.status(429).json({ error: "Troppi tentativi. Riprova tra 15 minuti." });
    return;
  }
  const parsed = LoginAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Inserisci nome utente e password." });
    return;
  }
  const row = sqlite.prepare("SELECT username, password_hash, password_salt FROM utenti_admin WHERE id = 1")
    .get() as { username: string; password_hash: string; password_salt: string } | undefined;
  const submittedHash = hashPassword(parsed.data.password, row?.password_salt ?? "invalid-salt");
  const validHash = row?.password_hash ? Buffer.from(row.password_hash, "hex") : Buffer.alloc(64);
  const suppliedHash = Buffer.from(submittedHash, "hex");
  const passwordMatches = suppliedHash.length === validHash.length &&
    timingSafeEqual(suppliedHash, validHash);
  if (!row || row.username !== parsed.data.username.trim().toLowerCase() || !passwordMatches) {
    const current = attempt && attempt.expires > Date.now() ? attempt.count : 0;
    loginAttempts.set(key, { count: current + 1, expires: Date.now() + 15 * 60 * 1000 });
    res.status(401).json({ error: "Credenziali non valide." });
    return;
  }
  loginAttempts.delete(key);
  setAdminSession(req, res);
  res.json(LoginAdminResponse.parse({ setupComplete: true, authenticated: true }));
});

router.post("/admin/logout", (_req, res): void => {
  clearAdminSession(res);
  res.json(LogoutAdminResponse.parse({ success: true }));
});

router.get("/admin/summary", requireAdmin, (_req, res): void => {
  const { date, time } = nowInRome();
  const orientationRequests = (sqlite.prepare("SELECT COUNT(*) AS total FROM richieste_corso")
    .get() as { total: number }).total;
  const tourBookings = (sqlite.prepare("SELECT COUNT(*) AS total FROM prenotazioni_tour")
    .get() as { total: number }).total;
  const upcomingBookings = (sqlite.prepare(`
    SELECT COUNT(*) AS total FROM prenotazioni_tour
    WHERE status = 'confirmed' AND (date > ? OR (date = ? AND time > ?))
  `).get(date, date, time) as { total: number }).total;
  const nextBooking = sqlite.prepare(`
    SELECT ${bookingColumns} FROM prenotazioni_tour
    WHERE status = 'confirmed' AND (date > ? OR (date = ? AND time > ?))
    ORDER BY date ASC, time ASC LIMIT 1
  `).get(date, date, time) as TourBooking | undefined;
  const response = GetAdminSummaryResponse.parse({
    orientationRequests, tourBookings, upcomingBookings, nextBooking: nextBooking ?? null,
  });
  res.json({
    ...response,
    nextBooking: response.nextBooking && nextBooking
      ? { ...response.nextBooking, date: nextBooking.date }
      : null,
  });
});

router.get("/admin/orientation-requests", requireAdmin, (_req, res): void => {
  const rows = sqlite.prepare(`
    SELECT ${orientationColumns} FROM richieste_corso ORDER BY created_at DESC, id DESC
  `).all() as OrientationRequest[];
  res.json(ListAdminOrientationRequestsResponse.parse(rows));
});

router.get("/admin/tour-bookings", requireAdmin, (_req, res): void => {
  const rows = sqlite.prepare(`
    SELECT ${bookingColumns} FROM prenotazioni_tour ORDER BY date DESC, time DESC, id DESC
  `).all() as TourBooking[];
  const response = ListAdminTourBookingsResponse.parse(rows);
  res.json(response.map((booking, index) => ({ ...booking, date: rows[index].date })));
});

router.patch("/admin/tour-bookings/:id", requireAdmin, (req, res): void => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateTourBookingStatusParams.safeParse({ id: Number(rawId) });
  const body = UpdateTourBookingStatusBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isSafeInteger(Number(rawId)) || Number(rawId) <= 0) {
    res.status(400).json({ error: "Prenotazione o stato non validi." });
    return;
  }
  try {
    const result = sqlite.prepare("UPDATE prenotazioni_tour SET status = ? WHERE id = ?")
      .run(body.data.status, params.data.id);
    if (!result.changes) {
      res.status(404).json({ error: "Prenotazione non trovata." });
      return;
    }
    const booking = sqlite.prepare(`SELECT ${bookingColumns} FROM prenotazioni_tour WHERE id = ?`)
      .get(params.data.id) as TourBooking;
    const response = UpdateTourBookingStatusResponse.parse(booking);
    res.json({ ...response, date: booking.date });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Lo slot è già occupato da un'altra prenotazione." });
      return;
    }
    throw error;
  }
});

export default router;