import { randomUUID } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { getGoogleAccessToken, usesGoogleOAuth } from "./sofia-google-oauth";
import { calendarDeleteEventPath } from "./sofia-calendar-paths";

const calendarId = "primary";
const timezone = "Europe/Rome";

type BusyRange = { start: string; end: string };
type CalendarProxyInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type CalendarEvent = {
  id?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
};

export type AppointmentDetails = {
  kind: "consultation" | "tour";
  firstName: string;
  lastName: string;
  email: string;
  date: string;
  time: string;
  university?: string;
  courseName?: string;
};

export type CreatedMeet = {
  eventId: string;
  meetUrl: string;
};

export class CalendarIntegrationError extends Error {
  constructor(message = "Google Calendar non disponibile.") {
    super(message);
    this.name = "CalendarIntegrationError";
  }
}

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (![year, month, day].every(Number.isInteger)) {
    throw new CalendarIntegrationError("Data non valida.");
  }
  return { year, month, day };
}

function nextRomeDate(date: string): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function romeOffset(date: string, time: string): string {
  const { year, month, day } = dateParts(date);
  const [hour, minute] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const localParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(wallClockAsUtc));
  const part = (type: string) => Number(localParts.find((item) => item.type === type)?.value);
  const localWallClockAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  const offsetMinutes = Math.round((localWallClockAsUtc - wallClockAsUtc) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

export function romeDateTime(date: string, time: string): string {
  return `${date}T${time}:00${romeOffset(date, time)}`;
}

function appointmentEndTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return `${String(hour + 1).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

async function calendarRequest(path: string, init: CalendarProxyInit): Promise<Response> {
  if (usesGoogleOAuth()) {
    try {
      const accessToken = await getGoogleAccessToken();
      return await fetch(`https://www.googleapis.com${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      throw new CalendarIntegrationError();
    }
  }

  try {
    return await new ReplitConnectors().proxy("google-calendar", path, init);
  } catch {
    throw new CalendarIntegrationError();
  }
}

export async function getCalendarBusyRanges(date: string): Promise<BusyRange[]> {
  const nextDate = nextRomeDate(date);
  const response = await calendarRequest("/calendar/v3/freeBusy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: romeDateTime(date, "00:00"),
      timeMax: romeDateTime(nextDate, "00:00"),
      timeZone: timezone,
      items: [{ id: calendarId }],
    }),
  });
  if (!response.ok) throw new CalendarIntegrationError();

  const result = await response.json() as {
    calendars?: Record<string, { busy?: BusyRange[]; errors?: unknown[] }>;
  };
  const calendar = result.calendars?.[calendarId];
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) {
    throw new CalendarIntegrationError();
  }
  return calendar.busy;
}

export function intervalIsBusy(date: string, time: string, busyRanges: BusyRange[]): boolean {
  const start = Date.parse(romeDateTime(date, time));
  const end = Date.parse(romeDateTime(date, appointmentEndTime(time)));
  return busyRanges.some((range) => {
    const busyStart = Date.parse(range.start);
    const busyEnd = Date.parse(range.end);
    return Number.isFinite(busyStart) && Number.isFinite(busyEnd) &&
      start < busyEnd && end > busyStart;
  });
}

function eventMeetUrl(event: CalendarEvent): string | null {
  return event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null;
}

async function readCalendarEvent(eventId: string): Promise<CalendarEvent | null> {
  const response = await calendarRequest(
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "GET" },
  );
  if (!response.ok) return null;
  return await response.json() as CalendarEvent;
}

export async function createMeetEvent(appointment: AppointmentDetails): Promise<CreatedMeet> {
  const summary = appointment.kind === "consultation"
    ? `Consulenza universitaria · ${appointment.firstName} ${appointment.lastName}`
    : `Tour della piattaforma · ${appointment.firstName} ${appointment.lastName}`;
  const description = appointment.kind === "consultation"
    ? `Consulenza universitaria con Sofia.\nAteneo: ${appointment.university ?? ""}\nCorso: ${appointment.courseName ?? ""}`
    : "Tour online della piattaforma con Sofia.";
  const response = await calendarRequest(
    `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=none&conferenceDataVersion=1`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: romeDateTime(appointment.date, appointment.time), timeZone: timezone },
        end: { dateTime: romeDateTime(appointment.date, appointmentEndTime(appointment.time)), timeZone: timezone },
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    },
  );
  if (!response.ok) throw new CalendarIntegrationError();
  const created = await response.json() as CalendarEvent;
  if (!created.id) throw new CalendarIntegrationError();

  let event = created;
  for (let attempt = 0; attempt < 4 && !eventMeetUrl(event); attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 350));
    event = await readCalendarEvent(created.id) ?? event;
  }
  const meetUrl = eventMeetUrl(event);
  if (!meetUrl) {
    try {
      await deleteMeetEvent(created.id);
    } catch {
      // Keep the original error; the admin can reconcile the event from Calendar.
    }
    throw new CalendarIntegrationError();
  }
  return { eventId: created.id, meetUrl };
}

export async function deleteMeetEvent(eventId: string): Promise<void> {
  const response = await calendarRequest(
    calendarDeleteEventPath(calendarId, eventId),
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new CalendarIntegrationError();
  }
}
