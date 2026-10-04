export type AdminEmailTemplate = {
  subject: string;
  body: string;
};

export type AdminEmailTemplateValues = {
  firstName: string;
  lastName: string;
  customerEmail: string;
  date: string;
  time: string;
  meetUrl: string;
  university?: string;
  courseName?: string;
};

export const DEFAULT_ADMIN_EMAIL_TEMPLATES: Record<
  "consultation" | "tour",
  AdminEmailTemplate
> = {
  consultation: {
    subject: "Nuova consulenza universitaria: {{firstName}} {{lastName}}",
    body: [
      "Nuova consulenza universitaria prenotata.",
      "",
      "Cliente: {{firstName}} {{lastName}}",
      "Email: {{customerEmail}}",
      "Ateneo: {{university}}",
      "Corso: {{courseName}}",
      "Data: {{date}} alle {{time}}",
      "",
      "Link Google Meet: {{meetUrl}}",
    ].join("\n"),
  },
  tour: {
    subject: "Nuovo tour della piattaforma: {{firstName}} {{lastName}}",
    body: [
      "Nuovo tour della piattaforma prenotato.",
      "",
      "Cliente: {{firstName}} {{lastName}}",
      "Email: {{customerEmail}}",
      "Data: {{date}} alle {{time}}",
      "",
      "Link Google Meet: {{meetUrl}}",
    ].join("\n"),
  },
};

export const ADMIN_EMAIL_TEMPLATE_PLACEHOLDERS = [
  "{{firstName}}",
  "{{lastName}}",
  "{{customerEmail}}",
  "{{date}}",
  "{{time}}",
  "{{meetUrl}}",
  "{{university}}",
  "{{courseName}}",
] as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function renderAdminEmailTemplate(
  template: AdminEmailTemplate,
  values: AdminEmailTemplateValues,
): { subject: string; text: string; html: string } {
  const replacements: Record<string, string> = {
    firstName: values.firstName,
    lastName: values.lastName,
    customerEmail: values.customerEmail,
    date: values.date,
    time: values.time,
    meetUrl: values.meetUrl,
    university: values.university ?? "",
    courseName: values.courseName ?? "",
  };
  const render = (value: string) =>
    value.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (placeholder, name: string) =>
      Object.hasOwn(replacements, name) ? replacements[name] : placeholder,
    );

  const subject = render(template.subject).replace(/[\r\n]+/g, " ").trim().slice(0, 250);
  const text = render(template.body);
  let htmlBody = escapeHtml(text);
  const safeMeetUrl = escapeHtml(values.meetUrl);
  if (safeMeetUrl) {
    htmlBody = htmlBody.replaceAll(
      safeMeetUrl,
      `<a href="${safeMeetUrl}">${safeMeetUrl}</a>`,
    );
  }

  return {
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24211f;white-space:pre-line">${htmlBody}</div>`,
  };
}