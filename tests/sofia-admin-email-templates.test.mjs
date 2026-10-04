import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ADMIN_EMAIL_TEMPLATES,
  renderAdminEmailTemplate,
} from "../artifacts/api-server/src/lib/sofia-admin-email-templates.ts";

test("tour and consultation admin notifications have independent defaults", () => {
  assert.notEqual(
    DEFAULT_ADMIN_EMAIL_TEMPLATES.tour.subject,
    DEFAULT_ADMIN_EMAIL_TEMPLATES.consultation.subject,
  );
  assert.match(DEFAULT_ADMIN_EMAIL_TEMPLATES.consultation.body, /{{university}}/);
  assert.doesNotMatch(DEFAULT_ADMIN_EMAIL_TEMPLATES.tour.body, /{{university}}/);
});

test("admin notification templates substitute fields and produce escaped, linked HTML", () => {
  const content = renderAdminEmailTemplate({
    subject: "Tour per {{firstName}}\n{{lastName}}",
    body: "Cliente: {{firstName}} {{lastName}}\n{{customerEmail}}\n{{meetUrl}}",
  }, {
    firstName: "<Sofia>",
    lastName: "Rossi",
    customerEmail: "sofia@example.com",
    date: "4 ottobre 2026",
    time: "10:00",
    meetUrl: "https://meet.google.com/abc-defg-hij",
  });

  assert.equal(content.subject, "Tour per <Sofia> Rossi");
  assert.match(content.text, /Cliente: <Sofia> Rossi/);
  assert.match(content.html, /&lt;Sofia&gt;/);
  assert.doesNotMatch(content.html, /<Sofia>/);
  assert.match(
    content.html,
    /<a href="https:\/\/meet\.google\.com\/abc-defg-hij">https:\/\/meet\.google\.com\/abc-defg-hij<\/a>/,
  );
});