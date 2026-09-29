import { ReplitConnectors } from "@replit/connectors-sdk";
import { sqlite, type EmailSettings } from "./sofia-db";

export type EmailDeliveryStatus = "sent" | "failed" | "not_configured" | "disabled";

export type EmailDelivery = {
  status: EmailDeliveryStatus;
  sentAt: string | null;
  error: string;
};

type ConfirmationDetails =
  | {
      type: "orientation";
      firstName: string;
      university: string;
      courseName: string;
    }
  | {
      type: "tour";
      firstName: string;
      date: string;
      time: string;
    };

function readSettings(): EmailSettings {
  const row = sqlite.prepare(`
    SELECT sender_email AS senderEmail, sender_name AS senderName,
      send_orientation_confirmations AS sendOrientationConfirmations,
      send_tour_confirmations AS sendTourConfirmations
    FROM impostazioni_email WHERE id = 1
  `).get() as {
    senderEmail: string | null;
    senderName: string;
    sendOrientationConfirmations: number;
    sendTourConfirmations: number;
  } | undefined;

  return {
    senderEmail: row?.senderEmail?.trim() || null,
    senderName: row?.senderName?.trim() || "Sofia",
    sendOrientationConfirmations: Boolean(row?.sendOrientationConfirmations),
    sendTourConfirmations: Boolean(row?.sendTourConfirmations),
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function formatTourDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
  settings: EmailSettings,
): Promise<EmailDelivery> {
  if (!settings.senderEmail) {
    return { status: "not_configured", sentAt: null, error: "Imposta un indirizzo mittente verificato in Resend." };
  }

  const safeName = settings.senderName.replace(/[\r\n<>"]/g, " ").trim() || "Sofia";
  try {
    const response = await new ReplitConnectors().proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${safeName} <${settings.senderEmail}>`,
        to: [to],
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      // Do not persist provider payloads, which can contain recipient details.
      return {
        status: "failed",
        sentAt: null,
        error: `Resend ha rifiutato l'invio (HTTP ${response.status}). Verifica mittente e dominio.`,
      };
    }
    return { status: "sent", sentAt: new Date().toISOString(), error: "" };
  } catch {
    return {
      status: "failed",
      sentAt: null,
      error: "Servizio email non raggiungibile. Riprova tra poco.",
    };
  }
}

export async function sendAutomaticConfirmation(
  recipient: string,
  details: ConfirmationDetails,
): Promise<EmailDelivery> {
  const settings = readSettings();
  if (!settings.senderEmail) {
    return { status: "not_configured", sentAt: null, error: "Imposta un indirizzo mittente verificato in Resend." };
  }

  const enabled = details.type === "orientation"
    ? settings.sendOrientationConfirmations
    : settings.sendTourConfirmations;
  if (!enabled) return { status: "disabled", sentAt: null, error: "" };

  const firstName = escapeHtml(details.firstName);
  if (details.type === "orientation") {
    const university = escapeHtml(details.university);
    const course = escapeHtml(details.courseName);
    const subject = "Abbiamo ricevuto la tua richiesta di orientamento";
    const text = `Ciao ${details.firstName},\n\nabbiamo ricevuto la tua richiesta di orientamento per ${details.courseName} presso ${details.university}. Sofia ti contatterà presto.\n\nA presto,\nSofia`;
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24211f"><p>Ciao ${firstName},</p><p>abbiamo ricevuto la tua richiesta di orientamento per <strong>${course}</strong> presso <strong>${university}</strong>.</p><p>Sofia ti contatterà presto.</p><p>A presto,<br>Sofia</p></div>`;
    return sendEmail(recipient, subject, text, html, settings);
  }

  const date = formatTourDate(details.date);
  const subject = "Il tuo tour della piattaforma è prenotato";
  const text = `Ciao ${details.firstName},\n\nil tuo tour della piattaforma Sofia è prenotato per ${date} alle ${details.time}.\n\nSofia ti invierà i dettagli per partecipare.\n\nA presto,\nSofia`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24211f"><p>Ciao ${firstName},</p><p>il tuo tour della piattaforma Sofia è prenotato per <strong>${escapeHtml(date)} alle ${escapeHtml(details.time)}</strong>.</p><p>Sofia ti invierà i dettagli per partecipare.</p><p>A presto,<br>Sofia</p></div>`;
  return sendEmail(recipient, subject, text, html, settings);
}

export async function sendForcedConfirmation(
  recipient: string,
  details: ConfirmationDetails,
): Promise<EmailDelivery> {
  const settings = readSettings();
  const firstName = escapeHtml(details.firstName);
  if (details.type === "orientation") {
    const university = escapeHtml(details.university);
    const course = escapeHtml(details.courseName);
    return sendEmail(
      recipient,
      "Abbiamo ricevuto la tua richiesta di orientamento",
      `Ciao ${details.firstName},\n\nabbiamo ricevuto la tua richiesta di orientamento per ${details.courseName} presso ${details.university}. Sofia ti contatterà presto.\n\nA presto,\nSofia`,
      `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24211f"><p>Ciao ${firstName},</p><p>abbiamo ricevuto la tua richiesta di orientamento per <strong>${course}</strong> presso <strong>${university}</strong>.</p><p>Sofia ti contatterà presto.</p><p>A presto,<br>Sofia</p></div>`,
      settings,
    );
  }

  const date = formatTourDate(details.date);
  return sendEmail(
    recipient,
    "Il tuo tour della piattaforma è prenotato",
    `Ciao ${details.firstName},\n\nil tuo tour della piattaforma Sofia è prenotato per ${date} alle ${details.time}.\n\nSofia ti invierà i dettagli per partecipare.\n\nA presto,\nSofia`,
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24211f"><p>Ciao ${firstName},</p><p>il tuo tour della piattaforma Sofia è prenotato per <strong>${escapeHtml(date)} alle ${escapeHtml(details.time)}</strong>.</p><p>Sofia ti invierà i dettagli per partecipare.</p><p>A presto,<br>Sofia</p></div>`,
    settings,
  );
}

export async function sendTestEmail(recipient: string): Promise<EmailDelivery> {
  const settings = readSettings();
  return sendEmail(
    recipient,
    "Email di prova — Sofia",
    "Questa è un'email di prova della configurazione automatica delle conferme di Sofia.",
    "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#24211f\"><p>Questa è un'email di prova della configurazione automatica delle conferme di Sofia.</p></div>",
    settings,
  );
}

export function persistEmailDelivery(
  table: "richieste_corso" | "prenotazioni_tour",
  id: number,
  delivery: EmailDelivery,
) {
  sqlite.prepare(`
    UPDATE ${table}
    SET confirmation_email_status = ?, confirmation_email_sent_at = ?,
        confirmation_email_error = ?
    WHERE id = ?
  `).run(delivery.status, delivery.sentAt, delivery.error, id);
}