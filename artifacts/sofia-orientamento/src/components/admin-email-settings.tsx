import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminEmailSettingsQueryKey,
  useGetAdminEmailSettings,
  useSendAdminTestEmail,
  useUpdateAdminEmailSettings,
} from "@workspace/api-client-react";

type SettingsDraft = {
  senderEmail: string;
  adminNotificationEmail: string;
  senderName: string;
  sendOrientationConfirmations: boolean;
  sendTourConfirmations: boolean;
};

const defaultSettings: SettingsDraft = {
  senderEmail: "",
  adminNotificationEmail: "",
  senderName: "Sofia",
  sendOrientationConfirmations: true,
  sendTourConfirmations: true,
};

export function AdminEmailSettings() {
  const client = useQueryClient();
  const settingsQuery = useGetAdminEmailSettings();
  const saveSettings = useUpdateAdminEmailSettings();
  const sendTest = useSendAdminTestEmail();
  const [draft, setDraft] = useState(defaultSettings);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setDraft({
      senderEmail: settingsQuery.data.senderEmail ?? "",
      adminNotificationEmail: settingsQuery.data.adminNotificationEmail ?? "",
      senderName: settingsQuery.data.senderName,
      sendOrientationConfirmations: settingsQuery.data.sendOrientationConfirmations,
      sendTourConfirmations: settingsQuery.data.sendTourConfirmations,
    });
  }, [settingsQuery.data]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    saveSettings.mutate({
      data: {
        senderEmail: draft.senderEmail.trim() || null,
        adminNotificationEmail: draft.adminNotificationEmail.trim() || null,
        senderName: draft.senderName.trim() || "Sofia",
        sendOrientationConfirmations: draft.sendOrientationConfirmations,
        sendTourConfirmations: draft.sendTourConfirmations,
      },
    }, {
      onSuccess: async () => {
        setMessage("Impostazioni salvate.");
        await client.invalidateQueries({ queryKey: getGetAdminEmailSettingsQueryKey() });
      },
      onError: () => setMessage("Non riesco a salvare le impostazioni."),
    });
  };

  const test = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    sendTest.mutate({ data: { to: recipient.trim() } }, {
      onSuccess: (result) => setMessage(result.message),
      onError: () => setMessage("Invio non riuscito. Controlla che il mittente sia verificato in Resend."),
    });
  };

  return <details className="mt-5 border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
    <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Impostazioni email e conferme automatiche</summary>
    <div className="border-t border-[hsl(var(--border))] p-5 md:p-7">
      {settingsQuery.isLoading ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Caricamento impostazioni…</p> : settingsQuery.isError ? <p role="alert" className="text-sm text-[hsl(var(--destructive))]">Non riesco a caricare le impostazioni email.</p> : <>
        {!draft.senderEmail && <p className="mb-5 border border-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.08)] p-3 text-sm">Inserisci un indirizzo mittente verificato in Resend per inviare le conferme.</p>}
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">Email mittente verificata
              <input className="field mt-2" type="email" maxLength={254} value={draft.senderEmail} onChange={(event) => setDraft({ ...draft, senderEmail: event.target.value })} placeholder="nome@tuodominio.it" />
            </label>
            <label className="text-xs font-semibold">Nome mittente
              <input className="field mt-2" required maxLength={80} value={draft.senderName} onChange={(event) => setDraft({ ...draft, senderName: event.target.value })} />
            </label>
          </div>
          <label className="block text-xs font-semibold">Email per notifiche admin
            <input className="field mt-2" type="email" maxLength={254} value={draft.adminNotificationEmail} onChange={(event) => setDraft({ ...draft, adminNotificationEmail: event.target.value })} placeholder="sofia@tuodominio.it" />
            <span className="mt-2 block font-normal text-[hsl(var(--muted-foreground))]">Riceverà data, cliente e link Meet. È anche l’account Google atteso per Calendar e quello suggerito quando apri i Meet dalla dashboard. Deve comunque accedere a Google: l’indirizzo non assegna permessi. Se vuoto, le notifiche admin sono disattivate e i link si aprono direttamente.</span>
          </label>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.sendOrientationConfirmations} onChange={(event) => setDraft({ ...draft, sendOrientationConfirmations: event.target.checked })} /> Invia conferme delle consulenze</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.sendTourConfirmations} onChange={(event) => setDraft({ ...draft, sendTourConfirmations: event.target.checked })} /> Invia conferme dei tour</label>
          </div>
          <button type="submit" disabled={saveSettings.isPending || settingsQuery.isLoading} className="border border-[hsl(var(--foreground))] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saveSettings.isPending ? "Salvataggio…" : "Salva impostazioni"}
          </button>
        </form>
        <form onSubmit={test} className="mt-6 flex flex-col gap-3 border-t border-[hsl(var(--border))] pt-5 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-semibold">Invia un’email di prova a
            <input className="field mt-2" type="email" required maxLength={254} value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="nome@email.it" />
          </label>
          <button type="submit" disabled={sendTest.isPending || !settingsQuery.data?.senderEmail} className="border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {sendTest.isPending ? "Invio…" : "Invia prova"}
          </button>
        </form>
        {message && <p role="status" className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{message}</p>}
      </>}
    </div>
  </details>;
}