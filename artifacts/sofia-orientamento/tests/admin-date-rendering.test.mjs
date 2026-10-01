import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListAdminOrientationRequestsResponse } from "../../../lib/api-zod/src/generated/api.ts";
import { preserveAppointmentDateOnlyStrings } from "../../api-server/src/lib/sofia-admin-date-response.ts";
import { OrientationRequestDateCell } from "../src/components/orientation-request-date-cell.ts";
import { createMeetAccountChooserUrl } from "../src/lib/meet-account-link.ts";
import { formatDate } from "../src/lib/date-format.ts";

function renderAppointmentCell(item, adminNotificationEmail = null) {
  return renderToStaticMarkup(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        createElement("tr", null, createElement(OrientationRequestDateCell, { item, adminNotificationEmail })),
      ),
    ),
  );
}

const fixture = {
  id: 17,
  createdAt: "2026-03-01T12:00:00.000Z",
  appointmentDate: "2026-03-20",
  appointmentTime: "10:30",
  appointmentStatus: "confirmed",
  meetUrl: null,
};

test("admin request table renders a date-only appointment with its time", () => {
  const markup = renderAppointmentCell(fixture);

  assert.match(markup, /<table>/);
  assert.match(markup, /20\/03\/2026 · 10:30/);
});

test("admin request table renders an invalid appointment date safely", () => {
  assert.doesNotThrow(() => renderAppointmentCell({ ...fixture, appointmentDate: "not-a-date" }));
  const markup = renderAppointmentCell({ ...fixture, appointmentDate: "not-a-date" });

  assert.match(markup, /— · 10:30/);
  assert.doesNotMatch(markup, /Invalid Date/);
});

test("admin request table keeps a valid appointment visible when createdAt is invalid", () => {
  const item = { ...fixture, createdAt: "not-a-timestamp" };
  assert.doesNotThrow(() => renderAppointmentCell(item));
  const markup = renderAppointmentCell(item);

  assert.match(markup, /<span class="whitespace-nowrap">—<\/span>/);
  assert.match(markup, /20\/03\/2026 · 10:30/);
});

test("admin request table clearly separates requests without appointments from cancelled ones", () => {
  const noAppointment = renderAppointmentCell({
    ...fixture,
    appointmentDate: null,
    appointmentTime: null,
    appointmentStatus: null,
    meetUrl: null,
  });
  const cancelled = renderAppointmentCell({
    ...fixture,
    appointmentDate: null,
    appointmentTime: null,
    appointmentStatus: "cancelled",
    meetUrl: null,
  });

  assert.match(noAppointment, /Nessun appuntamento programmato/);
  assert.doesNotMatch(noAppointment, /Appuntamento annullato/);
  assert.match(cancelled, /Appuntamento annullato/);
  assert.doesNotMatch(cancelled, /Nessun appuntamento programmato/);
});

test("server date validation through dashboard rendering preserves the appointment day across time zones", () => {
  const storedRequest = {
    ...fixture,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    province: "RM",
    phone: "+393331234567",
    university: "Università di Roma",
    courseId: "informatica",
    courseName: "Informatica",
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

  const response = JSON.parse(JSON.stringify(
    preserveAppointmentDateOnlyStrings(validated, [storedRequest]),
  ));
  assert.equal(response[0].appointmentDate, "2026-03-20");

  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of [
      "America/Los_Angeles",
      "Pacific/Honolulu",
      "Europe/Rome",
      "Pacific/Kiritimati",
    ]) {
      process.env.TZ = timezone;
      assert.equal(formatDate(response[0].appointmentDate), "20/03/2026", timezone);
      assert.match(renderAppointmentCell(response[0]), /20\/03\/2026 · 10:30/, timezone);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("Meet links select the configured Google account and keep the original destination", () => {
  const meetUrl = "https://meet.google.com/abc-defg-hij?authuser=0&hs=122";
  const chooserUrl = createMeetAccountChooserUrl(meetUrl, "sofia@example.com");
  const chooser = new URL(chooserUrl);

  assert.equal(chooser.origin, "https://accounts.google.com");
  assert.equal(chooser.pathname, "/AccountChooser");
  assert.equal(chooser.searchParams.get("Email"), "sofia@example.com");
  assert.equal(chooser.searchParams.get("continue"), meetUrl);
  assert.equal(createMeetAccountChooserUrl(meetUrl, null), meetUrl);
  assert.equal(
    createMeetAccountChooserUrl("https://example.com/not-meet", "sofia@example.com"),
    "https://example.com/not-meet",
  );
});