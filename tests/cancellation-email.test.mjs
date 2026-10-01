import assert from "node:assert/strict";
import test from "node:test";
import { calendarDeleteEventPath } from "../artifacts/api-server/src/lib/sofia-calendar-paths.ts";
import { cancellationContent } from "../artifacts/api-server/src/lib/sofia-email-content.ts";

test("consultation cancellation email gives the appointment details without a Meet link", () => {
  const content = cancellationContent({
    type: "consultation",
    firstName: "Ada",
    university: "Università & Studi",
    courseName: "Corso <Informatica>",
    date: "2026-11-20",
    time: "15:30",
  });

  assert.equal(content.subject, "La tua consulenza universitaria è stata annullata");
  assert.match(content.text, /Sofia ha annullato la tua consulenza universitaria/);
  assert.match(content.text, /20 novembre 2026 alle 15:30/);
  assert.match(content.text, /Ateneo: Università & Studi/);
  assert.match(content.html, /Università &amp; Studi/);
  assert.match(content.html, /Corso &lt;Informatica&gt;/);
  assert.doesNotMatch(content.text, /Meet|https?:\/\//i);
  assert.doesNotMatch(content.html, /Meet|https?:\/\//i);
});

test("tour cancellation email is clear and asks the customer to reply to reschedule", () => {
  const content = cancellationContent({
    type: "tour",
    firstName: "Luca",
    date: "2026-11-20",
    time: "10:00",
  });

  assert.equal(content.subject, "Il tuo tour della piattaforma è stato annullato");
  assert.match(content.text, /Sofia ha annullato il tuo tour della piattaforma/);
  assert.match(content.text, /Per concordare un nuovo appuntamento, rispondi a questa email/);
  assert.doesNotMatch(content.html, /Meet|https?:\/\//i);
});

test("Google Calendar event deletion suppresses attendee notifications", () => {
  assert.equal(
    calendarDeleteEventPath("primary", "event/with spaces"),
    "/calendar/v3/calendars/primary/events/event%2Fwith%20spaces?sendUpdates=none",
  );
});