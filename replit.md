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
- `artifacts/api-server/data/sofia.sqlite` — database SQLite locale per lo sviluppo Replit, escluso da Git
- `render.yaml` — Blueprint Render con servizio web e PostgreSQL gestito

## Configurazione

- `SESSION_SECRET` — segreto necessario per firmare la sessione amministrativa; deve avere almeno 24 caratteri
- `SOFIA_DATABASE_URL` — connection string PostgreSQL di Neon usata in produzione; impostarla su Render e non sostituirla con il `DATABASE_URL` condiviso di Replit
- `SOFIA_DB_PATH` — percorso facoltativo per SQLite locale; per impostazione predefinita usa `artifacts/api-server/data/sofia.sqlite`
- `SOFIA_RESEND_API_KEY` — chiave Resend isolata per Sofia; impostarla tramite Secrets, mai nel repository
- `SOFIA_GOOGLE_CLIENT_ID`, `SOFIA_GOOGLE_CLIENT_SECRET` — credenziali del client OAuth Google Web usato in produzione su Render
- `SOFIA_GOOGLE_REDIRECT_URI` — URI esatto `https://<host-render>/api/admin/google-calendar/callback`, da autorizzare anche nel client Google
- `SOFIA_GOOGLE_TOKEN_ENCRYPTION_KEY` — chiave stabile usata per cifrare il refresh token Google nel database; Render la genera dal Blueprint
- `VITE_TIKTOK_URL` — sovrascrive il link pubblico predefinito al profilo TikTok di Sofia, se impostato
- `VITE_WHATSAPP_NUMBER` — sovrascrive il numero WhatsApp pubblico predefinito, se impostato; usare il prefisso internazionale
- `VITE_CONTACT_EMAIL` — email pubblica facoltativa

Al primo accesso ad `/admin`, Sofia crea l'unico account amministratore; farlo prima di condividere l'anteprima. La password è salvata come hash scrypt con salt; la sessione usa un cookie firmato HttpOnly.

## Database e deployment

- In sviluppo Replit, il backend usa SQLite e `SOFIA_DB_PATH`.
- In produzione, impostare `SOFIA_DATABASE_URL` con la connection string pooled di Neon; il backend deve arrestarsi se la variabile manca, senza fallback silenzioso a SQLite.
- Il database Neon parte vuoto. Prenotazioni, account amministratore e impostazioni email presenti nel database SQLite non vengono copiati automaticamente; lo schema PostgreSQL viene creato all'avvio.
- Su un nuovo database, creare l'account admin e impostare il mittente verificato nelle impostazioni email.
- In sviluppo Replit, Calendar continua a usare il connettore Google Calendar di Replit.
- In produzione Render, Calendar usa OAuth diretto: abilitare Google Calendar API nel progetto Google Cloud, creare un client OAuth di tipo Web, autorizzare l'URI di callback configurato sopra e inserire client ID, client secret e redirect URI nelle variabili Render.
- Se la schermata di consenso Google è in modalità di test, aggiungere l'account Google di Sofia tra gli utenti di test. Dopo il primo accesso admin su Render, collegare Calendar dalla sezione “Google Calendar e Meet”.
- Il refresh token viene cifrato prima di essere salvato in PostgreSQL. Non ruotare `SOFIA_GOOGLE_TOKEN_ENCRYPTION_KEY` senza ricollegare Calendar; non salvare credenziali o token nel repository.