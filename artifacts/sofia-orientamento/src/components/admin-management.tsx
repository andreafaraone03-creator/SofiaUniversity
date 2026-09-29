import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Save, Search, X } from "lucide-react";
import {
  getGetAdminSummaryQueryKey,
  getListAdminEnrollmentsQueryKey,
  getListAdminOrientationRequestsQueryKey,
  getListAdminTourBookingsQueryKey,
  useConfirmOrientationEnrollment,
  useCreateAdminEnrollment,
  useListAdminEnrollments,
  useListCourses,
  useMarkOrientationRequestNotEnrolled,
  useUpdateAdminEnrollment,
  useUpdateOrientationRequestManagement,
  useUpdateTourBookingManagement,
} from "@workspace/api-client-react";
import type {
  Enrollment,
  OrientationPipelineStatus,
  OrientationRequest,
  TourBooking,
} from "@workspace/api-client-react";

const leadStatuses: { value: OrientationPipelineStatus; label: string }[] = [
  { value: "new", label: "Nuova" },
  { value: "contacted", label: "Contattata" },
  { value: "considering", label: "In valutazione" },
  { value: "enrolled", label: "Iscritta" },
  { value: "closed", label: "Archiviata" },
];

function toLocalDateTime(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function todayInRome() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function euro(cents: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function dateLabel(value: string | Date) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
}

function invalidateCRM(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    client.invalidateQueries({ queryKey: getListAdminOrientationRequestsQueryKey() }),
    client.invalidateQueries({ queryKey: getListAdminTourBookingsQueryKey() }),
    client.invalidateQueries({ queryKey: getListAdminEnrollmentsQueryKey() }),
    client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }),
  ]);
}

function ReminderFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return <label className="block text-xs font-semibold">
    Prossimo promemoria
    <input
      className="field mt-2"
      type="datetime-local"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>;
}

export function EnrollmentDecisionActions({
  item,
  onEnrollmentRecorded,
  onMarkedNotEnrolled,
}: {
  item: OrientationRequest;
  onEnrollmentRecorded?: () => void;
  onMarkedNotEnrolled?: () => void;
}) {
  const client = useQueryClient();
  const confirm = useConfirmOrientationEnrollment();
  const markNotEnrolled = useMarkOrientationRequestNotEnrolled();
  const [message, setMessage] = useState("");
  const busy = confirm.isPending || markNotEnrolled.isPending;

  const confirmEnrollment = () => confirm.mutate({ id: item.id }, {
    onSuccess: async (enrollment) => {
      setMessage(`Iscrizione registrata · ${euro(enrollment.commissionCents)} segnati come incassati.`);
      await invalidateCRM(client);
      onEnrollmentRecorded?.();
    },
    onError: () => setMessage("Non posso registrare l’iscrizione: verifica se esiste già una scheda collegata."),
  });

  const markAsNotEnrolled = () => markNotEnrolled.mutate({ id: item.id }, {
    onSuccess: async () => {
      setMessage("La persona è stata spostata tra le non iscritte.");
      await invalidateCRM(client);
      onMarkedNotEnrolled?.();
    },
    onError: () => setMessage("Non posso segnare la persona come non iscritta: esiste già una scheda iscrizione."),
  });

  if (item.enrollmentOutcome === "enrolled") {
    return <div className="min-w-44">
      <span className="inline-flex items-center gap-1 border border-[hsl(160_28%_70%)] bg-[hsl(160_35%_94%)] px-2 py-1 text-[.65rem] font-semibold"><Check size={12} /> Iscritta</span>
      {message && <p role="status" className="mt-1 max-w-56 whitespace-normal text-[.65rem] text-[hsl(var(--muted-foreground))]">{message}</p>}
    </div>;
  }

  return <div className="min-w-52">
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={confirmEnrollment}
        aria-label={`Conferma iscrizione e incasso per ${item.firstName} ${item.lastName}`}
        title="Registra l'iscrizione e la provvigione incassata"
        className="inline-flex items-center gap-1 border border-[hsl(160_28%_70%)] bg-[hsl(160_35%_94%)] px-2 py-2 text-[.68rem] font-semibold disabled:opacity-50"
      >
        <Check size={13} /> Iscritta
      </button>
      <button
        type="button"
        disabled={busy || item.enrollmentOutcome === "not_enrolled"}
        onClick={markAsNotEnrolled}
        aria-label={`Segna ${item.firstName} ${item.lastName} come non iscritta`}
        title="Sposta tra le persone non iscritte senza creare una provvigione"
        className="inline-flex items-center gap-1 border border-[hsl(var(--border))] px-2 py-2 text-[.68rem] font-semibold disabled:opacity-50"
      >
        <X size={13} /> Non iscritta
      </button>
    </div>
    {item.enrollmentOutcome === "not_enrolled" && <p className="mt-1 text-[.65rem] text-[hsl(var(--muted-foreground))]">Esito attuale: non iscritta</p>}
    {message && <p role="status" className="mt-1 max-w-56 whitespace-normal text-[.65rem] text-[hsl(var(--muted-foreground))]">{message}</p>}
  </div>;
}

export function OrientationManagementEditor({
  item,
  onRecordEnrollment,
}: {
  item: OrientationRequest;
  onRecordEnrollment: (item: OrientationRequest) => void;
}) {
  const client = useQueryClient();
  const update = useUpdateOrientationRequestManagement();
  const [status, setStatus] = useState<OrientationPipelineStatus>(item.pipelineStatus);
  const [notes, setNotes] = useState(item.adminNotes);
  const [followUp, setFollowUp] = useState(toLocalDateTime(item.followUpAt));
  const [message, setMessage] = useState("");

  const save = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({
      id: item.id,
      data: {
        pipelineStatus: status,
        adminNotes: notes,
        followUpAt: followUp ? new Date(followUp).toISOString() : null,
      },
    }, {
      onSuccess: () => {
        setMessage("Scheda aggiornata.");
        invalidateCRM(client);
      },
      onError: () => setMessage("Non riesco a salvare. Riprova."),
    });
  };

  return <div className="max-w-3xl">
    <form onSubmit={save} className="space-y-4">
      <label className="block text-xs font-semibold">
        Avanzamento
        <select className="field mt-2" value={status} onChange={(event) => setStatus(event.target.value as OrientationPipelineStatus)}>
          {leadStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <ReminderFields value={followUp} onChange={setFollowUp} />
      <label className="block text-xs font-semibold">
        Note interne
        <textarea className="field mt-2 min-h-24 resize-y" maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Esigenze, obiettivi, prossimi passi…" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={update.isPending} className="inline-flex items-center gap-2 border border-[hsl(var(--foreground))] px-4 py-2 text-xs font-semibold disabled:opacity-50">
          <Save size={14} /> {update.isPending ? "Salvataggio…" : "Salva scheda"}
        </button>
        <button type="button" onClick={() => onRecordEnrollment(item)} className="text-xs font-semibold underline underline-offset-4">
          Registra iscrizione
        </button>
        {message && <span role="status" className="text-xs text-[hsl(var(--muted-foreground))]">{message}</span>}
      </div>
    </form>
  </div>;
}

export function TourManagementEditor({ item }: { item: TourBooking }) {
  const client = useQueryClient();
  const update = useUpdateTourBookingManagement();
  const [notes, setNotes] = useState(item.adminNotes);
  const [followUp, setFollowUp] = useState(toLocalDateTime(item.followUpAt));
  const [message, setMessage] = useState("");

  const save = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({
      id: item.id,
      data: {
        adminNotes: notes,
        followUpAt: followUp ? new Date(followUp).toISOString() : null,
      },
    }, {
      onSuccess: () => {
        setMessage("Scheda aggiornata.");
        invalidateCRM(client);
      },
      onError: () => setMessage("Non riesco a salvare. Riprova."),
    });
  };

  return <div className="max-w-3xl">
    <form onSubmit={save} className="space-y-4">
      <ReminderFields value={followUp} onChange={setFollowUp} />
      <label className="block text-xs font-semibold">
        Note interne
        <textarea className="field mt-2 min-h-24 resize-y" maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Dettagli del tour, esigenze, prossimi passi…" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={update.isPending} className="inline-flex items-center gap-2 border border-[hsl(var(--foreground))] px-4 py-2 text-xs font-semibold disabled:opacity-50">
          <Save size={14} /> {update.isPending ? "Salvataggio…" : "Salva scheda"}
        </button>
        {message && <span role="status" className="text-xs text-[hsl(var(--muted-foreground))]">{message}</span>}
      </div>
    </form>
  </div>;
}

export type EnrollmentPrefill = Pick<
  OrientationRequest,
  "id" | "firstName" | "lastName" | "email" | "university" | "courseId"
>;

type EnrollmentFormState = {
  orientationRequestId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  university: string;
  courseId: string;
  enrolledAt: string;
  commissionEuros: string;
  commissionStatus: "pending" | "paid";
  notes: string;
};

function newEnrollmentForm(): EnrollmentFormState {
  return {
    orientationRequestId: null,
    firstName: "",
    lastName: "",
    email: "",
    university: "",
    courseId: "",
    enrolledAt: todayInRome(),
    commissionEuros: "0",
    commissionStatus: "pending",
    notes: "",
  };
}

function EnrollmentRow({ item }: { item: Enrollment }) {
  const client = useQueryClient();
  const update = useUpdateAdminEnrollment();
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState((item.commissionCents / 100).toFixed(2));
  const [payment, setPayment] = useState<"pending" | "paid">(item.commissionStatus);
  const [status, setStatus] = useState<"active" | "withdrawn">(item.status);
  const [notes, setNotes] = useState(item.notes);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAmount((item.commissionCents / 100).toFixed(2));
    setPayment(item.commissionStatus);
    setStatus(item.status);
    setNotes(item.notes);
  }, [item.commissionCents, item.commissionStatus, item.status, item.notes]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
      setMessage("Inserisci una provvigione valida.");
      return;
    }
    update.mutate({
      id: item.id,
      data: {
        commissionCents: Math.round(value * 100),
        commissionStatus: payment,
        status,
        notes,
      },
    }, {
      onSuccess: () => {
        setMessage("Iscrizione aggiornata.");
        client.invalidateQueries({ queryKey: getListAdminEnrollmentsQueryKey() });
        client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      },
      onError: () => setMessage("Non riesco a salvare. Riprova."),
    });
  };

  return <>
    <tr className="border-b border-[hsl(var(--border)/.65)]">
      <td className="px-4 py-4 font-semibold">{item.firstName} {item.lastName}</td>
      <td className="px-4 py-4">{item.email}</td>
      <td className="px-4 py-4">{item.university}<span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{item.courseName}</span></td>
      <td className="whitespace-nowrap px-4 py-4">{dateLabel(item.enrolledAt)}</td>
      <td className="whitespace-nowrap px-4 py-4 font-semibold">{euro(item.commissionCents)}</td>
      <td className="px-4 py-4"><span className={`border px-2 py-1 text-[.65rem] ${item.commissionStatus === "paid" ? "border-[hsl(160_28%_70%)] bg-[hsl(160_35%_94%)]" : "border-[hsl(var(--border))]"}`}>{item.commissionStatus === "paid" ? "Incassata" : "Da incassare"}</span></td>
      <td className="px-4 py-4"><span className="text-xs">{item.status === "active" ? "Attiva" : "Ritirata"}</span></td>
      <td className="px-4 py-4"><button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-semibold underline underline-offset-4">{expanded ? "Chiudi" : "Modifica"}</button></td>
    </tr>
    {expanded && <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.2)]">
      <td colSpan={8} className="p-5">
        <form onSubmit={save} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold">Provvigione (€)<input className="field mt-2" type="number" min="0" max="1000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label className="text-xs font-semibold">Pagamento<select className="field mt-2" value={payment} onChange={(event) => setPayment(event.target.value as "pending" | "paid")}><option value="pending">Da incassare</option><option value="paid">Incassata</option></select></label>
          <label className="text-xs font-semibold">Iscrizione<select className="field mt-2" value={status} onChange={(event) => setStatus(event.target.value as "active" | "withdrawn")}><option value="active">Attiva</option><option value="withdrawn">Ritirata</option></select></label>
          <label className="text-xs font-semibold md:col-span-2 xl:col-span-1">Note<textarea className="field mt-2 min-h-10 resize-y" maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <div className="flex items-center gap-3 md:col-span-2 xl:col-span-4">
            <button type="submit" disabled={update.isPending} className="inline-flex items-center gap-2 border border-[hsl(var(--foreground))] px-4 py-2 text-xs font-semibold disabled:opacity-50"><Save size={14} />{update.isPending ? "Salvataggio…" : "Salva modifiche"}</button>
            {message && <span role="status" className="text-xs text-[hsl(var(--muted-foreground))]">{message}</span>}
          </div>
        </form>
      </td>
    </tr>}
  </>;
}

export function EnrollmentPanel({
  prefill,
  onPrefillConsumed,
}: {
  prefill: EnrollmentPrefill | null;
  onPrefillConsumed: () => void;
}) {
  const client = useQueryClient();
  const enrollments = useListAdminEnrollments();
  const coursesQuery = useListCourses();
  const create = useCreateAdminEnrollment();
  const [form, setForm] = useState<EnrollmentFormState>(newEnrollmentForm);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const courses = coursesQuery.data ?? [];
  const universities = [...new Set(courses.map((course) => course.university))];
  const filteredCourses = courses.filter((course) => !form.university || course.university === form.university);
  const visibleEnrollments = useMemo(() => (enrollments.data ?? []).filter((item) => {
    const term = search.trim().toLocaleLowerCase("it");
    return !term || `${item.firstName} ${item.lastName} ${item.email} ${item.courseName} ${item.university}`.toLocaleLowerCase("it").includes(term);
  }), [enrollments.data, search]);

  useEffect(() => {
    if (!prefill) return;
    setForm({
      ...newEnrollmentForm(),
      orientationRequestId: prefill.id,
      firstName: prefill.firstName,
      lastName: prefill.lastName,
      email: prefill.email,
      university: prefill.university,
      courseId: prefill.courseId,
    });
    setShowForm(true);
    setMessage("");
  }, [prefill]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const commission = Number(form.commissionEuros);
    if (!form.courseId || !Number.isFinite(commission) || commission < 0 || commission > 1_000_000) {
      setMessage("Seleziona il corso e inserisci una provvigione valida.");
      return;
    }
    create.mutate({
      data: {
        orientationRequestId: form.orientationRequestId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        university: form.university,
        courseId: form.courseId,
        enrolledAt: form.enrolledAt,
        commissionCents: Math.round(commission * 100),
        commissionStatus: form.commissionStatus,
        notes: form.notes,
      },
    }, {
      onSuccess: () => {
        setMessage("Iscrizione registrata.");
        client.invalidateQueries({ queryKey: getListAdminEnrollmentsQueryKey() });
        client.invalidateQueries({ queryKey: getListAdminOrientationRequestsQueryKey() });
        client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        setForm(newEnrollmentForm());
        setShowForm(false);
        onPrefillConsumed();
      },
      onError: () => setMessage("Non riesco a registrare l'iscrizione. Riprova."),
    });
  };

  return <section className="space-y-6 p-5 md:p-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="eyebrow">conversioni e provvigioni</p><h2 className="mt-2 font-serif text-3xl">Iscrizioni universitarie</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Registra ogni iscrizione conclusa e tieni separati gli importi da incassare da quelli già pagati.</p></div>
      <button type="button" onClick={() => { setShowForm(!showForm); setMessage(""); }} className="inline-flex items-center justify-center gap-2 border border-[hsl(var(--foreground))] px-4 py-3 text-sm font-semibold">{showForm ? <X size={15} /> : <Save size={15} />}{showForm ? "Chiudi modulo" : "Nuova iscrizione"}</button>
    </div>
    {showForm && <form onSubmit={submit} className="space-y-5 border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.18)] p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold">Nome<input className="field mt-2" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
        <label className="text-xs font-semibold">Cognome<input className="field mt-2" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
        <label className="text-xs font-semibold sm:col-span-2">Email<input className="field mt-2" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="text-xs font-semibold">Ateneo<select className="field mt-2" required value={form.university} onChange={(event) => setForm({ ...form, university: event.target.value, courseId: "" })}><option value="">Seleziona l'ateneo</option>{universities.map((university) => <option key={university} value={university}>{university}</option>)}</select></label>
        <label className="text-xs font-semibold sm:col-span-2">Corso<select className="field mt-2" required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })} disabled={!form.university}><option value="">Seleziona il corso</option>{filteredCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
        <label className="text-xs font-semibold">Data iscrizione<input className="field mt-2" type="date" required value={form.enrolledAt} onChange={(event) => setForm({ ...form, enrolledAt: event.target.value })} /></label>
        <label className="text-xs font-semibold">Provvigione (€)<input className="field mt-2" type="number" min="0" max="1000000" step="0.01" required value={form.commissionEuros} onChange={(event) => setForm({ ...form, commissionEuros: event.target.value })} /></label>
        <label className="text-xs font-semibold">Stato provvigione<select className="field mt-2" value={form.commissionStatus} onChange={(event) => setForm({ ...form, commissionStatus: event.target.value as "pending" | "paid" })}><option value="pending">Da incassare</option><option value="paid">Incassata</option></select></label>
        <label className="text-xs font-semibold sm:col-span-2 lg:col-span-4">Note<textarea className="field mt-2 min-h-16 resize-y" maxLength={5000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Riferimento pratica, scadenze o altri dettagli…" /></label>
      </div>
      {coursesQuery.isError && <p role="alert" className="text-sm text-[hsl(var(--destructive))]">Non riesco a caricare l'elenco dei corsi.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={create.isPending || coursesQuery.isLoading} className="inline-flex items-center gap-2 bg-[hsl(var(--foreground))] px-5 py-3 text-sm font-semibold text-[hsl(var(--background))] disabled:opacity-50"><Save size={15} />{create.isPending ? "Salvataggio…" : "Registra iscrizione"}</button>
        <button type="button" onClick={() => { setShowForm(false); setForm(newEnrollmentForm()); onPrefillConsumed(); }} className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">Annulla</button>
        {message && <span role="status" className="text-sm text-[hsl(var(--muted-foreground))]">{message}</span>}
      </div>
    </form>}
    {!showForm && message && <p role="status" className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>}
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">{enrollments.data?.length ?? 0} iscrizioni registrate</p>
      <label className="relative block sm:w-80"><span className="sr-only">Cerca iscrizioni</span><input className="field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca nome, email, corso…" /><SearchIcon /></label>
    </div>
    {enrollments.isLoading ? <TableNotice>Caricamento iscrizioni…</TableNotice> : enrollments.isError ? <TableNotice error>Non riesco a caricare le iscrizioni. Aggiorna la pagina.</TableNotice> : visibleEnrollments.length === 0 ? <TableNotice>Nessuna iscrizione trovata.</TableNotice> : <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-[hsl(var(--border))] text-[.68rem] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><tr>{["Studente", "Email", "Ateneo / corso", "Data", "Provvigione", "Incasso", "Stato", "Gestione"].map((heading) => <th key={heading} className="px-4 py-4">{heading}</th>)}</tr></thead>
        <tbody>{visibleEnrollments.map((item) => <EnrollmentRow key={item.id} item={item} />)}</tbody>
      </table>
    </div>}
  </section>;
}

function TableNotice({ children, error = false }: { children: string; error?: boolean }) {
  return <div className={`p-10 text-center text-sm ${error ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--muted-foreground))]"}`}>{children}</div>;
}

function SearchIcon() {
  return <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><Search size={15} className="text-[hsl(var(--muted-foreground))]" /></span>;
}