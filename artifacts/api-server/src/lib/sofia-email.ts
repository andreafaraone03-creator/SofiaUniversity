import { sqlite, type EmailSettings } from "./sofia-db";

export type EmailDeliveryStatus = "sent" | "failed" | "not_configured" | "disabled";

export type EmailDelivery = {
  status: EmailDeliveryStatus;
  sentAt: string | null;
  error: string;
};

type ConfirmationDetails =
  | {
      type: "consultation";
      firstName: string;
      university: string;
      courseName: string;
      date: string;
      time: string;
      meetUrl: string;
    }
  | {
      type: "tour";
      firstName: string;
      date: string;
      time: string;
      meetUrl: string;
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
    sendOrientationConfirmations: row ? Boolean(row.sendOrientationConfirmations) : true,
    sendTourConfirmations: row ? Boolean(row.sendTourConfirmations) : true,
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
  const resendApiKey = process.env.SOFIA_RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return {
      status: "not_configured",
      sentAt: null,
      error: "Aggiungi la chiave API di Resend nei Secrets di questo progetto.",
    };
  }

  const safeName = settings.senderName.replace(/[\r\n<>"]/g, " ").trim() || "Sofia";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
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
  const enabled = details.type === "consultation"
    ? settings.sendOrientationConfirmations
    : settings.sendTourConfirmations;
  if (!enabled) return { status: "disabled", sentAt: null, error: "" };
  const content = confirmationContent(details);
  return sendEmail(recipient, content.subject, content.text, content.html, settings);
}

export async function sendForcedConfirmation(
  recipient: string,
  details: ConfirmationDetails,
): Promise<EmailDelivery> {
  const content = confirmationContent(details);
  return sendEmail(recipient, content.subject, content.text, content.html, readSettings());
}

function confirmationContent(details: ConfirmationDetails) {
  const date = formatTourDate(details.date);
  const firstName = escapeHtml(details.firstName);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(details.time);
  const meetLink = escapeHtml(details.meetUrl);
  const isConsultation = details.type === "consultation";
  const subject = isConsultation
    ? "La tua consulenza universitaria è prenotata"
    : "Il tuo tour della piattaforma è prenotato";
  const appointment = isConsultation
    ? `la tua consulenza universitaria con Sofia è prenotata per ${date} alle ${details.time}`
    : `il tuo tour della piattaforma con Sofia è prenotato per ${date} alle ${details.time}`;
  const htmlAppointment = isConsultation
    ? `la tua consulenza universitaria con Sofia è prenotata per <strong>${safeDate} alle ${safeTime}</strong>.`
    : `il tuo tour della piattaforma con Sofia è prenotato per <strong>${safeDate} alle ${safeTime}</strong>.`;
  const question = isConsultation
    ? "C’è un aspetto del corso o della scelta universitaria che vuoi approfondire? Rispondi a questa email."
    : "C’è una funzione della piattaforma che vuoi vedere durante il tour? Rispondi a questa email.";
  const context = isConsultation
    ? `\nAteneo: ${details.university}\nCorso: ${details.courseName}\n`
    : "\n";
  return {
    subject,
    text: `Ciao ${details.firstName},\n\n${appointment}.\n${context}\nPartecipa su Google Meet: ${details.meetUrl}\n\n${question}\n\nA presto,\nSofia`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24211f"><p>Ciao ${firstName},</p><p>${htmlAppointment}</p>${isConsultation
        ? `<p>Ateneo: <strong>${escapeHtml(details.university)}</strong><br>Corso: <strong>${escapeHtml(details.courseName)}</strong></p>`
        : ""}<p><a href="${meetLink}">Partecipa su Google Meet</a></p><p>${escapeHtml(question)}</p><p>A presto,<br>Sofia</p></div>`,
  };
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