export function formatDate(value: string | Date | null | undefined) {
  if (!value || (value instanceof Date && Number.isNaN(value.getTime()))) return "—";

  const serialized = value instanceof Date ? value.toISOString() : value;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(serialized)?.[1];
  const date = new Date(dateOnly ? `${dateOnly}T12:00:00` : serialized);
  if (Number.isNaN(date.getTime())) return "—";

  if (dateOnly) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "—";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}