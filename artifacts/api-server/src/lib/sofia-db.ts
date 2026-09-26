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
    created_at TEXT NOT NULL
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
    created_at TEXT NOT NULL
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
`);

export const courses = JSON.parse(
  readFileSync(path.join(dataDir, "courses.json"), "utf8"),
) as Course[];

export const orientationColumns = `
  id, first_name AS firstName, last_name AS lastName, email, province, phone,
  university, course_id AS courseId, course_name AS courseName,
  created_at AS createdAt
`;

export const bookingColumns = `
  id, first_name AS firstName, last_name AS lastName, email, province, phone,
  date, time, status, created_at AS createdAt
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