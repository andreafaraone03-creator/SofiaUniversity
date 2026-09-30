import { Router, type IRouter } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  CancelOrientationAppointmentParams,
  CancelOrientationAppointmentResponse,
  ConfirmOrientationEnrollmentParams,
  ConfirmOrientationEnrollmentResponse,
  CreateAdminEnrollmentBody,
  CreateAdminEnrollmentResponse,
  GetAdminEmailSettingsResponse,
  GetAdminStatusResponse,
  GetAdminSummaryResponse,
  ListAdminEnrollmentsResponse,
  ListAdminOrientationRequestsResponse,
  ListAdminTourBookingsResponse,
  MarkOrientationRequestNotEnrolledParams,
  MarkOrientationRequestNotEnrolledResponse,
  LoginAdminBody,
  LoginAdminResponse,
  LogoutAdminResponse,
  ResendOrientationConfirmationParams,
  ResendOrientationConfirmationResponse,
  ResendTourConfirmationParams,
  ResendTourConfirmationResponse,
  SendAdminTestEmailBody,
  SendAdminTestEmailResponse,
  SetupAdminBody,
  SetupAdminResponse,
  UpdateAdminEmailSettingsBody,
  UpdateAdminEmailSettingsResponse,
  UpdateAdminEnrollmentBody,
  UpdateAdminEnrollmentParams,
  UpdateAdminEnrollmentResponse,
  UpdateOrientationRequestManagementBody,
  UpdateOrientationRequestManagementParams,
  UpdateOrientationRequestManagementResponse,
  UpdateTourBookingManagementBody,
  UpdateTourBookingManagementParams,
  UpdateTourBookingManagementResponse,
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
  courses,
  enrollmentColumns,
  isBookable,
  nowInRome,
  orientationColumns,
  sqlite,
  type EmailSettings,
  type Enrollment,
  type OrientationRequest,
  type TourBooking,
} from "../lib/sofia-db";
import {
  persistEmailDelivery,
  sendAutomaticConfirmation,
  sendForcedConfirmation,
  sendTestEmail,
} from "../lib/sofia-email";
import {
  createMeetEvent,
  deleteMeetEvent,
  getCalendarBusyRanges,
  intervalIsBusy,
  type AppointmentDetails,
} from "../lib/sofia-calendar";

const router: IRouter = Router();
const loginAttempts = new Map<string, { count: number; expires: number }>();

function positivePathId(raw: string | string[]): number | null {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function readEmailSettings(): EmailSettings {
  const row = sqlite.prepare(`
    SELECT sender_email AS senderEmail, sender_name AS senderName,
      send_orientation_confirmations AS sendOrientationConfirmations,
      send_tour_confirmations AS sendTourConfirmations
    FROM impostazioni_email WHERE id = 1
  `).get() as {
    senderEmail: string | null;
    senderName: string;
    sendOrientationConfirmations: number;
    sendTourConfirmations: number;
  } | undefined;

  return {
    senderEmail: row?.senderEmail?.trim() || null,
    senderName: row?.senderName?.trim() || "Sofia",
    sendOrientationConfirmations: row ? Boolean(row.sendOrientationConfirmations) : true,
    sendTourConfirmations: row ? Boolean(row.sendTourConfirmations) : true,
  };
}

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
  const orientationRequests = (sqlite.prepare("SELECT COUNT(*) AS total FROM richieste_corso WHERE enrollment_outcome = 'pending'")
    .get() as { total: number }).total;
  const tourBookings = (sqlite.prepare("SELECT COUNT(*) AS total FROM prenotazioni_tour")
    .get() as { total: number }).total;
  const upcomingBookings = (sqlite.prepare(`
    SELECT COUNT(*) AS total FROM prenotazioni_tour
    WHERE status = 'confirmed' AND (date > ? OR (date = ? AND time > ?))
  `).get(date, date, time) as { total: number }).total;
  const enrollmentTotals = sqlite.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN commission_status = 'pending' THEN commission_cents ELSE 0 END), 0) AS pendingCents,
      COALESCE(SUM(CASE WHEN commission_status = 'paid' THEN commission_cents ELSE 0 END), 0) AS paidCents
    FROM iscrizioni_universita
    WHERE status = 'active'
  `).get() as { total: number; pendingCents: number; paidCents: number };
  const dueLeads = (sqlite.prepare(`
    SELECT COUNT(*) AS total FROM richieste_corso
    WHERE follow_up_at IS NOT NULL AND datetime(follow_up_at) <= datetime('now')
      AND pipeline_status NOT IN ('enrolled', 'closed')
      AND enrollment_outcome = 'pending'
  `).get() as { total: number }).total;
  const dueTours = (sqlite.prepare(`
    SELECT COUNT(*) AS total FROM prenotazioni_tour
    WHERE follow_up_at IS NOT NULL AND datetime(follow_up_at) <= datetime('now')
      AND status != 'cancelled'
  `).get() as { total: number }).total;
  const followUpsDue = dueLeads + dueTours;
  const nextBooking = sqlite.prepare(`
    SELECT ${bookingColumns} FROM prenotazioni_tour
    WHERE status = 'confirmed' AND (date > ? OR (date = ? AND time > ?))
    ORDER BY date ASC, time ASC LIMIT 1
  `).get(date, date, time) as TourBooking | undefined;
  const response = GetAdminSummaryResponse.parse({
    orientationRequests,
    tourBookings,
    upcomingBookings,
    enrollmentsTotal: enrollmentTotals.total,
    commissionsPendingCents: enrollmentTotals.pendingCents,
    commissionsPaidCents: enrollmentTotals.paidCents,
    followUpsDue,
    nextBooking: nextBooking ?? null,
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

router.delete("/admin/orientation-requests/:id/appointment", requireAdmin, async (req, res): Promise<void> => {
  const id = positivePathId(req.params.id);
  const params = CancelOrientationAppointmentParams.safeParse({ id });
  if (!id || !params.success) {
    res.status(400).json({ error: "Appuntamento non valido." });
    return;
  }
  const appointment = sqlite.prepare(`
    SELECT appointment_status AS appointmentStatus,
      google_calendar_event_id AS googleCalendarEventId
    FROM richieste_corso WHERE id = ?
  `).get(id) as { appointmentStatus: string | null; googleCalendarEventId: string | null } | undefined;
  if (!appointment) {
    res.status(404).json({ error: "Appuntamento non trovato." });
    return;
  }
  if (appointment.appointmentStatus === "cancelled") {
    res.json(CancelOrientationAppointmentResponse.parse({ success: true }));
    return;
  }

  try {
    if (appointment.googleCalendarEventId) {
      await deleteMeetEvent(appointment.googleCalendarEventId);
    }
  } catch {
    res.status(503).json({ error: "Non riesco ad aggiornare l'evento nel calendario. Riprova." });
    return;
  }

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.prepare(`
      UPDATE richieste_corso
      SET appointment_status = 'cancelled',
          google_calendar_event_id = NULL,
          meet_url = NULL
      WHERE id = ?
    `).run(id);
    sqlite.prepare("DELETE FROM appointment_slots WHERE booking_type = 'consultation' AND booking_id = ?")
      .run(id);
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
  res.json(CancelOrientationAppointmentResponse.parse({ success: true }));
});

router.get("/admin/tour-bookings", requireAdmin, (_req, res): void => {
  const rows = sqlite.prepare(`
    SELECT ${bookingColumns} FROM prenotazioni_tour ORDER BY date DESC, time DESC, id DESC
  `).all() as TourBooking[];
  const response = ListAdminTourBookingsResponse.parse(rows);
  res.json(response.map((booking, index) => ({ ...booking, date: rows[index].date })));
});

router.patch("/admin/tour-bookings/:id", requireAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateTourBookingStatusParams.safeParse({ id: Number(rawId) });
  const body = UpdateTourBookingStatusBody.safeParse(req.body);
  if (!params.success || !body.success || !Number.isSafeInteger(Number(rawId)) || Number(rawId) <= 0) {
    res.status(400).json({ error: "Prenotazione o stato non validi." });
    return;
  }

  const current = sqlite.prepare(`
    SELECT ${bookingColumns}, google_calendar_event_id AS googleCalendarEventId
    FROM prenotazioni_tour WHERE id = ?
  `).get(params.data.id) as (TourBooking & { googleCalendarEventId: string | null }) | undefined;
  if (!current) {
    res.status(404).json({ error: "Prenotazione non trovata." });
    return;
  }

  if (body.data.status === "cancelled" && current.status !== "cancelled") {
    try {
      if (current.googleCalendarEventId) await deleteMeetEvent(current.googleCalendarEventId);
    } catch {
      res.status(503).json({ error: "Non riesco ad aggiornare l'evento nel calendario. Riprova." });
      return;
    }
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.prepare(`
        UPDATE prenotazioni_tour
        SET status = 'cancelled', google_calendar_event_id = NULL, meet_url = NULL
        WHERE id = ?
      `).run(params.data.id);
      sqlite.prepare("DELETE FROM appointment_slots WHERE booking_type = 'tour' AND booking_id = ?")
        .run(params.data.id);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  } else if (body.data.status === "confirmed" && current.status === "cancelled") {
    if (!isBookable(current.date, current.time)) {
      res.status(409).json({ error: "Questo appuntamento non può essere riattivato perché l'orario è passato." });
      return;
    }
    try {
      const busyRanges = await getCalendarBusyRanges(current.date);
      const reserved = sqlite.prepare(
        "SELECT 1 FROM appointment_slots WHERE date = ? AND time = ?",
      ).get(current.date, current.time);
      if (reserved || intervalIsBusy(current.date, current.time, busyRanges)) {
        res.status(409).json({ error: "Questo orario è già occupato nel calendario." });
        return;
      }
    } catch {
      res.status(503).json({ error: "Non riesco a verificare il calendario. Riprova." });
      return;
    }

    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.prepare("UPDATE prenotazioni_tour SET status = 'confirmed' WHERE id = ?")
        .run(params.data.id);
      sqlite.prepare(`
        INSERT INTO appointment_slots (date, time, booking_type, booking_id)
        VALUES (?, ?, 'tour', ?)
      `).run(current.date, current.time, params.data.id);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        res.status(409).json({ error: "Questo orario è già occupato da un'altra prenotazione." });
        return;
      }
      throw error;
    }

    let eventId: string | null = null;
    let meetUrl: string | null = null;
    try {
      const meet = await createMeetEvent({
        kind: "tour",
        firstName: current.firstName,
        lastName: current.lastName,
        email: current.email,
        date: current.date,
        time: current.time,
      } satisfies AppointmentDetails);
      eventId = meet.eventId;
      meetUrl = meet.meetUrl;
      sqlite.prepare(`
        UPDATE prenotazioni_tour SET google_calendar_event_id = ?, meet_url = ? WHERE id = ?
      `).run(eventId, meetUrl, params.data.id);
    } catch {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        sqlite.prepare(`
          UPDATE prenotazioni_tour
          SET status = 'cancelled', google_calendar_event_id = NULL, meet_url = NULL
          WHERE id = ?
        `).run(params.data.id);
        sqlite.prepare("DELETE FROM appointment_slots WHERE booking_type = 'tour' AND booking_id = ?")
          .run(params.data.id);
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
      if (eventId) {
        try { await deleteMeetEvent(eventId); } catch { /* best-effort cleanup */ }
      }
      res.status(503).json({ error: "Non è stato possibile creare il link Google Meet. Riprova." });
      return;
    }

    const delivery = await sendAutomaticConfirmation(current.email, {
      type: "tour",
      firstName: current.firstName,
      date: current.date,
      time: current.time,
      meetUrl,
    });
    persistEmailDelivery("prenotazioni_tour", params.data.id, delivery);
  } else {
    sqlite.prepare("UPDATE prenotazioni_tour SET status = ? WHERE id = ?")
      .run(body.data.status, params.data.id);
  }

  try {
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

router.patch("/admin/orientation-requests/:id/management", requireAdmin, (req, res): void => {
  const id = positivePathId(req.params.id);
  const params = UpdateOrientationRequestManagementParams.safeParse({ id });
  const body = UpdateOrientationRequestManagementBody.safeParse(req.body);
  if (!id || !params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Dati di gestione non validi." });
    return;
  }

  const assignments: string[] = [];
  const values: (string | number | null)[] = [];
  if (body.data.pipelineStatus !== undefined) {
    assignments.push("pipeline_status = ?");
    values.push(body.data.pipelineStatus);
  }
  if (body.data.adminNotes !== undefined) {
    assignments.push("admin_notes = ?");
    values.push(body.data.adminNotes);
  }
  if (body.data.followUpAt !== undefined) {
    assignments.push("follow_up_at = ?");
    values.push(body.data.followUpAt ? body.data.followUpAt.toISOString() : null);
  }

  const result = sqlite.prepare(`
    UPDATE richieste_corso SET ${assignments.join(", ")} WHERE id = ?
  `).run(...values, params.data.id);
  if (!result.changes) {
    res.status(404).json({ error: "Richiesta non trovata." });
    return;
  }
  const request = sqlite.prepare(`SELECT ${orientationColumns} FROM richieste_corso WHERE id = ?`)
    .get(params.data.id) as OrientationRequest;
  res.json(UpdateOrientationRequestManagementResponse.parse(request));
});

router.post("/admin/orientation-requests/:id/confirm-enrollment", requireAdmin, (req, res): void => {
  const id = positivePathId(req.params.id);
  const params = ConfirmOrientationEnrollmentParams.safeParse({ id });
  if (!id || !params.success) {
    res.status(400).json({ error: "Richiesta non valida." });
    return;
  }

  sqlite.exec("BEGIN IMMEDIATE");
  let enrollmentId: number;
  try {
    const request = sqlite.prepare(`SELECT ${orientationColumns} FROM richieste_corso WHERE id = ?`)
      .get(params.data.id) as OrientationRequest | undefined;
    if (!request) {
      sqlite.exec("ROLLBACK");
      res.status(404).json({ error: "Richiesta non trovata." });
      return;
    }

    const existing = sqlite.prepare(`
      SELECT id FROM iscrizioni_universita WHERE orientation_request_id = ? LIMIT 1
    `).get(params.data.id) as { id: number } | undefined;
    if (existing) {
      sqlite.exec("ROLLBACK");
      res.status(409).json({ error: "Esiste già un'iscrizione collegata. Controlla la scheda iscrizioni." });
      return;
    }

    const createdAt = new Date().toISOString();
    const enrolledAt = nowInRome().date;
    const result = sqlite.prepare(`
      INSERT INTO iscrizioni_universita
        (orientation_request_id, first_name, last_name, email, university, course_id,
         course_name, enrolled_at, commission_cents, commission_status,
         commission_paid_at, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 18000, 'paid', ?, 'active', ?, ?)
    `).run(
      request.id,
      request.firstName,
      request.lastName,
      request.email,
      request.university,
      request.courseId,
      request.courseName,
      enrolledAt,
      createdAt,
      "Confermata con spunta nell'area admin.",
      createdAt,
    );
    enrollmentId = Number(result.lastInsertRowid);
    sqlite.prepare(`
      UPDATE richieste_corso
      SET pipeline_status = 'enrolled', enrollment_outcome = 'enrolled'
      WHERE id = ?
    `).run(request.id);
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }

  const enrollment = sqlite.prepare(`
    SELECT ${enrollmentColumns} FROM iscrizioni_universita WHERE id = ?
  `).get(enrollmentId) as Enrollment;
  res.status(201).json(ConfirmOrientationEnrollmentResponse.parse(enrollment));
});

router.post("/admin/orientation-requests/:id/mark-not-enrolled", requireAdmin, (req, res): void => {
  const id = positivePathId(req.params.id);
  const params = MarkOrientationRequestNotEnrolledParams.safeParse({ id });
  if (!id || !params.success) {
    res.status(400).json({ error: "Richiesta non valida." });
    return;
  }

  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const request = sqlite.prepare(`SELECT ${orientationColumns} FROM richieste_corso WHERE id = ?`)
      .get(params.data.id) as OrientationRequest | undefined;
    if (!request) {
      sqlite.exec("ROLLBACK");
      res.status(404).json({ error: "Richiesta non trovata." });
      return;
    }

    const existing = sqlite.prepare(`
      SELECT id FROM iscrizioni_universita WHERE orientation_request_id = ? LIMIT 1
    `).get(params.data.id) as { id: number } | undefined;
    if (existing || request.enrollmentOutcome === "enrolled") {
      sqlite.exec("ROLLBACK");
      res.status(409).json({ error: "La richiesta ha già un'iscrizione registrata." });
      return;
    }
    if (request.enrollmentOutcome === "not_enrolled") {
      sqlite.exec("ROLLBACK");
      res.json(MarkOrientationRequestNotEnrolledResponse.parse(request));
      return;
    }

    sqlite.prepare(`
      UPDATE richieste_corso
      SET enrollment_outcome = 'not_enrolled',
          pipeline_status = CASE WHEN pipeline_status = 'enrolled' THEN 'considering' ELSE pipeline_status END
      WHERE id = ?
    `).run(params.data.id);
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }

  const updated = sqlite.prepare(`SELECT ${orientationColumns} FROM richieste_corso WHERE id = ?`)
    .get(params.data.id) as OrientationRequest;
  res.json(MarkOrientationRequestNotEnrolledResponse.parse(updated));
});

router.patch("/admin/tour-bookings/:id/management", requireAdmin, (req, res): void => {
  const id = positivePathId(req.params.id);
  const params = UpdateTourBookingManagementParams.safeParse({ id });
  const body = UpdateTourBookingManagementBody.safeParse(req.body);
  if (!id || !params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Dati di gestione non validi." });
    return;
  }

  const assignments: string[] = [];
  const values: (string | number | null)[] = [];
  if (body.data.adminNotes !== undefined) {
    assignments.push("admin_notes = ?");
    values.push(body.data.adminNotes);
  }
  if (body.data.followUpAt !== undefined) {
    assignments.push("follow_up_at = ?");
    values.push(body.data.followUpAt ? body.data.followUpAt.toISOString() : null);
  }
  const result = sqlite.prepare(`
    UPDATE prenotazioni_tour SET ${assignments.join(", ")} WHERE id = ?
  `).run(...values, params.data.id);
  if (!result.changes) {
    res.status(404).json({ error: "Prenotazione non trovata." });
    return;
  }
  const booking = sqlite.prepare(`SELECT ${bookingColumns} FROM prenotazioni_tour WHERE id = ?`)
    .get(params.data.id) as TourBooking;
  const response = UpdateTourBookingManagementResponse.parse(booking);
  res.json({ ...response, date: booking.date });
});

router.get("/admin/enrollments", requireAdmin, (_req, res): void => {
  const rows = sqlite.prepare(`
    SELECT ${enrollmentColumns} FROM iscrizioni_universita
    ORDER BY enrolled_at DESC, id DESC
  `).all() as Enrollment[];
  res.json(ListAdminEnrollmentsResponse.parse(rows));
});

router.post("/admin/enrollments", requireAdmin, (req, res): void => {
  const parsed = CreateAdminEnrollmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Controlla i dati dell'iscrizione e riprova." });
    return;
  }

  const data = parsed.data;
  const course = courses.find((item) => item.id === data.courseId && item.university === data.university);
  if (!course) {
    res.status(400).json({ error: "Il corso selezionato non appartiene all'ateneo indicato." });
    return;
  }

  const orientationRequestId = data.orientationRequestId ?? null;
  let contact = {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
  };
  if (orientationRequestId !== null) {
    const lead = sqlite.prepare(`
      SELECT first_name AS firstName, last_name AS lastName, email
      FROM richieste_corso WHERE id = ?
    `).get(orientationRequestId) as { firstName: string; lastName: string; email: string } | undefined;
    if (!lead) {
      res.status(404).json({ error: "La richiesta collegata non esiste più." });
      return;
    }
    contact = { firstName: lead.firstName, lastName: lead.lastName, email: lead.email };
  }

  const enrolledAt = data.enrolledAt instanceof Date
    ? data.enrolledAt.toISOString().slice(0, 10)
    : String(data.enrolledAt).slice(0, 10);
  const createdAt = new Date().toISOString();
  const commissionPaidAt = data.commissionStatus === "paid" ? createdAt : null;
  sqlite.exec("BEGIN IMMEDIATE");
  let enrollmentId: number;
  try {
    const result = sqlite.prepare(`
      INSERT INTO iscrizioni_universita
        (orientation_request_id, first_name, last_name, email, university, course_id,
         course_name, enrolled_at, commission_cents, commission_status,
         commission_paid_at, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      orientationRequestId,
      contact.firstName,
      contact.lastName,
      contact.email,
      data.university,
      data.courseId,
      course.name,
      enrolledAt,
      data.commissionCents,
      data.commissionStatus,
      commissionPaidAt,
      data.notes ?? "",
      createdAt,
    );
    enrollmentId = Number(result.lastInsertRowid);
    if (orientationRequestId !== null) {
      sqlite.prepare(`
        UPDATE richieste_corso
        SET pipeline_status = 'enrolled', enrollment_outcome = 'enrolled'
        WHERE id = ?
      `)
        .run(orientationRequestId);
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }

  const enrollment = sqlite.prepare(`
    SELECT ${enrollmentColumns} FROM iscrizioni_universita WHERE id = ?
  `).get(enrollmentId) as Enrollment;
  res.status(201).json(CreateAdminEnrollmentResponse.parse(enrollment));
});

router.patch("/admin/enrollments/:id", requireAdmin, (req, res): void => {
  const id = positivePathId(req.params.id);
  const params = UpdateAdminEnrollmentParams.safeParse({ id });
  const body = UpdateAdminEnrollmentBody.safeParse(req.body);
  if (!id || !params.success || !body.success || Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Dati di iscrizione non validi." });
    return;
  }

  const current = sqlite.prepare(`
    SELECT ${enrollmentColumns} FROM iscrizioni_universita WHERE id = ?
  `).get(params.data.id) as Enrollment | undefined;
  if (!current) {
    res.status(404).json({ error: "Iscrizione non trovata." });
    return;
  }

  const assignments: string[] = [];
  const values: (string | number | null)[] = [];
  if (body.data.commissionCents !== undefined) {
    assignments.push("commission_cents = ?");
    values.push(body.data.commissionCents);
  }
  if (body.data.commissionStatus !== undefined) {
    assignments.push("commission_status = ?", "commission_paid_at = ?");
    values.push(
      body.data.commissionStatus,
      body.data.commissionStatus === "paid" ? current.commissionPaidAt ?? new Date().toISOString() : null,
    );
  }
  if (body.data.status !== undefined) {
    assignments.push("status = ?");
    values.push(body.data.status);
  }
  if (body.data.notes !== undefined) {
    assignments.push("notes = ?");
    values.push(body.data.notes);
  }
  const result = sqlite.prepare(`
    UPDATE iscrizioni_universita SET ${assignments.join(", ")} WHERE id = ?
  `).run(...values, params.data.id);
  if (!result.changes) {
    res.status(404).json({ error: "Iscrizione non trovata." });
    return;
  }
  const enrollment = sqlite.prepare(`
    SELECT ${enrollmentColumns} FROM iscrizioni_universita WHERE id = ?
  `).get(params.data.id) as Enrollment;
  res.json(UpdateAdminEnrollmentResponse.parse(enrollment));
});

router.get("/admin/email-settings", requireAdmin, (_req, res): void => {
  res.json(GetAdminEmailSettingsResponse.parse(readEmailSettings()));
});

router.put("/admin/email-settings", requireAdmin, (req, res): void => {
  const parsed = UpdateAdminEmailSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Controlla i dati del mittente." });
    return;
  }
  const senderEmail = parsed.data.senderEmail?.trim().toLowerCase() || null;
  if (senderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    res.status(400).json({ error: "Inserisci un indirizzo email valido." });
    return;
  }
  sqlite.prepare(`
    INSERT INTO impostazioni_email
      (id, sender_email, sender_name, send_orientation_confirmations,
       send_tour_confirmations, updated_at)
    VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sender_email = excluded.sender_email,
      sender_name = excluded.sender_name,
      send_orientation_confirmations = excluded.send_orientation_confirmations,
      send_tour_confirmations = excluded.send_tour_confirmations,
      updated_at = excluded.updated_at
  `).run(
    senderEmail,
    parsed.data.senderName.trim(),
    Number(parsed.data.sendOrientationConfirmations),
    Number(parsed.data.sendTourConfirmations),
    new Date().toISOString(),
  );
  res.json(UpdateAdminEmailSettingsResponse.parse(readEmailSettings()));
});

router.post("/admin/email-settings/test", requireAdmin, async (req, res): Promise<void> => {
  const parsed = SendAdminTestEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Inserisci un indirizzo di prova valido." });
    return;
  }
  const delivery = await sendTestEmail(parsed.data.to.trim().toLowerCase());
  const result = SendAdminTestEmailResponse.parse({
    success: delivery.status === "sent",
    status: delivery.status,
    message: delivery.status === "sent" ? "Email di prova inviata." : delivery.error,
  });
  res.status(delivery.status === "sent" ? 200 : 503).json(result);
});

router.post("/admin/orientation-requests/:id/send-confirmation", requireAdmin, async (req, res): Promise<void> => {
  const id = positivePathId(req.params.id);
  const params = ResendOrientationConfirmationParams.safeParse({ id });
  if (!id || !params.success) {
    res.status(400).json({ error: "Richiesta non valida." });
    return;
  }
  const request = sqlite.prepare(`SELECT ${orientationColumns} FROM richieste_corso WHERE id = ?`)
    .get(params.data.id) as OrientationRequest | undefined;
  if (!request) {
    res.status(404).json({ error: "Richiesta non trovata." });
    return;
  }
  if (
    request.appointmentStatus !== "confirmed" ||
    !request.appointmentDate ||
    !request.appointmentTime ||
    !request.meetUrl
  ) {
    res.status(409).json({ error: "Questa prenotazione non ha un link Meet attivo." });
    return;
  }
  const delivery = await sendForcedConfirmation(request.email, {
    type: "consultation",
    firstName: request.firstName,
    university: request.university,
    courseName: request.courseName,
    date: request.appointmentDate,
    time: request.appointmentTime,
    meetUrl: request.meetUrl,
  });
  persistEmailDelivery("richieste_corso", request.id, delivery);
  if (delivery.status === "failed") {
    req.log.warn({ requestId: request.id }, "Orientation confirmation retry failed");
  }
  const result = ResendOrientationConfirmationResponse.parse({
    success: delivery.status === "sent",
    status: delivery.status,
    message: delivery.status === "sent" ? "Email inviata." : delivery.error,
  });
  res.status(delivery.status === "sent" ? 200 : 503).json(result);
});

router.post("/admin/tour-bookings/:id/send-confirmation", requireAdmin, async (req, res): Promise<void> => {
  const id = positivePathId(req.params.id);
  const params = ResendTourConfirmationParams.safeParse({ id });
  if (!id || !params.success) {
    res.status(400).json({ error: "Prenotazione non valida." });
    return;
  }
  const booking = sqlite.prepare(`SELECT ${bookingColumns} FROM prenotazioni_tour WHERE id = ?`)
    .get(params.data.id) as TourBooking | undefined;
  if (!booking) {
    res.status(404).json({ error: "Prenotazione non trovata." });
    return;
  }
  if (booking.status !== "confirmed" || !booking.meetUrl) {
    res.status(409).json({ error: "Questa prenotazione non ha un link Meet attivo." });
    return;
  }
  const delivery = await sendForcedConfirmation(booking.email, {
    type: "tour",
    firstName: booking.firstName,
    date: booking.date,
    time: booking.time,
    meetUrl: booking.meetUrl,
  });
  persistEmailDelivery("prenotazioni_tour", booking.id, delivery);
  if (delivery.status === "failed") {
    req.log.warn({ bookingId: booking.id }, "Tour confirmation retry failed");
  }
  const result = ResendTourConfirmationResponse.parse({
    success: delivery.status === "sent",
    status: delivery.status,
    message: delivery.status === "sent" ? "Email inviata." : delivery.error,
  });
  res.status(delivery.status === "sent" ? 200 : 503).json(result);
});

export default router;