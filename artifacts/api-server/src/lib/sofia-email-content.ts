export type CancellationEmailDetails =
  | {
      type: "consultation";
      firstName: string;
      university: string;
      courseName: string;
      date: string;
      time: string;
    }
  | {
      type: "tour";
      firstName: string;
      date: string;
      time: string;
    };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function formatTourDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function cancellationContent(details: CancellationEmailDetails) {
  const date = formatTourDate(details.date);
  const isConsultation = details.type === "consultation";
  const label = isConsultation ? "consulenza universitaria" : "tour della piattaforma";
  const subject = isConsultation
    ? "La tua consulenza universitaria è stata annullata"
    : "Il tuo tour della piattaforma è stato annullato";
  const appointmentPhrase = isConsultation
    ? "la tua consulenza universitaria"
    : "il tuo tour della piattaforma";
  const context = isConsultation
    ? `\nAteneo: ${details.university}\nCorso: ${details.courseName}`
    : "";
  const htmlContext = isConsultation
    ? `<p>Ateneo: <strong>${escapeHtml(details.university)}</strong><br>Corso: <strong>${escapeHtml(details.courseName)}</strong></p>`
    : "";
  const text = `Ciao ${details.firstName},\n\nSofia ha annullato ${appointmentPhrase} prevista per ${date} alle ${details.time}.${context}\n\nCi dispiace per il disagio. Per concordare un nuovo appuntamento, rispondi a questa email.\n\nA presto,\nSofia`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#24211f"><p>Ciao ${escapeHtml(details.firstName)},</p><p>Sofia ha annullato ${escapeHtml(appointmentPhrase)} prevista per <strong>${escapeHtml(date)} alle ${escapeHtml(details.time)}</strong>.</p>${htmlContext}<p>Ci dispiace per il disagio. Per concordare un nuovo appuntamento, rispondi a questa email.</p><p>A presto,<br>Sofia</p></div>`;

  return { subject, text, html };
}