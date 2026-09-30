import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrientationRequestDateCell } from "../src/components/orientation-request-date-cell.ts";

function renderAppointmentCell(item) {
  return renderToStaticMarkup(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        createElement("tr", null, createElement(OrientationRequestDateCell, { item })),
      ),
    ),
  );
}

const fixture = {
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