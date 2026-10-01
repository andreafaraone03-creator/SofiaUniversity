import {
  useGetAdminEmailSettings,
  useGetAdminGoogleCalendarStatus,
} from "@workspace/api-client-react";

export function AdminGoogleCalendarSettings() {
  const { data, isLoading, isError } = useGetAdminGoogleCalendarStatus();
  const { data: emailSettings } = useGetAdminEmailSettings();
  const expectedEmail = emailSettings?.adminNotificationEmail?.trim() ?? "";
  const connectedEmail = data?.connectedAccountEmail ?? null;
  const accountMatches = Boolean(
    expectedEmail &&
      connectedEmail &&
      expectedEmail.toLowerCase() === connectedEmail.toLowerCase(),
  );
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
      {callbackResult === "account-mismatch" && (
        <p className="mt-3 text-sm text-destructive" role="alert" data-testid="calendar-account-mismatch">
          L’account Google autorizzato non coincide con l’email per le notifiche admin. La connessione precedente è rimasta attiva; riprova selezionando l’account corretto.
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
        <>
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {data.connected
              ? "Google Calendar è collegato e crea i nuovi eventi Meet con questo account."
              : "Collega l’account Google da usare per Calendar e per creare i nuovi Meet."}
          </p>
          {data.connected && connectedEmail && (
            <p className="mt-2 text-sm" data-testid="text-calendar-account">
              Account Google collegato: <strong>{connectedEmail}</strong>
            </p>
          )}
          {data.connected && !connectedEmail && (
            <p className="mt-2 text-sm text-muted-foreground">
              La connessione è attiva, ma la sua identità non è stata verificata. Ricollega l’account per verificarla.
            </p>
          )}
          {data.connected && expectedEmail && connectedEmail && accountMatches && (
            <p className="mt-2 text-sm text-emerald-700" role="status" data-testid="text-calendar-account-match">
              L’account collegato coincide con l’email per le notifiche admin ({expectedEmail}).
            </p>
          )}
          {data.connected && expectedEmail && connectedEmail && !accountMatches && (
            <p className="mt-2 text-sm text-destructive" role="alert" data-testid="text-calendar-account-mismatch">
              L’account collegato non coincide con l’email admin ({expectedEmail}). I nuovi eventi usano ancora l’account collegato; ricollega Calendar per allinearli.
            </p>
          )}
          {!expectedEmail && (
            <p className="mt-2 text-sm text-muted-foreground">
              Configura l’email per le notifiche admin: viene usata come account atteso e suggerita quando apri un link Meet. Senza questo indirizzo il Meet si apre direttamente.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Devi comunque accedere a Google e avere i permessi richiesti. L’email e la selezione dell’account non trasferiscono i Meet già creati né i relativi permessi.
          </p>
          {data.canConnect && (
            <a
              href={connectUrl}
              className="mt-3 inline-flex min-h-10 items-center justify-center border border-[hsl(var(--border))] px-4 text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {data.connected ? "Ricollega account" : "Collega Google Calendar"}
            </a>
          )}
        </>
      )}
    </section>
  );
}