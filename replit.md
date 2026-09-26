# Sofia | Consulenza universitaria

Portale responsive per richieste di orientamento universitario, prenotazione tour Meet e gestione riservata delle richieste.

## Avvio e controlli

- Web: workflow `artifacts/sofia-orientamento: web`
- API: workflow `artifacts/api-server: API Server`
- `pnpm run typecheck` — verifica TypeScript dell'intero workspace
- `pnpm --filter @workspace/api-spec run codegen` — rigenera client e validatori dopo ogni modifica a OpenAPI

## Struttura

- `artifacts/sofia-orientamento/src/App.tsx` — pagine Home, Chi sono, Contatti e Area riservata
- `artifacts/sofia-orientamento/src/index.css` — tema e stili responsive
- `lib/api-spec/openapi.yaml` — contratto API, fonte unica per i tipi generati
- `artifacts/api-server/src/routes/sofia-public.ts` — corsi, richieste e slot/prenotazioni
- `artifacts/api-server/src/routes/sofia-admin.ts` — accesso e dashboard riservata
- `artifacts/api-server/data/courses.json` — 50 corsi distinti ricavati dai cataloghi pubblici ufficiali dei tre atenei; ricontrollare periodicamente l'offerta
- `artifacts/api-server/data/sofia.sqlite` — database SQLite creato automaticamente, escluso da Git

## Configurazione

- `SESSION_SECRET` — segreto necessario per firmare la sessione amministrativa; deve avere almeno 24 caratteri
- `SOFIA_DB_PATH` — percorso facoltativo per il file SQLite; per impostazione predefinita usa `artifacts/api-server/data/sofia.sqlite`
- `VITE_TIKTOK_URL` — link facoltativo al profilo TikTok di Sofia
- `VITE_WHATSAPP_NUMBER` — numero WhatsApp facoltativo, con prefisso internazionale
- `VITE_CONTACT_EMAIL` — email pubblica facoltativa

Al primo accesso ad `/admin`, Sofia crea l'unico account amministratore; farlo prima di condividere l'anteprima. La password è salvata come hash scrypt con salt; la sessione usa un cookie firmato HttpOnly.

## Nota sulla pubblicazione

SQLite è stato usato perché richiesto nel brief. Il file locale **non è persistente nelle app pubblicate su Replit**: su riavvio o nuova pubblicazione, richieste, prenotazioni e account amministratore potrebbero andare persi. Prima di usare il sito pubblicato con dati reali, spostare le tre tabelle su un database persistente come PostgreSQL gestito da Replit, oppure definire un'infrastruttura con volume persistente.

La prenotazione registra lo slot ma non genera automaticamente un link Google Meet né invia una email: Sofia deve concordare e condividere i dettagli con il cliente.