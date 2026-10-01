import assert from "node:assert/strict";
import test from "node:test";
import { ListAdminOrientationRequestsResponse } from "../lib/api-zod/src/generated/api.ts";
import { preserveAppointmentDateOnlyStrings } from "../artifacts/api-server/src/lib/sofia-admin-date-response.ts";
import { formatDate } from "../artifacts/sofia-orientamento/src/lib/date-format.ts";

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

test("dashboard date formatter safely returns an em dash for invalid dates", () => {
  assert.doesNotThrow(() => formatDate("not-a-date"));
  assert.equal(formatDate("not-a-date"), "—");
  assert.equal(formatDate("2026-02-30"), "—");
  assert.equal(formatDate(new Date(Number.NaN)), "—");
});