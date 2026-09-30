import { Router, type IRouter } from "express";
import {
  CreateOrientationRequestBody,
  CreateOrientationRequestResponse,
  CreateTourBookingBody,
  CreateTourBookingResponse,
  ListAppointmentSlotsQueryParams,
  ListAppointmentSlotsResponse,
  ListCoursesQueryParams,
  ListCoursesResponse,
  ListTourSlotsQueryParams,
  ListTourSlotsResponse,
} from "@workspace/api-zod";
import {
  bookingColumns,
  courses,
  isBookable,
  nowInRome,
  orientationColumns,
  sqlite,
  tourTimes,
  type OrientationRequest,
  type TourBooking,
} from "../lib/sofia-db";
import { persistEmailDelivery, type EmailDelivery } from "../lib/sofia-email";
import { sendAutomaticConfirmation } from "../lib/sofia-email";
import {
  CalendarIntegrationError,
  createMeetEvent,
  deleteMeetEvent,
  getCalendarBusyRanges,
  intervalIsBusy,
  type AppointmentDetails,
} from "../lib/sofia-calendar";

const router: IRouter = Router();

function validDateString(rawDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
    !Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`)) &&
    new Date(`${rawDate}T00:00:00Z`).toISOString().slice(0, 10) === rawDate;
}

async function listAvailableSlots(date: string) {
  const [busyRanges, reserved] = await Promise.all([
    getCalendarBusyRanges(date),
    Promise.resolve(
      sqlite.prepare("SELECT time FROM appointment_slots WHERE date = ?")
        .all(date) as { time: string }[],
    ),
  ]);
  const reservedTimes = new Set(reserved.map((row) => row.time));
  return tourTimes.map((time) => ({
    time,
    available: isBookable(date, time) &&
      !reservedTimes.has(time) &&
      !intervalIsBusy(date, time, busyRanges),
  }));
}

function reserveSlot(
  date: string,
  time: string,
  bookingType: "consultation" | "tour",
  createBooking: () => number,
): number {
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const id = createBooking();
    sqlite.prepare(`
      INSERT INTO appointment_slots (date, time, booking_type, booking_id)
      VALUES (?, ?, ?, ?)
    `).run(date, time, bookingType, id);
    sqlite.exec("COMMIT");
    return id;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

function releaseBooking(
  table: "richieste_corso" | "prenotazioni_tour",
  id: number,
  bookingType: "consultation" | "tour",
): void {
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    sqlite.prepare("DELETE FROM appointment_slots WHERE booking_type = ? AND booking_id = ?")
      .run(bookingType, id);
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

async function isAvailable(date: string, time: string): Promise<boolean> {
  if (!isBookable(date, time)) return false;
  const reserved = sqlite.prepare(
    "SELECT 1 FROM appointment_slots WHERE date = ? AND time = ?",
  ).get(date, time);
  if (reserved) return false;
  const busyRanges = await getCalendarBusyRanges(date);
  return !intervalIsBusy(date, time, busyRanges);
}

router.get("/courses", (req, res): void => {
  const parsed = ListCoursesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtri dei corsi non validi." });
    return;
  }

  const { university, category, search } = parsed.data;
  const matches = courses.filter((course) =>
    (!university || course.university === university) &&
    (!category || course.category === category) &&
    (!search || course.name.toLocaleLowerCase("it").includes(search.trim().toLocaleLowerCase("it"))),
  );
  res.json(ListCoursesResponse.parse(matches));
});

router.post("/orientation-requests", async (req, res): Promise<void> => {
  const parsed = CreateOrientationRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Controlla i dati della prenotazione e riprova." });
    return;
  }

  const {
    university, courseId, firstName, lastName, email, province, phone, time,
  } = parsed.data;
  const date = parsed.data.date.toISOString().slice(0, 10);
  const course = courses.find((item) => item.id === courseId && item.university === university);
  if (!course) {
    res.status(400).json({ error: "Il corso selezionato non appartiene all'ateneo indicato." });
    return;
  }

  try {
    if (!await isAvailable(date, time)) {
      res.status(409).json({ error: "Questo orario non è più disponibile. Scegline un altro." });
      return;
    }
  } catch (error) {
    if (error instanceof CalendarIntegrationError) {
      res.status(503).json({ error: "Non riesco a verificare il calendario. Riprova tra poco." });
      return;
    }
    throw error;
  }

  const createdAt = new Date().toISOString();
  let id: number;
  try {
    id = reserveSlot(date, time, "consultation", () => {
      const result = sqlite.prepare(`
        INSERT INTO richieste_corso
          (first_name, last_name, email, province, phone, university, course_id,
           course_name, appointment_date, appointment_time, appointment_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        firstName.trim(), lastName.trim(), email.trim().toLowerCase(), province.trim(),
        phone.trim(), university, courseId, course.name, date, time, createdAt,
      );
      return Number(result.lastInsertRowid);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Questo orario è stato appena prenotato. Scegline un altro." });
      return;
    }
    throw error;
  }

  let meet;
  try {
    meet = await createMeetEvent({
      kind: "consultation",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      date,
      time,
      university,
      courseName: course.name,
    } satisfies AppointmentDetails);
    sqlite.prepare(`
      UPDATE richieste_corso
      SET google_calendar_event_id = ?, meet_url = ?, appointment_status = 'confirmed'
      WHERE id = ?
    `).run(meet.eventId, meet.meetUrl, id);
  } catch (error) {
    if (meet?.eventId) {
      try { await deleteMeetEvent(meet.eventId); } catch { /* best-effort cleanup */ }
    }
    releaseBooking("richieste_corso", id, "consultation");
    res.status(503).json({ error: "Non è stato possibile creare il link Google Meet. Riprova tra poco." });
    return;
  }

  const delivery = await sendAutomaticConfirmation(email.trim().toLowerCase(), {
    type: "consultation",
    firstName: firstName.trim(),
    university,
    courseName: course.name,
    date,
    time,
    meetUrl: meet.meetUrl,
  });
  persistEmailDelivery("richieste_corso", id, delivery);
  const request = sqlite.prepare(`SELECT ${orientationColumns} FROM richieste_corso WHERE id = ?`)
    .get(id) as OrientationRequest;
  const response = CreateOrientationRequestResponse.parse({
    id: request.id,
    date,
    time,
    meetUrl: meet.meetUrl,
    createdAt: request.createdAt,
    confirmationEmailStatus: request.confirmationEmailStatus,
  });
  res.status(201).json(response);
});

router.get("/tour-slots", async (req, res): Promise<void> => {
  const rawDate = typeof req.query.date === "string" ? req.query.date : "";
  if (!validDateString(rawDate) ||
    !ListTourSlotsQueryParams.safeParse({ date: new Date(`${rawDate}T00:00:00Z`) }).success) {
    res.status(400).json({ error: "Seleziona una data valida." });
    return;
  }
  if (rawDate < nowInRome().date) {
    res.json(ListTourSlotsResponse.parse(tourTimes.map((time) => ({ time, available: false }))));
    return;
  }

  try {
    res.json(ListTourSlotsResponse.parse(await listAvailableSlots(rawDate)));
  } catch {
    res.status(503).json({ error: "Non riesco a verificare il calendario. Riprova tra poco." });
  }
});

router.get("/appointment-slots", async (req, res): Promise<void> => {
  const rawDate = typeof req.query.date === "string" ? req.query.date : "";
  if (!validDateString(rawDate) ||
    !ListAppointmentSlotsQueryParams.safeParse({ date: new Date(`${rawDate}T00:00:00Z`) }).success) {
    res.status(400).json({ error: "Seleziona una data valida." });
    return;
  }
  if (rawDate < nowInRome().date) {
    res.json(ListAppointmentSlotsResponse.parse(tourTimes.map((time) => ({ time, available: false }))));
    return;
  }

  try {
    res.json(ListAppointmentSlotsResponse.parse(await listAvailableSlots(rawDate)));
  } catch {
    res.status(503).json({ error: "Non riesco a verificare il calendario. Riprova tra poco." });
  }
});

router.post("/tour-bookings", async (req, res): Promise<void> => {
  const parsed = CreateTourBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Controlla i dati della prenotazione e riprova." });
    return;
  }

  const { date, time, firstName, lastName, email, province, phone } = parsed.data;
  const dateString = date.toISOString().slice(0, 10);
  if (!isBookable(dateString, time)) {
    res.status(400).json({ error: "Seleziona una data e un orario futuri tra le 09:00 e le 21:00." });
    return;
  }

  try {
    if (!await isAvailable(dateString, time)) {
      res.status(409).json({ error: "Questo orario non è più disponibile. Scegline un altro." });
      return;
    }
  } catch (error) {
    if (error instanceof CalendarIntegrationError) {
      res.status(503).json({ error: "Non riesco a verificare il calendario. Riprova tra poco." });
      return;
    }
    throw error;
  }

  const createdAt = new Date().toISOString();
  let id: number;
  try {
    id = reserveSlot(dateString, time, "tour", () => {
      const result = sqlite.prepare(`
        INSERT INTO prenotazioni_tour
          (first_name, last_name, email, province, phone, date, time, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
      `).run(
        firstName.trim(), lastName.trim(), email.trim().toLowerCase(), province.trim(),
        phone.trim(), dateString, time, createdAt,
      );
      return Number(result.lastInsertRowid);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Questo orario è stato appena prenotato. Scegline un altro." });
      return;
    }
    throw error;
  }

  let eventId: string | null = null;
  let meetUrl = "";
  try {
    const meet = await createMeetEvent({
      kind: "tour",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      date: dateString,
      time,
    } satisfies AppointmentDetails);
    eventId = meet.eventId;
    meetUrl = meet.meetUrl;
    sqlite.prepare(`
      UPDATE prenotazioni_tour SET google_calendar_event_id = ?, meet_url = ? WHERE id = ?
    `).run(eventId, meetUrl, id);
  } catch {
    if (eventId) {
      try { await deleteMeetEvent(eventId); } catch { /* best-effort cleanup */ }
    }
    releaseBooking("prenotazioni_tour", id, "tour");
    res.status(503).json({ error: "Non è stato possibile creare il link Google Meet. Riprova tra poco." });
    return;
  }

  const delivery = await sendAutomaticConfirmation(email.trim().toLowerCase(), {
    type: "tour",
    firstName: firstName.trim(),
    date: dateString,
    time,
    meetUrl,
  });
  persistEmailDelivery("prenotazioni_tour", id, delivery);
  const booking = sqlite.prepare(`SELECT ${bookingColumns} FROM prenotazioni_tour WHERE id = ?`)
    .get(id) as TourBooking;
  const response = CreateTourBookingResponse.parse({
    id: booking.id,
    date: booking.date,
    time: booking.time,
    meetUrl,
    confirmationEmailStatus: booking.confirmationEmailStatus,
  });
  // Keep the public date as YYYY-MM-DD rather than a serialized UTC timestamp.
  res.status(201).json({ ...response, date: booking.date });
});

export default router;