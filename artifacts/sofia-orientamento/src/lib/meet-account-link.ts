export function createMeetAccountChooserUrl(
  meetUrl: string,
  configuredEmail: string | null | undefined,
): string {
  const email = configuredEmail?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return meetUrl;

  try {
    const destination = new URL(meetUrl);
    if (destination.protocol !== "https:" || destination.hostname.toLowerCase() !== "meet.google.com") {
      return meetUrl;
    }
  } catch {
    return meetUrl;
  }

  const chooser = new URL("https://accounts.google.com/AccountChooser");
  chooser.searchParams.set("Email", email);
  chooser.searchParams.set("continue", meetUrl);
  return chooser.toString();
}