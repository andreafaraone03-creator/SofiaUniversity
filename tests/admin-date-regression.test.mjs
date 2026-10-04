import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  ListAdminEnrollmentsResponse,
  ListAdminOrientationRequestsResponse,
} from "../lib/api-zod/src/generated/api.ts";
import {
  preserveAppointmentDateOnlyStrings,
  preserveEnrollmentDateOnlyStrings,
} from "../artifacts/api-server/src/lib/sofia-admin-date-response.ts";
import { formatDate } from "../artifacts/sofia-orientamento/src/lib/date-format.ts";

const requireFromApiServer = createRequire(
  new URL("../artifacts/api-server/package.json", import.meta.url),
);
const express = requireFromApiServer("express");
const cookieParser = requireFromApiServer("cookie-parser");
const esbuild = requireFromApiServer("esbuild");
const apiServerDir = path.resolve("artifacts/api-server");

test("authenticated GET /api/admin/orientation-requests preserves date-only appointment dates and null", async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "sofia-admin-date-test-"));
  const routeBuildDir = await mkdtemp(path.join(apiServerDir, ".admin-date-route-test-"));
  const environment = {
    NODE_ENV: process.env.NODE_ENV,
    SOFIA_DATABASE_URL: process.env.SOFIA_DATABASE_URL,
    SOFIA_DB_PATH: process.env.SOFIA_DB_PATH,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
  process.env.NODE_ENV = "test";
  const databasePath = path.join(tempDir, "test.sqlite");
  process.env.SOFIA_DB_PATH = databasePath;
  delete process.env.SOFIA_DATABASE_URL;
  process.env.SESSION_SECRET = "test-session-secret-for-admin-route";

  let server;
  const testDatabase = new DatabaseSync(databasePath);
  t.after(async () => {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    testDatabase.close();
    await rm(tempDir, { recursive: true, force: true });
    await rm(routeBuildDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const routeBundlePath = path.join(routeBuildDir, "admin-router.mjs");
  await esbuild.build({
    entryPoints: [path.join(apiServerDir, "src/routes/sofia-admin.ts")],
    outfile: routeBundlePath,
    bundle: true,
    platform: "node",
    format: "esm",
    banner: {
      js: "import { createRequire as __testCreateRequire } from 'node:module'; globalThis.require = __testCreateRequire(import.meta.url);",
    },
    plugins: [{
      name: "api-zod-generated-entry",
      setup(build) {
        build.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
          path: path.resolve("lib/api-zod/src/generated/api.ts"),
        }));
      },
    }],
  });
  const { default: adminRouter } = await import(pathToFileURL(routeBundlePath).href);
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", adminRouter);

  testDatabase.prepare(`
    INSERT INTO richieste_corso
      (first_name, last_name, email, province, phone, university, course_id, course_name,
       appointment_date, appointment_time, appointment_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("Ada", "Lovelace", "ada@example.com", "RM", "+393331234567",
  "Università di Roma", "informatica", "Informatica",
  "2026-03-20", "10:30", "confirmed", "2026-03-20T12:00:00.000Z");
  testDatabase.prepare(`
    INSERT INTO richieste_corso
      (first_name, last_name, email, province, phone, university, course_id, course_name,
       appointment_date, appointment_time, appointment_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("Grace", "Hopper", "grace@example.com", "MI", "+393339876543",
  "Università di Milano", "matematica", "Matematica",
  null, null, null, "2026-03-19T12:00:00.000Z");

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const setupResponse = await fetch(`${baseUrl}/api/admin/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "test-admin", password: "test-password-123" }),
  });
  assert.equal(setupResponse.status, 201);
  const sessionCookie = setupResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(sessionCookie, "admin setup should issue a session cookie");

  const response = await fetch(`${baseUrl}/api/admin/orientation-requests`, {
    headers: { cookie: sessionCookie },
  });
  assert.equal(response.status, 200);
  const requests = await response.json();
  assert.deepEqual(requests.map((request) => request.appointmentDate), [
    "2026-03-20",
    null,
  ]);
  assert.match(requests[0].appointmentDate, /^\d{4}-\d{2}-\d{2}$/);
});

test("orientation request validation and JSON serialization preserve YYYY-MM-DD appointment dates", () => {
  const storedRequest = {
    id: 17,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    province: "RM",
    phone: "+393331234567",
    university: "Università di Roma",
    courseId: "informatica",
    courseName: "Informatica",
    appointmentDate: "2026-03-20",
    appointmentTime: "10:30",
    appointmentStatus: "pending",
    meetUrl: null,
    createdAt: "2026-03-01T12:00:00.000Z",
    pipelineStatus: "new",
    enrollmentOutcome: "pending",
    adminNotes: "",
    followUpAt: null,
    confirmationEmailStatus: "not_configured",
    confirmationEmailSentAt: null,
    confirmationEmailError: "",
    cancellationEmailStatus: "not_required",
    cancellationEmailSentAt: null,
    cancellationEmailError: "",
  };

  const validated = ListAdminOrientationRequestsResponse.parse([storedRequest]);
  assert.ok(validated[0].appointmentDate instanceof Date);

  const serialized = JSON.parse(
    JSON.stringify(preserveAppointmentDateOnlyStrings(validated, [storedRequest])),
  );
  assert.equal(serialized[0].appointmentDate, "2026-03-20");
});

test("dashboard date formatter handles date-only strings and ISO timestamps as dd/mm/yyyy", () => {
  assert.equal(formatDate("2026-03-20"), "20/03/2026");
  assert.equal(formatDate("2026-03-20T23:45:00.000Z"), "20/03/2026");
});

test("enrollment date stays a calendar date from API validation through display in other time zones", () => {
  const storedEnrollment = {
    id: 22,
    orientationRequestId: null,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    university: "Università di Roma",
    courseId: "informatica",
    courseName: "Informatica",
    enrolledAt: "2026-03-20",
    commissionCents: 18000,
    commissionStatus: "paid",
    commissionPaidAt: null,
    status: "active",
    notes: "",
    createdAt: "2026-03-20T12:00:00.000Z",
  };
  const validated = ListAdminEnrollmentsResponse.parse([storedEnrollment]);
  assert.ok(validated[0].enrolledAt instanceof Date);

  const response = JSON.parse(JSON.stringify(
    preserveEnrollmentDateOnlyStrings(validated, [storedEnrollment]),
  ));
  assert.equal(response[0].enrolledAt, "2026-03-20");

  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ["America/Los_Angeles", "Pacific/Honolulu", "Europe/Rome"]) {
      process.env.TZ = timezone;
      assert.equal(formatDate(response[0].enrolledAt), "20/03/2026", timezone);
      assert.equal(formatDate(validated[0].enrolledAt), "20/03/2026", timezone);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("dashboard date formatter safely returns an em dash for invalid dates", () => {
  assert.doesNotThrow(() => formatDate("not-a-date"));
  assert.equal(formatDate("not-a-date"), "—");
  assert.equal(formatDate("2026-02-30"), "—");
  assert.equal(formatDate(new Date(Number.NaN)), "—");
});