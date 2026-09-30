import { useGetAdminGoogleCalendarStatus } from "@workspace/api-client-react";

export function AdminGoogleCalendarSettings() {
  const { data, isLoading, isError } = useGetAdminGoogleCalendarStatus();
  const callbackResult = new URLSearchParams(window.location.search).get("calendar");
  const connectUrl = "/api/admin/google-calendar/connect";

  return (
    <section className="mt-5 border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <p className="eyebrow">integrazioni</p>
      <h2 className="mt-2 font-serif text-2xl">Google Calendar e Meet</h2>

      {callbackResult === "connected" && (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          Account Google collegato. Le nuove prenotazioni possono usare Calendar e Meet.
        </p>
      )}
      {callbackResult === "error" && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          Non è stato possibile collegare Google Calendar. Verifica la configurazione OAuth e riprova.
        </p>
      )}

      {isLoading && <p className="mt-3 text-sm text-muted-foreground">Controllo del collegamento…</p>}
      {isError && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          Non riesco a leggere lo stato di Google Calendar.
        </p>
      )}

      {data?.provider === "replit" && (
        <p className="mt-3 text-sm text-muted-foreground">
          In questo ambiente il calendario usa il connettore Replit. Su Render viene usato l'accesso OAuth Google.
        </p>
      )}
      {data?.provider === "not_configured" && (
        <p className="mt-3 text-sm text-muted-foreground">
          Configura client ID, client secret e redirect URI Google nelle variabili Render prima di collegare il calendario.
        </p>
      )}
      {data?.provider === "google_oauth" && (
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground" role="status">
            {data.connected
              ? "Google Calendar è collegato per le prenotazioni e la creazione dei link Meet."
              : "Collega l'account Google di Sofia per attivare le prenotazioni su Render."}
          </p>
          {data.canConnect && (
            <a
              href={connectUrl}
              className="inline-flex min-h-10 items-center justify-center border border-[hsl(var(--border))] px-4 text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {data.connected ? "Ricollega account" : "Collega Google Calendar"}
            </a>
          )}
        </div>
      )}
    </section>
  );
}