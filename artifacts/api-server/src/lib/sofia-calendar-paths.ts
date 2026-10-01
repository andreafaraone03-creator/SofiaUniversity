export function calendarDeleteEventPath(calendarId: string, eventId: string): string {
  return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`;
}