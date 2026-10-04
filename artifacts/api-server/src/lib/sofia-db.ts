import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createPool, type PoolClient, type QueryResult, type QueryResultRow } from "@workspace/db/pool";

export type Course = {
  id: string;
  university: string;
  category: string;
  name: string;
  duration: string;
  source: string;
};

export type CancellationEmailStatus =
  | "not_required"
  | "pending"
  | "sent"
  | "failed"
  | "not_configured"
  | "disabled";

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
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentStatus: "pending" | "confirmed" | "cancelled" | null;
  meetUrl: string | null;
  createdAt: string;
  pipelineStatus: "new" | "contacted" | "considering" | "enrolled" | "closed";
  enrollmentOutcome: "pending" | "enrolled" | "not_enrolled";
  adminNotes: string;
  followUpAt: string | null;
  confirmationEmailStatus: "sent" | "failed" | "not_configured" | "disabled";
  confirmationEmailSentAt: string | null;
  confirmationEmailError: string;
  cancellationEmailStatus: CancellationEmailStatus;
  cancellationEmailSentAt: string | null;
  cancellationEmailError: string;
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
  meetUrl: string | null;
  status: "confirmed" | "cancelled" | "completed";
  createdAt: string;
  adminNotes: string;
  followUpAt: string | null;
  confirmationEmailStatus: "sent" | "failed" | "not_configured" | "disabled";
  confirmationEmailSentAt: string | null;
  confirmationEmailError: string;
  cancellationEmailStatus: CancellationEmailStatus;
  cancellationEmailSentAt: string | null;
  cancellationEmailError: string;
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
  adminNotificationEmail: string | null;
  senderName: string;
  sendOrientationConfirmations: boolean;
  sendTourConfirmations: boolean;
  adminTourEmailSubject: string;
  adminTourEmailBody: string;
  adminConsultationEmailSubject: string;
  adminConsultationEmailBody: string;
};

const sofiaDatabaseUrl = process.env.SOFIA_DATABASE_URL?.trim();
if (process.env.NODE_ENV === "production" && !sofiaDatabaseUrl) {
  throw new Error("SOFIA_DATABASE_URL must be configured in production; refusing to fall back to SQLite.");
}
const usePostgres = Boolean(sofiaDatabaseUrl);
const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const databasePath = process.env.SOFIA_DB_PATH ?? path.join(dataDir, "sofia.sqlite");
if (!usePostgres) mkdirSync(path.dirname(databasePath), { recursive: true });

// Kept for development compatibility. In PostgreSQL mode this is deliberately
// only a type-compatible guard: no SQLite file is opened or created.
export const sqlite = usePostgres
  ? ({} as DatabaseSync)
  : new DatabaseSync(databasePath);
export const sofiaIsPostgres = usePostgres;

if (!usePostgres) {
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
    appointment_date TEXT,
    appointment_time TEXT,
    appointment_status TEXT CHECK (appointment_status IN ('pending', 'confirmed', 'cancelled')),
    google_calendar_event_id TEXT,
    meet_url TEXT,
    created_at TEXT NOT NULL,
    pipeline_status TEXT NOT NULL DEFAULT 'new'
      CHECK (pipeline_status IN ('new', 'contacted', 'considering', 'enrolled', 'closed')),
    enrollment_outcome TEXT NOT NULL DEFAULT 'pending'
      CHECK (enrollment_outcome IN ('pending', 'enrolled', 'not_enrolled')),
    admin_notes TEXT NOT NULL DEFAULT '',
    follow_up_at TEXT,
    confirmation_email_status TEXT NOT NULL DEFAULT 'not_configured'
      CHECK (confirmation_email_status IN ('sent', 'failed', 'not_configured', 'disabled')),
    confirmation_email_sent_at TEXT,
    confirmation_email_error TEXT NOT NULL DEFAULT '',
    cancellation_email_status TEXT NOT NULL DEFAULT 'not_required'
      CHECK (cancellation_email_status IN ('not_required', 'pending', 'sent', 'failed', 'not_configured', 'disabled')),
    cancellation_email_sent_at TEXT,
    cancellation_email_error TEXT NOT NULL DEFAULT ''
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
    google_calendar_event_id TEXT,
    meet_url TEXT,
    status TEXT NOT NULL DEFAULT 'confirmed'
      CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    created_at TEXT NOT NULL,
    admin_notes TEXT NOT NULL DEFAULT '',
    follow_up_at TEXT,
    confirmation_email_status TEXT NOT NULL DEFAULT 'not_configured'
      CHECK (confirmation_email_status IN ('sent', 'failed', 'not_configured', 'disabled')),
    confirmation_email_sent_at TEXT,
    confirmation_email_error TEXT NOT NULL DEFAULT '',
    cancellation_email_status TEXT NOT NULL DEFAULT 'not_required'
      CHECK (cancellation_email_status IN ('not_required', 'pending', 'sent', 'failed', 'not_configured', 'disabled')),
    cancellation_email_sent_at TEXT,
    cancellation_email_error TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX IF NOT EXISTS tour_active_slot
    ON prenotazioni_tour(date, time) WHERE status != 'cancelled';
  CREATE TABLE IF NOT EXISTS appointment_slots (
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    booking_type TEXT NOT NULL CHECK (booking_type IN ('consultation', 'tour')),
    booking_id INTEGER NOT NULL,
    PRIMARY KEY (date, time),
    UNIQUE (booking_type, booking_id)
  );
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
    admin_notification_email TEXT,
    sender_name TEXT NOT NULL DEFAULT 'Sofia',
    send_orientation_confirmations INTEGER NOT NULL DEFAULT 1,
    send_tour_confirmations INTEGER NOT NULL DEFAULT 1,
    admin_tour_email_subject TEXT NOT NULL DEFAULT '',
    admin_tour_email_body TEXT NOT NULL DEFAULT '',
    admin_consultation_email_subject TEXT NOT NULL DEFAULT '',
    admin_consultation_email_body TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sofia_google_calendar_credentials (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    encrypted_refresh_token TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    connected_at TEXT NOT NULL,
    account_email TEXT
  );
  CREATE TABLE IF NOT EXISTS sofia_google_calendar_oauth_states (
    state_hash TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS google_oauth_state_expiration
    ON sofia_google_calendar_oauth_states(expires_at);
`);
}

export const sofiaPool = sofiaDatabaseUrl
  ? createPool(sofiaDatabaseUrl, 10)
  : null;

/** SQL helper for Sofia's PostgreSQL backend. Never consults DATABASE_URL. */
export async function sofiaQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  if (!sofiaPool) throw new Error("Sofia PostgreSQL storage is not configured.");
  return sofiaPool.query<T>(text, values);
}

export async function withSofiaTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!sofiaPool) throw new Error("Sofia PostgreSQL storage is not configured.");
  const client = await sofiaPool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  finally { client.release(); }
}

function pgSql(sql: string): string {
  let index = 0;
  // PostgreSQL folds unquoted camelCase aliases to lowercase, unlike SQLite.
  // Preserve the names expected by API response schemas.
  return sql
    .replace(/\bAS\s+([a-z_][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*)\b/g, (_match, alias: string) => `AS "${alias}"`)
    .replace(/\?/g, () => `$${++index}`);
}

export type SofiaResult = { changes: number; lastInsertRowid?: number };
export type SofiaExecutor = {
  get<T extends QueryResultRow = QueryResultRow>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T extends QueryResultRow = QueryResultRow>(sql: string, ...params: unknown[]): Promise<T[]>;
  run(sql: string, ...params: unknown[]): Promise<SofiaResult>;
};

function executor(client?: PoolClient): SofiaExecutor {
  const postgres = client ?? sofiaPool;
  return {
    async get<T extends QueryResultRow>(sql: string, ...params: unknown[]) {
      if (postgres) return (await postgres.query<T>(pgSql(sql), params)).rows[0];
      return sqlite.prepare(sql).get(...params as any[]) as T | undefined;
    },
    async all<T extends QueryResultRow>(sql: string, ...params: unknown[]) {
      if (postgres) return (await postgres.query<T>(pgSql(sql), params)).rows;
      return sqlite.prepare(sql).all(...params as any[]) as T[];
    },
    async run(sql, ...params) {
      if (postgres) {
        const result = await postgres.query(pgSql(sql), params);
        return { changes: result.rowCount ?? 0, lastInsertRowid: result.rows[0]?.id };
      }
      const result = sqlite.prepare(sql).run(...params as any[]);
      return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
    },
  };
}

export const sofiaStorage: SofiaExecutor = executor();
export async function sofiaTransaction<T>(callback: (tx: SofiaExecutor) => Promise<T>): Promise<T> {
  if (sofiaPool) return withSofiaTransaction(async (client) => callback(executor(client)));
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    const result = await callback(executor());
    sqlite.exec("COMMIT");
    return result;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

async function initializePostgres(): Promise<void> {
  if (!sofiaPool) return;
  // This is intentionally self-contained and idempotent. It is not a copy of
  // the SQLite file: PostgreSQL gets a native schema with equivalent fields.
  await sofiaPool.query(`
    CREATE TABLE IF NOT EXISTS richieste_corso (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL,
      province text NOT NULL, phone text NOT NULL, university text NOT NULL,
      course_id text NOT NULL, course_name text NOT NULL, appointment_date text,
      appointment_time text, appointment_status text CHECK (appointment_status IN ('pending','confirmed','cancelled')),
      google_calendar_event_id text, meet_url text, created_at text NOT NULL,
      pipeline_status text NOT NULL DEFAULT 'new' CHECK (pipeline_status IN ('new','contacted','considering','enrolled','closed')),
      enrollment_outcome text NOT NULL DEFAULT 'pending' CHECK (enrollment_outcome IN ('pending','enrolled','not_enrolled')),
      admin_notes text NOT NULL DEFAULT '', follow_up_at text,
      confirmation_email_status text NOT NULL DEFAULT 'not_configured' CHECK (confirmation_email_status IN ('sent','failed','not_configured','disabled')),
       confirmation_email_sent_at text, confirmation_email_error text NOT NULL DEFAULT '',
       cancellation_email_status text NOT NULL DEFAULT 'not_required' CHECK (cancellation_email_status IN ('not_required','pending','sent','failed','not_configured','disabled')),
       cancellation_email_sent_at text, cancellation_email_error text NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS prenotazioni_tour (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL,
      province text NOT NULL, phone text NOT NULL, date text NOT NULL, time text NOT NULL,
      google_calendar_event_id text, meet_url text,
      status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed')),
      created_at text NOT NULL, admin_notes text NOT NULL DEFAULT '', follow_up_at text,
      confirmation_email_status text NOT NULL DEFAULT 'not_configured' CHECK (confirmation_email_status IN ('sent','failed','not_configured','disabled')),
       confirmation_email_sent_at text, confirmation_email_error text NOT NULL DEFAULT '',
       cancellation_email_status text NOT NULL DEFAULT 'not_required' CHECK (cancellation_email_status IN ('not_required','pending','sent','failed','not_configured','disabled')),
       cancellation_email_sent_at text, cancellation_email_error text NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS appointment_slots (
      date text NOT NULL, time text NOT NULL,
      booking_type text NOT NULL CHECK (booking_type IN ('consultation','tour')),
      booking_id integer NOT NULL, PRIMARY KEY (date,time),
      UNIQUE (booking_type,booking_id)
    );
    CREATE TABLE IF NOT EXISTS utenti_admin (
      id integer PRIMARY KEY CHECK (id=1), username text NOT NULL UNIQUE,
      password_hash text NOT NULL, password_salt text NOT NULL, created_at text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS iscrizioni_universita (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      orientation_request_id integer REFERENCES richieste_corso(id) ON DELETE SET NULL,
      first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL,
      university text NOT NULL, course_id text NOT NULL, course_name text NOT NULL,
      enrolled_at text NOT NULL, commission_cents integer NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
      commission_status text NOT NULL DEFAULT 'pending' CHECK (commission_status IN ('pending','paid')),
      commission_paid_at text, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn')),
      notes text NOT NULL DEFAULT '', created_at text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS impostazioni_email (
      id integer PRIMARY KEY CHECK (id=1), sender_email text, admin_notification_email text,
      sender_name text NOT NULL DEFAULT 'Sofia',
      send_orientation_confirmations integer NOT NULL DEFAULT 1,
      send_tour_confirmations integer NOT NULL DEFAULT 1,
      admin_tour_email_subject text NOT NULL DEFAULT '',
      admin_tour_email_body text NOT NULL DEFAULT '',
      admin_consultation_email_subject text NOT NULL DEFAULT '',
      admin_consultation_email_body text NOT NULL DEFAULT '',
      updated_at text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sofia_google_calendar_credentials (
      id integer PRIMARY KEY CHECK (id=1),
      encrypted_refresh_token text NOT NULL,
      iv text NOT NULL,
      auth_tag text NOT NULL,
      connected_at text NOT NULL,
      account_email text
    );
    CREATE TABLE IF NOT EXISTS sofia_google_calendar_oauth_states (
      state_hash text PRIMARY KEY,
      expires_at text NOT NULL
    );
    CREATE INDEX IF NOT EXISTS google_oauth_state_expiration
      ON sofia_google_calendar_oauth_states(expires_at);
    ALTER TABLE impostazioni_email ADD COLUMN IF NOT EXISTS admin_notification_email text;
    ALTER TABLE impostazioni_email ADD COLUMN IF NOT EXISTS admin_tour_email_subject text NOT NULL DEFAULT '';
    ALTER TABLE impostazioni_email ADD COLUMN IF NOT EXISTS admin_tour_email_body text NOT NULL DEFAULT '';
    ALTER TABLE impostazioni_email ADD COLUMN IF NOT EXISTS admin_consultation_email_subject text NOT NULL DEFAULT '';
    ALTER TABLE impostazioni_email ADD COLUMN IF NOT EXISTS admin_consultation_email_body text NOT NULL DEFAULT '';
    ALTER TABLE sofia_google_calendar_credentials ADD COLUMN IF NOT EXISTS account_email text;
    ALTER TABLE richieste_corso ADD COLUMN IF NOT EXISTS cancellation_email_status text NOT NULL DEFAULT 'not_required';
    ALTER TABLE richieste_corso ADD COLUMN IF NOT EXISTS cancellation_email_sent_at text;
    ALTER TABLE richieste_corso ADD COLUMN IF NOT EXISTS cancellation_email_error text NOT NULL DEFAULT '';
    ALTER TABLE prenotazioni_tour ADD COLUMN IF NOT EXISTS cancellation_email_status text NOT NULL DEFAULT 'not_required';
    ALTER TABLE prenotazioni_tour ADD COLUMN IF NOT EXISTS cancellation_email_sent_at text;
    ALTER TABLE prenotazioni_tour ADD COLUMN IF NOT EXISTS cancellation_email_error text NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IF NOT EXISTS tour_active_slot ON prenotazioni_tour(date,time) WHERE status <> 'cancelled';
    CREATE UNIQUE INDEX IF NOT EXISTS consultation_active_slot ON richieste_corso(appointment_date,appointment_time)
      WHERE appointment_status IN ('pending','confirmed');
    CREATE INDEX IF NOT EXISTS enrollment_date_idx ON iscrizioni_universita(enrolled_at DESC,id DESC);
  `);
}

// Top-level initialization means importing the API cannot proceed until the
// selected Sofia database has its schema.
await initializePostgres();

if (!usePostgres) {
// Additive migration for existing SQLite files; it keeps all saved requests
// and bookings while adding the new CRM and email-tracking fields.
function ensureColumn(table: string, column: string, definition: string) {
  const existing = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!existing.some((item) => item.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("richieste_corso", "pipeline_status", "TEXT NOT NULL DEFAULT 'new'");
ensureColumn("richieste_corso", "enrollment_outcome", "TEXT NOT NULL DEFAULT 'pending'");
ensureColumn("richieste_corso", "admin_notes", "TEXT NOT NULL DEFAULT ''");
ensureColumn("richieste_corso", "follow_up_at", "TEXT");
ensureColumn("richieste_corso", "confirmation_email_status", "TEXT NOT NULL DEFAULT 'not_configured'");
ensureColumn("richieste_corso", "confirmation_email_sent_at", "TEXT");
ensureColumn("richieste_corso", "confirmation_email_error", "TEXT NOT NULL DEFAULT ''");
ensureColumn("richieste_corso", "cancellation_email_status", "TEXT NOT NULL DEFAULT 'not_required'");
ensureColumn("richieste_corso", "cancellation_email_sent_at", "TEXT");
ensureColumn("richieste_corso", "cancellation_email_error", "TEXT NOT NULL DEFAULT ''");
ensureColumn("richieste_corso", "appointment_date", "TEXT");
ensureColumn("richieste_corso", "appointment_time", "TEXT");
ensureColumn("richieste_corso", "appointment_status", "TEXT");
ensureColumn("richieste_corso", "google_calendar_event_id", "TEXT");
ensureColumn("richieste_corso", "meet_url", "TEXT");
ensureColumn("prenotazioni_tour", "admin_notes", "TEXT NOT NULL DEFAULT ''");
ensureColumn("prenotazioni_tour", "follow_up_at", "TEXT");
ensureColumn("prenotazioni_tour", "confirmation_email_status", "TEXT NOT NULL DEFAULT 'not_configured'");
ensureColumn("prenotazioni_tour", "confirmation_email_sent_at", "TEXT");
ensureColumn("prenotazioni_tour", "confirmation_email_error", "TEXT NOT NULL DEFAULT ''");
ensureColumn("prenotazioni_tour", "cancellation_email_status", "TEXT NOT NULL DEFAULT 'not_required'");
ensureColumn("prenotazioni_tour", "cancellation_email_sent_at", "TEXT");
ensureColumn("prenotazioni_tour", "cancellation_email_error", "TEXT NOT NULL DEFAULT ''");
ensureColumn("prenotazioni_tour", "google_calendar_event_id", "TEXT");
ensureColumn("prenotazioni_tour", "meet_url", "TEXT");
ensureColumn("impostazioni_email", "admin_notification_email", "TEXT");
ensureColumn("impostazioni_email", "admin_tour_email_subject", "TEXT NOT NULL DEFAULT ''");
ensureColumn("impostazioni_email", "admin_tour_email_body", "TEXT NOT NULL DEFAULT ''");
ensureColumn("impostazioni_email", "admin_consultation_email_subject", "TEXT NOT NULL DEFAULT ''");
ensureColumn("impostazioni_email", "admin_consultation_email_body", "TEXT NOT NULL DEFAULT ''");
ensureColumn("sofia_google_calendar_credentials", "account_email", "TEXT");

sqlite.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS consultation_active_slot
    ON richieste_corso(appointment_date, appointment_time)
    WHERE appointment_status IN ('pending', 'confirmed');
  INSERT OR IGNORE INTO appointment_slots (date, time, booking_type, booking_id)
    SELECT date, time, 'tour', id FROM prenotazioni_tour WHERE status != 'cancelled';
  INSERT OR IGNORE INTO appointment_slots (date, time, booking_type, booking_id)
    SELECT appointment_date, appointment_time, 'consultation', id
    FROM richieste_corso
    WHERE appointment_status IN ('pending', 'confirmed')
      AND appointment_date IS NOT NULL AND appointment_time IS NOT NULL;
`);

sqlite.exec(`
  UPDATE richieste_corso
  SET enrollment_outcome = 'enrolled'
  WHERE enrollment_outcome = 'pending'
    AND (
      pipeline_status = 'enrolled'
      OR EXISTS (
        SELECT 1 FROM iscrizioni_universita
        WHERE iscrizioni_universita.orientation_request_id = richieste_corso.id
      )
    )
`);

}

export const courses = JSON.parse(
  readFileSync(path.join(dataDir, "courses.json"), "utf8"),
) as Course[];

export const orientationColumns = `
  id, first_name AS "firstName", last_name AS "lastName", email, province, phone,
  university, course_id AS "courseId", course_name AS "courseName", created_at AS "createdAt",
  appointment_date AS "appointmentDate", appointment_time AS "appointmentTime",
  appointment_status AS "appointmentStatus", meet_url AS "meetUrl",
  pipeline_status AS "pipelineStatus", enrollment_outcome AS "enrollmentOutcome",
  admin_notes AS "adminNotes", follow_up_at AS "followUpAt",
  confirmation_email_status AS "confirmationEmailStatus",
  confirmation_email_sent_at AS "confirmationEmailSentAt",
  confirmation_email_error AS "confirmationEmailError",
  cancellation_email_status AS "cancellationEmailStatus",
  cancellation_email_sent_at AS "cancellationEmailSentAt",
  cancellation_email_error AS "cancellationEmailError"
`;

export const bookingColumns = `
  id, first_name AS "firstName", last_name AS "lastName", email, province, phone,
  date, time, meet_url AS "meetUrl", status, created_at AS "createdAt", admin_notes AS "adminNotes",
  follow_up_at AS "followUpAt", confirmation_email_status AS "confirmationEmailStatus",
  confirmation_email_sent_at AS "confirmationEmailSentAt",
  confirmation_email_error AS "confirmationEmailError",
  cancellation_email_status AS "cancellationEmailStatus",
  cancellation_email_sent_at AS "cancellationEmailSentAt",
  cancellation_email_error AS "cancellationEmailError"
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
