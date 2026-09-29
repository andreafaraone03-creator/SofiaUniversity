import { Router, type IRouter } from "express";
import {
  CreateOrientationRequestBody,
  CreateOrientationRequestResponse,
  CreateTourBookingBody,
  CreateTourBookingResponse,
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

const router: IRouter = Router();

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
    res.status(400).json({ error: "Controlla i dati del modulo e riprova." });
    return;
  }

  const { university, courseId, firstName, lastName, email, province, phone } = parsed.data;
  const course = courses.find((item) => item.id === courseId && item.university === university);
  if (!course) {
    res.status(400).json({ error: "Il corso selezionato non appartiene all'ateneo indicato." });
    return;
  }

  const result = sqlite.prepare(`
    INSERT INTO richieste_corso
      (first_name, last_name, email, province, phone, university, course_id, course_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    firstName.trim(), lastName.trim(), email.trim().toLowerCase(), province.trim(),
    phone.trim(), university, courseId, course.name, new Date().toISOString(),
  );
  const id = Number(result.lastInsertRowid);
  const delivery: EmailDelivery = { status: "disabled", sentAt: null, error: "" };
  persistEmailDelivery("richieste_corso", id, delivery);
  const request = sqlite.prepare(`SELECT ${orientationColumns} FROM richieste_corso WHERE id = ?`)
    .get(id) as OrientationRequest;
  const response = CreateOrientationRequestResponse.parse({
    id: request.id,
    createdAt: request.createdAt,
    confirmationEmailStatus: request.confirmationEmailStatus,
  });
  res.status(201).json(response);
});

router.get("/tour-slots", (req, res): void => {
  const rawDate = typeof req.query.date === "string" ? req.query.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) ||
    Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`)) ||
    new Date(`${rawDate}T00:00:00Z`).toISOString().slice(0, 10) !== rawDate ||
    !ListTourSlotsQueryParams.safeParse({ date: new Date(`${rawDate}T00:00:00Z`) }).success) {
    res.status(400).json({ error: "Seleziona una data valida." });
    return;
  }
  if (rawDate < nowInRome().date) {
    res.json(ListTourSlotsResponse.parse(tourTimes.map((time) => ({ time, available: false }))));
    return;
  }

  const taken = new Set(
    (sqlite.prepare(
      "SELECT time FROM prenotazioni_tour WHERE date = ? AND status != 'cancelled'",
    ).all(rawDate) as { time: string }[]).map((row) => row.time),
  );
  res.json(ListTourSlotsResponse.parse(
    tourTimes.map((time) => ({ time, available: isBookable(rawDate, time) && !taken.has(time) })),
  ));
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
    const result = sqlite.prepare(`
      INSERT INTO prenotazioni_tour
        (first_name, last_name, email, province, phone, date, time, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)
    `).run(
      firstName.trim(), lastName.trim(), email.trim().toLowerCase(), province.trim(),
      phone.trim(), dateString, time, new Date().toISOString(),
    );
    const id = Number(result.lastInsertRowid);
    const delivery: EmailDelivery = { status: "disabled", sentAt: null, error: "" };
    persistEmailDelivery("prenotazioni_tour", id, delivery);
    const booking = sqlite.prepare(`SELECT ${bookingColumns} FROM prenotazioni_tour WHERE id = ?`)
      .get(id) as TourBooking;
    // Zod validates format: date by coercing it to Date. Preserve the wire
    // contract's YYYY-MM-DD string so the calendar never receives a timestamp.
    const response = CreateTourBookingResponse.parse({
      id: booking.id,
      date: booking.date,
      time: booking.time,
      confirmationEmailStatus: booking.confirmationEmailStatus,
    });
    res.status(201).json({ ...response, date: booking.date });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Questo orario è stato appena prenotato. Scegline un altro." });
      return;
    }
    throw error;
  }
});

export default router;