import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

export type Course = {
  id: string;
  university: string;
  category: string;
  name: string;
  duration: string;
  source: string;
};

export type OrientationRequest = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  province: string;
  phone: string;
  university: string;
  courseId: string;
  courseName: string;
  createdAt: string;
  pipelineStatus: "new" | "contacted" | "considering" | "enrolled" | "closed";
  adminNotes: string;
  followUpAt: string | null;
  confirmationEmailStatus: "sent" | "failed" | "not_configured" | "disabled";
  confirmationEmailSentAt: string | null;
  confirmationEmailError: string;
};

export type TourBooking = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  province: string;
  phone: string;
  date: string;
  time: string;
  status: "confirmed" | "cancelled" | "completed";
  createdAt: string;
  adminNotes: string;
  followUpAt: string | null;
  confirmationEmailStatus: "sent" | "failed" | "not_configured" | "disabled";
  confirmationEmailSentAt: string | null;
  confirmationEmailError: string;
};

export type Enrollment = {
  id: number;
  orientationRequestId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  university: string;
  courseId: string;
  courseName: string;
  enrolledAt: string;
  commissionCents: number;
  commissionStatus: "pending" | "paid";
  commissionPaidAt: string | null;
  status: "active" | "withdrawn";
  notes: string;
  createdAt: string;
};

export type EmailSettings = {
  senderEmail: string | null;
  senderName: string;
  sendOrientationConfirmations: boolean;
  sendTourConfirmations: boolean;
};

// The server bundle lives in dist/index.mjs, next to the data directory.
const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const databasePath = process.env.SOFIA_DB_PATH ?? path.join(dataDir, "sofia.sqlite");
mkdirSync(path.dirname(databasePath), { recursive: true });

export const sqlite = new DatabaseSync(databasePath);
sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS richieste_corso (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    province TEXT NOT NULL,
    phone TEXT NOT NULL,
    university TEXT NOT NULL,
    course_id TEXT NOT NULL,
    course_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    pipeline_status TEXT NOT NULL DEFAULT 'new'
      CHECK (pipeline_status IN ('new', 'contacted', 'considering', 'enrolled', 'closed')),
    admin_notes TEXT NOT NULL DEFAULT '',
    follow_up_at TEXT,
    confirmation_email_status TEXT NOT NULL DEFAULT 'not_configured'
      CHECK (confirmation_email_status IN ('sent', 'failed', 'not_configured', 'disabled')),
    confirmation_email_sent_at TEXT,
    confirmation_email_error TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS prenotazioni_tour (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    province TEXT NOT NULL,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed'
      CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    created_at TEXT NOT NULL,
    admin_notes TEXT NOT NULL DEFAULT '',
    follow_up_at TEXT,
    confirmation_email_status TEXT NOT NULL DEFAULT 'not_configured'
      CHECK (confirmation_email_status IN ('sent', 'failed', 'not_configured', 'disabled')),
    confirmation_email_sent_at TEXT,
    confirmation_email_error TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX IF NOT EXISTS tour_active_slot
    ON prenotazioni_tour(date, time) WHERE status != 'cancelled';
  CREATE TABLE IF NOT EXISTS utenti_admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS iscrizioni_universita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orientation_request_id INTEGER REFERENCES richieste_corso(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    university TEXT NOT NULL,
    course_id TEXT NOT NULL,
    course_name TEXT NOT NULL,
    enrolled_at TEXT NOT NULL,
    commission_cents INTEGER NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
    commission_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (commission_status IN ('pending', 'paid')),
    commission_paid_at TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS enrollment_date_idx
    ON iscrizioni_universita(enrolled_at DESC, id DESC);
  CREATE TABLE IF NOT EXISTS impostazioni_email (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    sender_email TEXT,
    sender_name TEXT NOT NULL DEFAULT 'Sofia',
    send_orientation_confirmations INTEGER NOT NULL DEFAULT 0,
    send_tour_confirmations INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );
`);

// Additive migration for existing SQLite files; it keeps all saved requests
// and bookings while adding the new CRM and email-tracking fields.
function ensureColumn(table: string, column: string, definition: string) {
  const existing = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!existing.some((item) => item.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("richieste_corso", "pipeline_status", "TEXT NOT NULL DEFAULT 'new'");
ensureColumn("richieste_corso", "admin_notes", "TEXT NOT NULL DEFAULT ''");
ensureColumn("richieste_corso", "follow_up_at", "TEXT");
ensureColumn("richieste_corso", "confirmation_email_status", "TEXT NOT NULL DEFAULT 'not_configured'");
ensureColumn("richieste_corso", "confirmation_email_sent_at", "TEXT");
ensureColumn("richieste_corso", "confirmation_email_error", "TEXT NOT NULL DEFAULT ''");
ensureColumn("prenotazioni_tour", "admin_notes", "TEXT NOT NULL DEFAULT ''");
ensureColumn("prenotazioni_tour", "follow_up_at", "TEXT");
ensureColumn("prenotazioni_tour", "confirmation_email_status", "TEXT NOT NULL DEFAULT 'not_configured'");
ensureColumn("prenotazioni_tour", "confirmation_email_sent_at", "TEXT");
ensureColumn("prenotazioni_tour", "confirmation_email_error", "TEXT NOT NULL DEFAULT ''");

export const courses = JSON.parse(
  readFileSync(path.join(dataDir, "courses.json"), "utf8"),
) as Course[];

export const orientationColumns = `
  id, first_name AS firstName, last_name AS lastName, email, province, phone,
  university, course_id AS courseId, course_name AS courseName, created_at AS createdAt,
  pipeline_status AS pipelineStatus, admin_notes AS adminNotes, follow_up_at AS followUpAt,
  confirmation_email_status AS confirmationEmailStatus,
  confirmation_email_sent_at AS confirmationEmailSentAt,
  confirmation_email_error AS confirmationEmailError
`;

export const bookingColumns = `
  id, first_name AS firstName, last_name AS lastName, email, province, phone,
  date, time, status, created_at AS createdAt, admin_notes AS adminNotes,
  follow_up_at AS followUpAt, confirmation_email_status AS confirmationEmailStatus,
  confirmation_email_sent_at AS confirmationEmailSentAt,
  confirmation_email_error AS confirmationEmailError
`;

export const enrollmentColumns = `
  id, orientation_request_id AS orientationRequestId,
  first_name AS firstName, last_name AS lastName, email, university,
  course_id AS courseId, course_name AS courseName, enrolled_at AS enrolledAt,
  commission_cents AS commissionCents, commission_status AS commissionStatus,
  commission_paid_at AS commissionPaidAt, status, notes, created_at AS createdAt
`;

export function nowInRome() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const time = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return { date, time };
}

export const tourTimes = Array.from({ length: 12 }, (_, i) =>
  `${String(i + 9).padStart(2, "0")}:00`,
);

export function isBookable(date: string, time: string): boolean {
  const today = nowInRome();
  return tourTimes.includes(time) && (date > today.date || (date === today.date && time > today.time));
}