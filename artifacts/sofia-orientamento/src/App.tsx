import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  CircleDollarSign,
  GraduationCap,
  LogOut,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import { FaTiktok, FaWhatsapp } from 'react-icons/fa6';
import {
  getGetAdminStatusQueryKey,
  getGetAdminSummaryQueryKey,
  getListAdminOrientationRequestsQueryKey,
  getListAdminTourBookingsQueryKey,
  getListAppointmentSlotsQueryKey,
  useCancelOrientationAppointment,
  useCreateOrientationRequest,
  useCreateTourBooking,
  useGetAdminEmailSettings,
  useGetAdminStatus,
  useGetAdminSummary,
  useListAdminOrientationRequests,
  useListAdminTourBookings,
  useListAppointmentSlots,
  useListCourses,
  useLoginAdmin,
  useLogoutAdmin,
  useResendOrientationConfirmation,
  useResendOrientationCancellationEmail,
  useResendTourConfirmation,
  useResendTourCancellationEmail,
  useSetupAdmin,
  useUpdateTourBookingStatus,
} from '@workspace/api-client-react';
import type { AppointmentSlot, OrientationRequest, TourBooking } from '@workspace/api-client-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  EnrollmentDecisionActions,
  EnrollmentPanel,
  OrientationManagementEditor,
  TourManagementEditor,
  type EnrollmentPrefill,
} from '@/components/admin-management';
import { AdminEmailSettings } from '@/components/admin-email-settings';
import { AdminGoogleCalendarSettings } from '@/components/admin-google-calendar-settings';
import { RecaptchaCheckbox } from '@/components/recaptcha-checkbox';
import { OrientationRequestDateCell } from '@/components/orientation-request-date-cell';
import { formatDate, formatDateTime } from '@/lib/date-format';
import { createMeetAccountChooserUrl } from '@/lib/meet-account-link';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
function romeToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const contactDefaults = { firstName: '', lastName: '', email: '', province: '', phone: '' };
type ContactValues = typeof contactDefaults;
type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function cancellationEmailCanRetry(status: OrientationRequest["cancellationEmailStatus"]) {
  return status === "pending" || status === "failed" || status === "not_configured" || status === "disabled";
}

function SiteHeader() {
  const [location] = useLocation();
  const nav = [
    { href: '/', label: 'Home' },
    { href: '/chi-sono', label: 'Chi sono' },
    { href: '/contatti', label: 'Contatti' },
  ];
  const activeLink = (href: string) => location === href
    ? 'font-semibold text-[hsl(var(--foreground))] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[hsl(var(--primary))]'
    : 'text-[hsl(var(--muted-foreground))]';
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/.75)] bg-[hsl(var(--background)/.92)] backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-5 md:px-10">
        <Link href="/" data-testid="link-logo" className="group flex shrink-0 items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center bg-[hsl(var(--secondary))] text-[hsl(var(--accent))] font-bold">S<span className="absolute -bottom-1 -right-1 h-3 w-3 bg-[hsl(var(--primary))]" /></span>
          <span className="leading-none"><strong className="block font-serif text-xl font-bold tracking-[-.06em]">sofia<span className="text-[hsl(var(--primary))]">.</span></strong><small className="eyebrow block !text-[.5rem] !tracking-[.2em]">consulenza</small></span>
        </Link>
        <nav className="hidden items-center md:flex" aria-label="Navigazione principale">
          {nav.map((item) => <Link key={item.href} href={item.href} aria-current={location === item.href ? 'page' : undefined} data-testid={`link-nav-${item.label.toLowerCase().replace(' ', '-')}`} className={`relative px-4 py-3 text-sm transition-colors hover:text-[hsl(var(--primary))] before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:border-l before:border-[hsl(var(--border))] first:before:hidden ${activeLink(item.href)}`}>{item.label}</Link>)}
           <Link href="/admin" data-testid="link-admin" className="ml-3 inline-flex items-center gap-2 border border-[hsl(var(--foreground))] px-4 py-2.5 text-sm text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--accent))]"><ShieldCheck size={15} />Area riservata<ArrowRight size={13} /></Link>
        </nav>
      </div>
      <div className="border-t border-[hsl(var(--border)/.7)] md:hidden">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 sm:px-5" aria-label="Navigazione principale">
          {nav.map((item) => <Link key={item.href} href={item.href} aria-current={location === item.href ? 'page' : undefined} data-testid={`link-mobile-${item.label.toLowerCase().replace(' ', '-')}`} className={`relative whitespace-nowrap px-2 py-1.5 text-xs transition-colors ${activeLink(item.href)}`}>{item.label}</Link>)}
          <Link href="/admin" data-testid="link-mobile-admin" className="inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))]"><ShieldCheck size={14} />Area riservata</Link>
        </nav>
      </div>
    </header>
  );
}

function BookingChoiceRow({ href, number, label, title, description, detail, cta, Icon, testId }: {
  href: string;
  number: string;
  label: string;
  title: string;
  description: string;
  detail: string;
  cta: string;
  Icon: typeof GraduationCap;
  testId: string;
}) {
  return <Link href={href} data-testid={testId} className="route-card group grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-4 gap-y-5 p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary))] sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-6 sm:gap-y-0 sm:px-7 sm:py-8 md:px-9">
    <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[hsl(var(--secondary))] text-[hsl(var(--accent))] transition-colors group-hover:bg-[hsl(var(--accent))] group-hover:text-[hsl(var(--accent-foreground))] sm:h-14 sm:w-14">
      <Icon size={21} strokeWidth={1.6} />
    </span>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="mono text-xs font-medium text-[hsl(var(--primary))]">{number}</span>
        <span className="eyebrow !text-[.6rem]">{label}</span>
      </div>
      <h3 className="mt-1.5 font-serif text-2xl leading-tight md:text-[1.8rem]">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p>
       <span className="mt-4 inline-flex text-[.66rem] font-semibold tracking-[.1em] text-[hsl(var(--muted-foreground))]">{detail}</span>
    </div>
     <span className="col-span-2 inline-flex min-h-11 w-full items-center justify-between gap-2 bg-[hsl(var(--secondary))] px-4 py-3 text-sm font-semibold text-[hsl(var(--background))] transition-colors group-hover:bg-[hsl(var(--accent))] group-hover:text-[hsl(var(--foreground))] sm:col-span-1 sm:w-fit sm:justify-start sm:whitespace-nowrap">
      {cta}<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
    </span>
  </Link>;
}

function PartnerTicker() {
  const partners = [
    { name: 'Università Pegaso', src: 'https://images.ctfassets.net/5bcqzxwt09xw/2P2IePvy4MXoer2sa69Nka/67617a6bdcd02fd420fc993e281dfdcf/logo.png?fm=png&q=100&h=160' },
    { name: 'Universitas Mercatorum', src: 'https://www.unimercatorum.it/img/logo/logo.png?id=74d9efc4d46bb9cb56034eff851faa67' },
    { name: 'Università San Raffaele Roma', src: 'https://images.ctfassets.net/5bcqzxwt09xw/7jxFdLUR9wOmTuj6HOcXk5/c04504f178cdac608805d33f547227de/logo-utsr-2025.png?fm=png&q=100&h=160' },
  ];
  return <div className="overflow-hidden border-y border-[hsl(var(--border)/.8)] bg-[hsl(var(--card))] py-5" aria-label="Atenei partner">
    <div className="ticker-track flex w-max items-center whitespace-nowrap">
      {[0, 1].map((copy) => <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-12 pr-12 md:gap-20 md:pr-20">
        {partners.map(({ name, src }) => <PartnerLogo key={name} name={name} src={src} />)}
      </div>)}
    </div>
  </div>;
}

function PartnerLogo({ name, src }: { name: string; src: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="flex w-52 shrink-0 flex-col items-center justify-center gap-3 md:w-64">
    {!failed && <img src={src} alt={`Logo ${name}`} onError={() => setFailed(true)} loading="lazy" decoding="async" className="h-12 w-full object-contain" />}
    <span className="eyebrow !text-[.58rem] text-center">{name}</span>
  </div>;
}
function SectionKicker({ children }: { children: string }) {
  return <p className="eyebrow mb-5 flex items-center gap-3"><span className="h-px w-8 bg-[hsl(var(--primary))]" />{children}</p>;
}

function ContactFields({ values, setValues }: { values: ContactValues; setValues: (values: ContactValues) => void }) {
  const update = (key: keyof ContactValues, value: string) => setValues({ ...values, [key]: value });
  return <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-xs font-semibold">Nome<input className="field mt-2" data-testid="input-first-name" required value={values.firstName} onChange={(e) => update('firstName', e.target.value)} placeholder="Il tuo nome" /></label>
    <label className="text-xs font-semibold">Cognome<input className="field mt-2" data-testid="input-last-name" required value={values.lastName} onChange={(e) => update('lastName', e.target.value)} placeholder="Il tuo cognome" /></label>
    <label className="text-xs font-semibold">Email<input className="field mt-2" data-testid="input-email" required type="email" value={values.email} onChange={(e) => update('email', e.target.value)} placeholder="nome@email.it" /></label>
    <label className="text-xs font-semibold">Provincia<input className="field mt-2" data-testid="input-province" required value={values.province} onChange={(e) => update('province', e.target.value)} placeholder="Es. Milano" /></label>
    <label className="text-xs font-semibold sm:col-span-2">Numero di telefono<input className="field mt-2" data-testid="input-phone" required type="tel" value={values.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+39 333 000 0000" /></label>
  </div>;
}

function Alert({ kind, children }: { kind: 'success' | 'error'; children: string }) {
  return <div role={kind === 'error' ? 'alert' : 'status'} data-testid={`status-${kind}`} className={`mt-5 flex items-start gap-3 border p-4 text-sm ${kind === 'success' ? 'border-[hsl(160_28%_70%)] bg-[hsl(160_35%_94%)]' : 'border-[hsl(var(--destructive)/.35)] bg-[hsl(var(--destructive)/.08)]'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${kind === 'success' ? 'bg-[hsl(160_28%_70%)]' : 'bg-[hsl(var(--destructive))] text-white'}`}>{kind === 'success' ? <Check size={13} /> : '!'}</span><span>{children}</span></div>;
}

function OrientationForm() {
  const client = useQueryClient();
  const { data: courses, isLoading, isError, refetch } = useListCourses();
  const create = useCreateOrientationRequest();
  const [values, setValues] = useState<ContactValues>(contactDefaults);
  const [university, setUniversity] = useState('');
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [meetUrl, setMeetUrl] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const sortedCourses = useMemo(() => (courses ?? []).filter((course) => !university || course.university === university), [courses, university]);
  const slotsQuery = useListAppointmentSlots(
    { date },
    { query: { enabled: Boolean(date), queryKey: getListAppointmentSlotsQueryKey({ date }) } },
  );
  const slots = slotsQuery.data ?? [];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setMeetUrl('');
    if (!university || !courseId) { setMessage({ kind: 'error', text: 'Scegli un ateneo e un corso per continuare.' }); return; }
    if (!date || !time) { setMessage({ kind: 'error', text: 'Scegli una data e un orario disponibile.' }); return; }
    if (date < romeToday()) { setMessage({ kind: 'error', text: 'La data scelta è passata. Seleziona una nuova data.' }); return; }
    const verifiedToken = captchaToken;
    if (!verifiedToken) { setMessage({ kind: 'error', text: 'Spunta «Non sono un robot» per confermare la prenotazione.' }); return; }
    create.mutate({ data: { ...values, university, courseId, date, time, captchaToken: verifiedToken } }, {
      onSuccess: (receipt) => {
        setMeetUrl(receipt.meetUrl);
        setMessage({
          kind: 'success',
          text: receipt.confirmationEmailStatus === 'sent'
            ? 'La tua consulenza è prenotata. Il link è anche nella mail di conferma.'
            : 'La tua consulenza è prenotata. Usa il link qui sotto; la mail di conferma non è stata inviata.',
        });
        void client.invalidateQueries({ queryKey: getListAppointmentSlotsQueryKey({ date }) });
        setValues(contactDefaults); setUniversity(''); setCourseId(''); setDate(''); setTime('');
      },
      onError: (error) => setMessage({ kind: 'error', text: getErrorMessage(error, 'Non è stato possibile inviare la richiesta. Riprova tra poco.') }),
      onSettled: () => { setCaptchaToken(null); setCaptchaResetKey((key) => key + 1); },
    });
  };
  return <form onSubmit={submit} className="space-y-6" data-testid="form-orientation">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold">Ateneo<select className="field mt-2" data-testid="select-university" required value={university} onChange={(e) => { setUniversity(e.target.value); setCourseId(''); }}><option value="">Seleziona l'ateneo</option>{['Pegaso', 'Mercatorum', 'San Raffaele'].map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label className="text-xs font-semibold">Corso di laurea<select className="field mt-2" data-testid="select-course" required value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!university || isLoading}><option value="">{isLoading ? 'Caricamento corsi…' : 'Seleziona il corso'}</option>{['Triennale', 'Magistrale', 'Ciclo unico'].map((category) => {
        const options = sortedCourses.filter((course) => course.category === category);
        return options.length > 0 && <optgroup key={category} label={category}>{options.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.duration}</option>)}</optgroup>;
      })}</select></label>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold">Data della consulenza<input className="field mt-2" data-testid="input-consultation-date" required type="date" min={romeToday()} value={date} onChange={(event) => { setDate(event.target.value); setTime(''); }} /></label>
      <div><span className="text-xs font-semibold">Orario <span className="font-normal text-[hsl(var(--muted-foreground))]">09:00 — 20:00</span></span><div className="mt-2 grid grid-cols-4 gap-2">{!date ? <p className="col-span-4 border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]">Scegli una data per vedere gli orari.</p> : slotsQuery.isLoading ? <div className="col-span-4 h-10 animate-pulse bg-[hsl(var(--muted))]" /> : slotsQuery.isError ? <p className="col-span-4 text-xs text-[hsl(var(--destructive))]">Impossibile caricare gli orari.</p> : slots.length === 0 ? <p className="col-span-4 text-xs text-[hsl(var(--muted-foreground))]">Nessun orario disponibile per questa data.</p> : slots.map((slot: AppointmentSlot) => <button type="button" key={slot.time} disabled={!slot.available} onClick={() => setTime(slot.time)} data-testid={`button-consultation-slot-${slot.time}`} className={`border px-2 py-2 text-xs transition-colors ${time === slot.time ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]'} disabled:cursor-not-allowed disabled:opacity-30`}>{slot.time}</button>)}</div></div>
    </div>
    <p className="text-xs text-[hsl(var(--muted-foreground))]">L’incontro dura un’ora. Gli orari già occupati nel calendario non sono selezionabili.</p>
    {isError && <div className="flex items-center justify-between border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)] p-3 text-sm"><span>Non riesco a caricare i corsi.</span><button type="button" onClick={() => refetch()} className="font-semibold underline" data-testid="button-retry-courses">Riprova</button></div>}
    <div className="border-t border-[hsl(var(--border))] pt-6"><p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">Lasciami i tuoi recapiti: partiremo da qui, senza impegno.</p><ContactFields values={values} setValues={setValues} /></div>
    <RecaptchaCheckbox onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
    {message && <Alert kind={message.kind}>{message.text}</Alert>}
    {meetUrl && <a className="inline-flex border border-[hsl(var(--foreground))] px-4 py-3 text-sm font-semibold underline underline-offset-4" href={meetUrl} target="_blank" rel="noreferrer">Apri il link Google Meet</a>}
    <button type="submit" disabled={create.isPending || !captchaToken} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60" data-testid="button-submit-orientation">{create.isPending ? 'Invio in corso…' : <>Invia la richiesta <ArrowRight size={16} /></>}</button>
  </form>;
}

function TourForm() {
  const client = useQueryClient();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [meetUrl, setMeetUrl] = useState('');
  const [values, setValues] = useState<ContactValues>(contactDefaults);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const create = useCreateTourBooking();
  const slotsQuery = useListAppointmentSlots({ date }, { query: { enabled: Boolean(date), queryKey: getListAppointmentSlotsQueryKey({ date }) } });
  const slots = slotsQuery.data ?? [];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setMeetUrl('');
    if (!date || !time) { setMessage({ kind: 'error', text: 'Scegli prima una data e un orario disponibile.' }); return; }
    if (date < romeToday()) { setMessage({ kind: 'error', text: 'La data scelta è passata. Seleziona una nuova data.' }); return; }
    const verifiedToken = captchaToken;
    if (!verifiedToken) { setMessage({ kind: 'error', text: 'Spunta «Non sono un robot» per confermare la prenotazione.' }); return; }
    create.mutate({ data: { ...values, date, time, captchaToken: verifiedToken } }, {
      onSuccess: (receipt) => {
        void client.invalidateQueries({ queryKey: getListAppointmentSlotsQueryKey({ date }) });
        setMeetUrl(receipt.meetUrl);
        setMessage({
          kind: 'success',
          text: receipt.confirmationEmailStatus === 'sent'
            ? 'Il tuo tour è prenotato. Il link è anche nella mail di conferma.'
            : 'Il tuo tour è prenotato. Usa il link qui sotto; la mail di conferma non è stata inviata.',
        });
        setValues(contactDefaults); setDate(''); setTime('');
      },
      onError: (error) => setMessage({ kind: 'error', text: getErrorMessage(error, 'Non è stato possibile prenotare il tour. Riprova tra poco.') }),
      onSettled: () => { setCaptchaToken(null); setCaptchaResetKey((key) => key + 1); },
    });
  };
  return <form onSubmit={submit} className="space-y-6" data-testid="form-tour">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold">Data del Meet<input className="field mt-2" data-testid="input-tour-date" required type="date" min={romeToday()} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} /></label>
      <div><span className="text-xs font-semibold">Orario <span className="font-normal text-[hsl(var(--muted-foreground))]">09:00 — 20:00</span></span><div className="mt-2 grid grid-cols-4 gap-2">{!date ? <p className="col-span-4 border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]">Scegli una data per vedere gli orari.</p> : slotsQuery.isLoading ? <div className="col-span-4 h-10 animate-pulse bg-[hsl(var(--muted))]" /> : slotsQuery.isError ? <p className="col-span-4 text-xs text-[hsl(var(--destructive))]">Impossibile caricare gli orari.</p> : slots.length === 0 ? <p className="col-span-4 text-xs text-[hsl(var(--muted-foreground))]">Nessun orario disponibile per questa data.</p> : slots.map((slot) => <button type="button" key={slot.time} disabled={!slot.available} onClick={() => setTime(slot.time)} data-testid={`button-slot-${slot.time}`} className={`border px-2 py-2 text-xs transition-colors ${time === slot.time ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]'} disabled:cursor-not-allowed disabled:opacity-30`}>{slot.time}</button>)}</div></div>
    </div>
    <p className="text-xs text-[hsl(var(--muted-foreground))]">Gli appuntamenti durano un’ora e iniziano ogni ora dalle 09:00 alle 20:00.</p>
    <div className="border-t border-[hsl(var(--border))] pt-6"><p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">Un incontro concreto, dal tuo computer, con tutto il tempo per le tue domande.</p><ContactFields values={values} setValues={setValues} /></div>
    <RecaptchaCheckbox onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
    {message && <Alert kind={message.kind}>{message.text}</Alert>}
    {meetUrl && <a className="inline-flex border border-[hsl(var(--foreground))] px-4 py-3 text-sm font-semibold underline underline-offset-4" href={meetUrl} target="_blank" rel="noreferrer">Apri il link Google Meet</a>}
    <button type="submit" disabled={create.isPending || !captchaToken} className="btn-rose w-full disabled:cursor-wait disabled:opacity-60" data-testid="button-submit-tour">{create.isPending ? 'Prenotazione in corso…' : <>Prenota il tuo Meet <CalendarDays size={16} /></>}</button>
  </form>;
}

function Home() {
  return <div className="grain min-h-[100dvh] route-shell"><SiteHeader /><main>
    <section className="hero-route">
      <svg className="route-map" viewBox="0 0 1200 620" preserveAspectRatio="none" aria-hidden="true"><path className="route-line" d="M10 500 C180 420 160 130 360 180 S500 510 690 390 S820 110 1160 170" /><circle cx="360" cy="180" r="9" /><circle cx="690" cy="390" r="9" /><circle className="route-pin" cx="1015" cy="150" r="13" /></svg>
      <div className="route-copy mx-auto grid min-h-[610px] max-w-[1500px] items-center gap-10 px-5 py-20 md:grid-cols-[1.05fr_.95fr] md:px-10 md:py-24">
        <div className="page-in">
          <p className="eyebrow !text-[hsl(var(--primary))]">consulenza universitaria · roma / online</p>
          <h1 className="mt-6 max-w-4xl text-6xl leading-[.9] sm:text-8xl md:text-[8.5rem]">Trova la<br /><span className="text-[hsl(var(--primary))]">tua rotta.</span></h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-[hsl(var(--foreground)/.75)] md:text-xl">L’università non è una risposta da indovinare. È una direzione da mettere a fuoco, insieme.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4"><a href="#servizi" className="btn-rose" data-testid="link-discover-services">Inizia da qui <ArrowRight size={16} /></a><Link href="/chi-sono" className="inline-flex items-center gap-2 border-b border-[hsl(var(--primary))] py-2 text-sm text-[hsl(var(--foreground))]" data-testid="link-meet-sofia">Conosci Sofia <ArrowRight size={15} /></Link></div>
        </div>
        <div className="page-in delay-2 relative z-10 ml-auto max-w-sm border border-[hsl(var(--primary)/.65)] bg-[hsl(var(--secondary)/.92)] p-7 text-[hsl(var(--secondary-foreground))] backdrop-blur-sm md:mr-8 md:p-9">
          <div className="flex items-center justify-between"><span className="route-number">01 / PARTENZA</span><Sparkles size={18} className="text-[hsl(var(--accent))]" /></div>
          <p className="mt-20 font-serif text-3xl leading-tight md:text-4xl">Non devi avere già tutte le risposte.</p>
          <p className="mt-5 text-sm leading-relaxed text-[hsl(var(--background)/.68)]">Una domanda sincera è già un punto sulla mappa. Da lì, costruiamo una direzione.</p>
          <div className="mt-10 flex items-center gap-3 text-xs text-[hsl(var(--background)/.6)]"><span className="h-px w-10 bg-[hsl(var(--accent))]" /> Sofia, personalmente</div>
        </div>
      </div>
    </section>
    <section id="servizi" className="mx-auto max-w-[1500px] scroll-mt-20 px-5 py-20 md:px-10 md:py-28">
      <div className="grid gap-12 md:grid-cols-[.65fr_1.35fr] md:gap-20">
        <div className="max-w-md md:sticky md:top-28 md:self-start"><SectionKicker>scegli il prossimo punto</SectionKicker><h2 className="font-serif text-5xl leading-[.94] md:text-7xl">Da quale<br /><em className="text-[hsl(var(--primary))]">direzione</em><br />partiamo?</h2><p className="mt-7 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Due incontri diversi, una cosa in comune: nessuna pressione. Scegli quello che ti serve adesso.</p></div>
        <div className="grid gap-6">
          <BookingChoiceRow href="/prenota-consulenza" number="01" label="METTERE A FUOCO" title="Consulenza sul corso di laurea" description="Confrontiamo atenei e corsi a partire dai tuoi obiettivi, non da un catalogo." detail="ATENEO · CORSO DI LAUREA" cta="Prenota una consulenza" Icon={GraduationCap} testId="link-booking-orientation" />
          <BookingChoiceRow href="/prenota-tour" number="02" label="VEDERE DA VICINO" title="Tour guidato con Sofia" description="Un incontro online per scoprire la piattaforma e fare tutte le domande che vuoi." detail="MEET · 1 ORA" cta="Prenota il tour" Icon={Video} testId="link-booking-tour" />
        </div>
      </div>
      <div className="mt-20"><PartnerTicker /></div>
    </section>
    <section className="ink-panel relative overflow-hidden"><div className="mx-auto grid max-w-[1500px] gap-12 px-5 py-20 md:grid-cols-[.75fr_1.25fr] md:px-10 md:py-28"><div><p className="eyebrow !text-[hsl(var(--accent))]">il metodo</p><p className="mt-5 font-serif text-4xl leading-[.95] md:text-6xl">La tua situazione<br />è la mappa.</p></div><div className="grid gap-8 sm:grid-cols-3"><div><span className="route-number">01</span><h3 className="mt-4 text-lg font-semibold">Ascolto</h3><p className="mt-3 text-sm leading-relaxed text-[hsl(var(--background)/.65)]">Partiamo da te, non da un elenco di corsi.</p></div><div><span className="route-number">02</span><h3 className="mt-4 text-lg font-semibold">Chiarezza</h3><p className="mt-3 text-sm leading-relaxed text-[hsl(var(--background)/.65)]">Mettiamo a confronto le opzioni reali.</p></div><div><span className="route-number">03</span><h3 className="mt-4 text-lg font-semibold">Presenza</h3><p className="mt-3 text-sm leading-relaxed text-[hsl(var(--background)/.65)]">Resto con te anche dopo la scelta.</p></div></div></div></section>
  </main><SiteFooter /></div>;
}

function BookingPageLayout({ step, title, description, children }: { step: string; title: string; description: string; children: ReactNode }) {
  return <div className="grain min-h-[100dvh] route-shell"><SiteHeader /><main className="page-in">
    <section className="mx-auto max-w-[1500px] px-5 pb-20 pt-8 md:px-10 md:pb-28 md:pt-12">
      <Link href="/" data-testid="link-back-to-services" className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] underline decoration-[hsl(var(--primary))] underline-offset-4"><ArrowRight className="rotate-180" size={15} />Torna alla scelta dei servizi</Link>
      <div className="mt-16 grid gap-10 md:grid-cols-[.78fr_1.22fr] md:items-end"><div><SectionKicker>{step}</SectionKicker><h1 className="max-w-3xl font-serif text-5xl leading-[.94] md:text-8xl">{title}</h1></div><p className="max-w-lg pb-2 leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p></div>
      <section aria-label={title} className="mt-14 grid gap-8 border-t-2 border-[hsl(var(--foreground))] bg-[hsl(var(--card))] p-5 pt-8 md:p-10 md:pt-10">{children}</section>
    </section>
  </main><SiteFooter /></div>;
}

function OrientationBookingPage() {
  return <BookingPageLayout step="01 / prenota" title="Prenota una consulenza" description="Scegli l’ateneo, il corso, la data e l’orario. Il link Google Meet sarà disponibile appena confermi.">
    <h2 className="mb-6 font-serif text-2xl">Il tuo appuntamento</h2><OrientationForm />
  </BookingPageLayout>;
}

function TourBookingPage() {
  return <BookingPageLayout step="02 / tour della piattaforma" title="Prenota il tour della piattaforma" description="Scegli una data e un orario disponibile per incontrarci online. Il tour dura un’ora.">
    <h2 className="mb-6 font-serif text-2xl">Scegli data e orario</h2><TourForm />
  </BookingPageLayout>;
}

function About() {
  return <div className="grain min-h-[100dvh] route-shell">
    <SiteHeader />
    <main className="page-in">
      <section className="mx-auto grid max-w-[1500px] gap-8 px-5 pb-16 pt-16 md:grid-cols-[1fr_.8fr] md:items-end md:px-10 md:pb-24 md:pt-24">
        <div><SectionKicker>chi c’è dall’altra parte</SectionKicker><h1 className="max-w-3xl font-serif text-6xl leading-[.9] tracking-[-.06em] sm:text-8xl">Ciao, sono <em className="text-[hsl(var(--primary))]">Sofia.</em></h1></div>
        <p className="max-w-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Una persona reale, una storia reale, nessuna scelta preconfezionata.</p>
      </section>
      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--primary)/.10)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-2 md:items-center md:px-8 md:py-20">
          <AboutImage label="Il modo in cui Sofia accompagna ogni percorso" caption="La persona, non l’algoritmo." tone="rose" />
          <div><SectionKicker>01 / incontriamoci</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Una persona, prima di tutto.</h2><p className="mt-6 leading-relaxed text-[hsl(var(--muted-foreground))]">Sono Sofia e mi occupo di consulenza universitaria. Il mio lavoro è ascoltare le tue esigenze, aiutarti a confrontare percorsi e atenei e accompagnarti nelle domande che arrivano lungo la strada.</p><p className="mt-4 leading-relaxed text-[hsl(var(--muted-foreground))]">Qui non trovi una scelta già fatta per te: trovi spazio per fare la tua, con più chiarezza.</p></div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
        <div className="md:order-1"><SectionKicker>02 / il percorso</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Perché ho iniziato un percorso all’università telematica.</h2><p className="mt-6 leading-relaxed text-[hsl(var(--muted-foreground))]">Lavoravo in un negozio e avevo ottenuto un contratto a tempo indeterminato. Eppure continuavo a chiedermi: sono davvero soddisfatta di quello che sto facendo? Dentro di me c’era un sogno più grande e non volevo fare la commessa per tutta la vita.</p><p className="mt-4 leading-relaxed text-[hsl(var(--muted-foreground))]">Lavorando a tempo pieno, la presenza obbligatoria e gli spostamenti richiesti da un’università tradizionale non erano compatibili con la mia vita. Ho scelto l’università telematica: non la strada più semplice, ma quella più adatta a me.</p><p className="mt-4 border-l-2 border-[hsl(var(--primary))] pl-4 leading-relaxed text-[hsl(var(--muted-foreground))]">Dopo aver confrontato diversi atenei, ho scelto Scienze e Tecniche Psicologiche (L-24) alla Mercatorum. Per ciò che cercavo, mi convinceva il rapporto tra qualità, prezzo e opportunità offerte. Oggi sono felice di aver fatto questa scelta.</p></div>
        <div className="md:order-2"><AboutImage label="Il percorso universitario online" caption="Una scelta che deve stare nella tua vita." tone="ivory" /></div>
      </section>
      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--primary)/.10)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
          <AboutImage label="Consulenza e supporto all’iscrizione" caption="Ateneo. Corso. Una direzione tua." tone="peach" />
          <div><SectionKicker>03 / un supporto reale</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Non devi fare tutto da solo.</h2><p className="mt-6 leading-relaxed text-[hsl(var(--muted-foreground))]">Un consulente ti aiuta a confrontare i corsi in base ai tuoi obiettivi, a capire requisiti e scadenze, e a muoverti tra documenti e procedure di iscrizione.</p><p className="mt-4 leading-relaxed text-[hsl(var(--muted-foreground))]">Possiamo verificare insieme anche eventuali agevolazioni o sconti, quando disponibili e se possiedi i requisiti. Nessuna promessa automatica: solo indicazioni personalizzate, passo dopo passo.</p><Link href="/#servizi" className="btn-primary mt-7" data-testid="link-about-orientation">Parliamo del tuo percorso <ArrowRight size={16} /></Link></div>
        </div>
      </section>
    </main><SiteFooter />
  </div>;
}

function AboutImage({ label, caption, tone }: { label: string; caption: string; tone: 'rose' | 'ivory' | 'peach' }) {
  const backgrounds = {
    rose: 'bg-[hsl(var(--secondary))] text-[hsl(var(--background))]',
    ivory: 'bg-[hsl(var(--card))]',
    peach: 'bg-[hsl(var(--accent))]',
  };
  return <div role="img" aria-label={label} className={`relative flex min-h-[320px] items-center justify-center overflow-hidden border border-[hsl(var(--foreground)/.25)] md:min-h-[430px] ${backgrounds[tone]}`}>
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M-30 280 C90 260 65 95 194 142 S304 300 394 211 S430 75 548 94" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />
      <circle cx="194" cy="142" r="9" fill="hsl(var(--accent))" />
      <circle cx="394" cy="211" r="9" fill="hsl(var(--primary))" />
      <circle cx="436" cy="88" r="12" fill="hsl(var(--accent))" />
      <circle cx="436" cy="88" r="24" fill="none" stroke="hsl(var(--primary) / .48)" strokeWidth="1" />
    </svg>
    <div className="absolute inset-5 border border-[hsl(var(--foreground)/.24)] md:inset-8" />
    <span className="absolute left-8 top-8 font-mono text-xs tracking-[.16em] text-[hsl(var(--primary))]">S. / 01—03</span>
    <div className="relative max-w-[260px] border border-[hsl(var(--foreground)/.3)] bg-[hsl(var(--background)/.94)] px-7 py-8 text-center text-[hsl(var(--foreground))] md:px-9 md:py-10">
      <span className="serif text-6xl font-bold text-[hsl(var(--primary))]">S.</span>
      <p className="eyebrow mt-5 !text-[.6rem]">una storia in movimento</p>
      <p className="mt-3 font-serif text-xl leading-snug">{caption}</p>
    </div>
  </div>;
}

function Contacts() {
  // These are public contact details; environment values can override them later.
  const tiktok = (import.meta.env.VITE_TIKTOK_URL as string | undefined) || 'https://www.tiktok.com/@studentessauni_sofia';
  const whatsapp = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) || '+39 3420662333';
  const email = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
  const cards = [
    { name: 'WhatsApp', icon: <FaWhatsapp aria-hidden="true" focusable="false" className="h-7 w-7 shrink-0 text-[#25D366]" />, href: whatsapp ? `https://wa.me/${normalizeItalianPhone(whatsapp)}` : undefined, description: 'Scrivimi direttamente, senza formalità.', config: 'Il numero di Sofia sarà disponibile qui a breve.' },
    { name: 'TikTok', icon: <span aria-hidden="true" className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center"><FaTiktok focusable="false" className="absolute -translate-x-[1.5px] translate-y-[1px] text-[#25F4EE]" /><FaTiktok focusable="false" className="absolute translate-x-[1.5px] -translate-y-[1px] text-[#FE2C55]" /><FaTiktok focusable="false" className="relative text-[hsl(var(--background))]" /></span>, href: tiktok || undefined, description: 'Seguimi per scegliere con più leggerezza.', config: 'Il profilo di Sofia sarà disponibile qui a breve.' },
  ];
  return <div className="grain min-h-[100dvh] route-shell"><SiteHeader /><main className="page-in">
    <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 md:px-8 md:pb-24 md:pt-24"><SectionKicker>parliamone</SectionKicker><div className="grid gap-10 md:grid-cols-[1fr_.8fr] md:items-end"><h1 className="max-w-3xl font-serif text-5xl leading-[.98] sm:text-7xl">La domanda<br /><em className="text-[hsl(var(--primary))]">è il tuo inizio.</em></h1><p className="max-w-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Scrivimi nel modo che preferisci. Ti risponderò personalmente appena possibile.</p></div></section>
    <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--accent)/.16)]"><div className="mx-auto grid max-w-7xl gap-4 px-5 py-4 md:grid-cols-2 md:px-8 md:py-8">
      {cards.map((card, index) => {
        const darkTile = index === 1;
        const content = <><span className="flex items-center justify-between">{card.icon}{card.href && <ArrowRight className="transition-transform group-hover:translate-x-1" size={19} />}</span><div><h2 className="mt-14 font-serif text-3xl">{card.name}</h2><p className={`mt-3 max-w-sm text-sm leading-relaxed ${darkTile ? 'text-[hsl(var(--background)/.72)]' : 'text-[hsl(var(--foreground)/.72)]'}`}>{card.href ? card.description : card.config}</p></div><span className="eyebrow mt-9 !text-[.58rem]"> {card.href ? 'apri il canale' : 'disponibile a breve'}</span></>;
        const className = `group flex min-h-[260px] flex-col justify-between border border-[hsl(var(--foreground)/.24)] p-7 transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[hsl(var(--primary))] md:p-9 ${darkTile ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--background))]' : 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'}`;
        return card.href
          ? <a key={card.name} href={card.href} target="_blank" rel="noreferrer" data-testid={`link-${card.name.toLowerCase()}`} className={className}>{content}</a>
          : <div key={card.name} data-testid={`status-${card.name.toLowerCase()}-unconfigured`} aria-disabled="true" className={`${className} cursor-not-allowed opacity-80`}>{content}</div>;
      })}
    </div></section>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24"><div><SectionKicker>{email ? 'anche via email' : 'inizia da qui'}</SectionKicker>{email ? <a href={`mailto:${email}`} data-testid="link-email" className="group flex items-center gap-3 font-serif text-2xl underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-8">{email} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></a> : <Link href="/#servizi" data-testid="link-contact-orientation" className="inline-flex items-center gap-2 font-serif text-2xl underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-8">Invia una richiesta di consulenza <ArrowRight size={18} /></Link>}</div><div><SectionKicker>ovunque tu sia</SectionKicker><p className="flex items-center gap-2 text-sm"><MapPin size={16} className="text-[hsl(var(--primary))]" /> Consulenze online, ovunque tu sia</p></div></section>
    <section className="mx-5 mb-16 bg-[hsl(var(--foreground))] px-6 py-14 text-center text-[hsl(var(--background))] md:mx-8 md:mb-24 md:py-20"><p className="eyebrow !text-[hsl(var(--accent))]">una frase da ricordare</p><p className="mx-auto mt-5 max-w-2xl font-serif text-3xl leading-tight md:text-5xl">La conoscenza è l'investimento che paga i migliori interessi. Sii il protagonista del tuo futuro.</p></section>
  </main><SiteFooter /></div>;
}

function SiteFooter() {
  return <footer className="border-t border-[hsl(var(--border))] px-5 py-7 md:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))] sm:flex-row"><span>© {new Date().getFullYear()} Sofia · Consulenza universitaria</span><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(160_28%_55%)]" /> Rispondo personalmente</span></div></footer>;
}

function AdminAuth({ setupComplete }: { setupComplete: boolean }) {
  const client = useQueryClient();
  const setup = useSetupAdmin();
  const login = useLoginAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!setupComplete && password !== confirm) { setError('Le password non coincidono.'); return; }
    const action = setupComplete ? login : setup;
    action.mutate({ data: { username, password } }, { onSuccess: () => client.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() }), onError: (e) => setError(getErrorMessage(e, 'Credenziali non valide o servizio non disponibile.')) });
  };
  const pending = setup.isPending || login.isPending;
  return <div className="grain route-shell flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--secondary))] px-5 py-12"><div className="w-full max-w-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[8px_8px_0_hsl(var(--accent))] md:p-10"><Link href="/" data-testid="link-admin-logo" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center bg-[hsl(var(--secondary))] font-serif text-lg text-[hsl(var(--accent))]">S</span><span className="font-serif text-lg">sofia / riservata</span></Link><div className="mt-12"><SectionKicker>{setupComplete ? 'accesso protetto' : 'prima configurazione'}</SectionKicker><h1 className="font-serif text-4xl">{setupComplete ? 'Bentornata, Sofia.' : 'Crea il tuo accesso.'}</h1><p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{setupComplete ? 'Accedi per vedere chi sta cercando il suo prossimo percorso.' : 'Questo account sarà l’unico accesso alla tua area riservata.'}</p></div><form onSubmit={submit} className="mt-8 space-y-5"><label className="text-xs font-semibold">Username<input autoComplete="username" className="field mt-2" data-testid="input-admin-username" required minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} /></label><label className="text-xs font-semibold">Password<input autoComplete={setupComplete ? 'current-password' : 'new-password'} className="field mt-2" data-testid="input-admin-password" required minLength={10} type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>{!setupComplete && <label className="text-xs font-semibold">Ripeti la password<input autoComplete="new-password" className="field mt-2" data-testid="input-admin-confirm-password" required minLength={10} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>}{error && <Alert kind="error">{error}</Alert>}<button disabled={pending} className="btn-primary w-full disabled:opacity-60" data-testid="button-admin-submit">{pending ? 'Attendi…' : setupComplete ? 'Accedi alla dashboard' : 'Crea account e accedi'} <ArrowRight size={16} /></button></form></div></div>;
}

function normalizeItalianPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0039') ? digits.slice(2) : digits.startsWith('39') ? digits : `39${digits}`;
}

function WhatsAppButton({ phone, text, id }: { phone: string; text: string; id: string | number }) {
  const href = `https://wa.me/${normalizeItalianPhone(phone)}?text=${encodeURIComponent(text)}`;
  return <a href={href} target="_blank" rel="noreferrer" data-testid={`link-whatsapp-row-${id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(160_32%_38%)] hover:underline"><MessageCircle size={14} /> Contatta su WhatsApp</a>;
}

function Dashboard() {
  const client = useQueryClient();
  const [tab, setTab] = useState<"orientation" | "not_concluded" | "tours" | "enrollments">("orientation");
  const [enrollmentPrefill, setEnrollmentPrefill] = useState<EnrollmentPrefill | null>(null);
  const emailSettings = useGetAdminEmailSettings();
  const adminNotificationEmail = emailSettings.data?.adminNotificationEmail ?? null;
  const { data: summary, isLoading: summaryLoading } = useGetAdminSummary({
    query: { refetchInterval: 15_000, queryKey: getGetAdminSummaryQueryKey() },
  });
  const requests = useListAdminOrientationRequests({
    query: { refetchInterval: 15_000, queryKey: getListAdminOrientationRequestsQueryKey() },
  });
  const allRequests = requests.data ?? [];
  const pendingRequests = allRequests.filter((item) => item.enrollmentOutcome === "pending");
  const notConcludedRequests = allRequests.filter((item) => item.enrollmentOutcome === "not_enrolled");
  const bookings = useListAdminTourBookings();
  const logout = useLogoutAdmin();
  const update = useUpdateTourBookingStatus();
  const next = summary?.nextBooking;
  const statusUpdate = (id: number, status: BookingStatus) => update.mutate(
    { id, data: { status } },
    {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListAdminTourBookingsQueryKey() });
        client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      },
    },
  );
  const tabClass = (active: boolean) => `whitespace-nowrap border-b-2 px-4 py-4 text-sm transition-colors md:px-5 ${active ? "border-[hsl(var(--foreground))] font-semibold" : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`;
  const pendingCommission = summaryLoading ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((summary?.commissionsPendingCents ?? 0) / 100);
  const paidCommission = summaryLoading ? "—" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((summary?.commissionsPaidCents ?? 0) / 100);

  return <div className="min-h-[100dvh] bg-[hsl(var(--secondary)/.28)]">
    <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" data-testid="link-dashboard-logo" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-serif text-lg text-[hsl(var(--primary-foreground))] italic">S</span><span className="font-serif text-lg">sofia / riservata</span></Link>
        <button type="button" onClick={() => logout.mutate(undefined, { onSuccess: () => client.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() }) })} className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-logout"><LogOut size={15} /> Esci</button>
      </div>
    </header>
    <main className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="eyebrow">area riservata · oggi</p><h1 className="mt-2 font-serif text-4xl md:text-5xl">Il tuo lavoro, in un unico posto.</h1></div>
        <span className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-2 w-2 rounded-full bg-[hsl(160_36%_55%)]" /> Sessione attiva</span>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Richieste" value={summaryLoading ? "—" : summary?.orientationRequests ?? 0} icon={<Search size={16} />} />
        <Metric label="Tour in arrivo" value={summaryLoading ? "—" : summary?.upcomingBookings ?? 0} icon={<CalendarDays size={16} />} />
        <Metric label="Iscrizioni attive" value={summaryLoading ? "—" : summary?.enrollmentsTotal ?? 0} icon={<GraduationCap size={16} />} />
        <Metric label="Provvigioni attese" value={pendingCommission} icon={<CircleDollarSign size={16} />} />
        <Metric label="Provvigioni incassate" value={paidCommission} icon={<Check size={16} />} />
        <Metric label="Promemoria scaduti" value={summaryLoading ? "—" : summary?.followUpsDue ?? 0} icon={<Bell size={16} />} />
      </div>
      <AdminEmailSettings />
      <AdminGoogleCalendarSettings />
      {next && <div className="mt-5 flex flex-col justify-between gap-4 border border-[hsl(var(--primary)/.5)] bg-[hsl(var(--primary)/.12)] p-5 sm:flex-row sm:items-center">
        <div><p className="eyebrow !text-[hsl(var(--foreground))]">prossimo appuntamento</p><p className="mt-2 font-serif text-2xl">{next.firstName} {next.lastName}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(next.date)} · {next.time}</p></div>
        <WhatsAppButton phone={next.phone} id={`next-${next.id}`} text={`Ciao ${next.firstName}, sono Sofia! Ti confermo il nostro Meet del ${formatDate(next.date)} alle ${next.time}.`} />
      </div>}
      <section className="mt-10 border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <nav className="flex overflow-x-auto border-b border-[hsl(var(--border))]" role="tablist" aria-label="Gestione area riservata">
          <button type="button" role="tab" aria-selected={tab === "orientation"} onClick={() => setTab("orientation")} data-testid="tab-orientation" className={tabClass(tab === "orientation")}>Richieste <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">{pendingRequests.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "not_concluded"} onClick={() => setTab("not_concluded")} data-testid="tab-not-concluded" className={tabClass(tab === "not_concluded")}>Non concluse <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">{notConcludedRequests.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "tours"} onClick={() => setTab("tours")} data-testid="tab-tours" className={tabClass(tab === "tours")}>Tour Meet</button>
          <button type="button" role="tab" aria-selected={tab === "enrollments"} onClick={() => setTab("enrollments")} data-testid="tab-enrollments" className={tabClass(tab === "enrollments")}>Iscrizioni e provvigioni</button>
        </nav>
        {tab === "orientation" && <OrientationTable
          data={pendingRequests}
          adminNotificationEmail={adminNotificationEmail}
          loading={requests.isLoading}
          error={requests.isError}
          view="requests"
          onRecordEnrollment={(item) => {
            setEnrollmentPrefill(item);
            setTab("enrollments");
          }}
          onEnrollmentRecorded={() => setTab("enrollments")}
          onMarkedNotEnrolled={() => setTab("not_concluded")}
        />}
        {tab === "not_concluded" && <OrientationTable
          data={notConcludedRequests}
          adminNotificationEmail={adminNotificationEmail}
          loading={requests.isLoading}
          error={requests.isError}
          view="not_concluded"
          onRecordEnrollment={(item) => {
            setEnrollmentPrefill(item);
            setTab("enrollments");
          }}
          onEnrollmentRecorded={() => setTab("enrollments")}
          onMarkedNotEnrolled={() => setTab("not_concluded")}
        />}
        {tab === "tours" && <ToursTable data={bookings.data} adminNotificationEmail={adminNotificationEmail} loading={bookings.isLoading} error={bookings.isError} onStatus={statusUpdate} updating={update.isPending} />}
        {tab === "enrollments" && <EnrollmentPanel prefill={enrollmentPrefill} onPrefillConsumed={() => setEnrollmentPrefill(null)} />}
      </section>
    </main>
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">{icon}<span className="eyebrow !text-[.58rem]">{label}</span></div><p className="mt-7 font-serif text-4xl">{value}</p></div>;
}

function TableState({ loading, error }: { loading: boolean; error: boolean }) {
  if (loading) return <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse bg-[hsl(var(--muted))]" />)}</div>;
  if (error) return <div className="p-10 text-center text-sm text-[hsl(var(--destructive))]">Non riesco a caricare i dati. Aggiorna la pagina e riprova.</div>;
  return null;
}

function OrientationTable({
  data,
  adminNotificationEmail,
  loading,
  error,
  view,
  onRecordEnrollment,
  onEnrollmentRecorded,
  onMarkedNotEnrolled,
}: {
  data?: OrientationRequest[];
  adminNotificationEmail: string | null;
  loading: boolean;
  error: boolean;
  view: "requests" | "not_concluded";
  onRecordEnrollment: (item: OrientationRequest) => void;
  onEnrollmentRecorded: () => void;
  onMarkedNotEnrolled: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = useMemo(() => (data ?? []).filter((item) => {
    const term = search.trim().toLocaleLowerCase("it");
    const matchesSearch = !term || `${item.firstName} ${item.lastName} ${item.email} ${item.courseName} ${item.university}`.toLocaleLowerCase("it").includes(term);
    const due = Boolean(
      view === "requests" &&
      item.followUpAt &&
      new Date(item.followUpAt) <= new Date() &&
      item.pipelineStatus !== "enrolled" &&
      item.pipelineStatus !== "closed" &&
      item.enrollmentOutcome === "pending",
    );
    const matchesFilter = filter === "all" ||
      filter === item.pipelineStatus ||
      (filter === "due" && due);
    return matchesSearch && matchesFilter;
  }), [data, filter, search, view]);

  if (loading || error) return <TableState loading={loading} error={error} />;
  if (!data?.length) return <div className="p-10 text-center md:p-12">
    <p className="font-serif text-2xl">{view === "requests" ? "Ancora nessuna richiesta." : "Nessuna pratica non conclusa."}</p>
    <p className="mx-auto mt-2 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">{view === "requests"
      ? "Le nuove richieste inviate dal modulo di consulenza compaiono qui automaticamente. L’elenco si aggiorna ogni 15 secondi."
      : "Le persone contrassegnate con X compaiono qui, senza provvigione. Se l’esito cambia, puoi ancora registrare l’iscrizione con ✓."}</p>
  </div>;
  return <div className="p-5 md:p-7">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row">
      <label className="relative block flex-1"><span className="sr-only">{view === "requests" ? "Cerca richieste" : "Cerca persone non iscritte"}</span><input className="field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca nome, email, corso…" /><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /></label>
      <label className="sm:w-56"><span className="sr-only">Filtra per stato</span><select className="field" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">{view === "requests" ? "Tutte le richieste" : "Tutte le persone"}</option><optgroup label="Stato richiesta">{Object.entries(leadStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>{view === "requests" && <option value="due">Promemoria scaduti</option>}</select></label>
    </div>
    <p className="mb-4 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{view === "requests"
      ? "✓ registra l’iscrizione dai dati già raccolti e segna €180 come incassati. La X sposta la persona in “Non concluse”, senza provvigione."
      : "✓ registra l’iscrizione e segna €180 come incassati. La persona verrà spostata in “Iscrizioni e provvigioni”."}</p>
    <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))] lg:hidden">Scorri la tabella per vedere tutti i dati →</p>
    {visible.length === 0 ? <div className="p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">{view === "requests" ? "Nessuna richiesta corrisponde ai filtri." : "Nessuna persona corrisponde ai filtri."}</div> : <div className="overflow-x-auto">
      <table className="w-full min-w-[1640px] text-left text-sm">
        <thead className="border-b border-[hsl(var(--border))] text-[.68rem] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><tr>{["Data / ora", "Nome", "Cognome", "Email", "Provincia", "Telefono", "Ateneo", "Corso scelto", "Stato richiesta", "Esito iscrizione", "Promemoria", "Iscrizione", "Contatta / gestisci"].map((heading) => <th key={heading} scope="col" className="px-4 py-4">{heading}</th>)}</tr></thead>
        <tbody>{visible.map((item) => <OrientationRow
          key={item.id}
          item={item}
          adminNotificationEmail={adminNotificationEmail}
          onRecordEnrollment={onRecordEnrollment}
          onEnrollmentRecorded={onEnrollmentRecorded}
          onMarkedNotEnrolled={onMarkedNotEnrolled}
        />)}</tbody>
      </table>
    </div>}
  </div>;
}

const leadStatusLabels: Record<OrientationRequest["pipelineStatus"], string> = {
  new: "Nuova",
  contacted: "Contattata",
  considering: "In valutazione",
  enrolled: "Iscritta",
  closed: "Archiviata",
};

function OrientationRow({
  item,
  adminNotificationEmail,
  onRecordEnrollment,
  onEnrollmentRecorded,
  onMarkedNotEnrolled,
}: {
  item: OrientationRequest;
  adminNotificationEmail: string | null;
  onRecordEnrollment: (item: OrientationRequest) => void;
  onEnrollmentRecorded: () => void;
  onMarkedNotEnrolled: () => void;
}) {
  const client = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const cancelAppointment = useCancelOrientationAppointment();
  const resendConfirmation = useResendOrientationConfirmation();
  const resendCancellationEmail = useResendOrientationCancellationEmail();
  const activeAppointment = item.appointmentStatus === "confirmed";
  const cancel = () => {
    if (!window.confirm("Annullare l’appuntamento? L’evento Google Calendar verrà rimosso, l’orario liberato e il cliente riceverà un avviso email.")) return;
    cancelAppointment.mutate({ id: item.id }, {
      onSuccess: async (result) => {
        setActionMessage(result.cancellationEmailStatus === "sent"
          ? "Appuntamento annullato. Avviso email inviato."
          : result.cancellationEmailError || "Appuntamento annullato. Puoi ritentare l’invio dell’avviso.");
        await client.invalidateQueries({ queryKey: getListAdminOrientationRequestsQueryKey() });
      },
      onError: (error) => setActionMessage(getErrorMessage(error, "Non riesco ad annullare l’appuntamento.")),
    });
  };
  const resend = () => resendConfirmation.mutate({ id: item.id }, {
    onSuccess: async (result) => {
      setActionMessage(result.message);
      await client.invalidateQueries({ queryKey: getListAdminOrientationRequestsQueryKey() });
    },
    onError: (error) => setActionMessage(getErrorMessage(error, "Non riesco a inviare la conferma.")),
  });
  const resendCancellation = () => resendCancellationEmail.mutate({ id: item.id }, {
    onSuccess: async (result) => {
      setActionMessage(result.message);
      await client.invalidateQueries({ queryKey: getListAdminOrientationRequestsQueryKey() });
    },
    onError: async (error) => {
      setActionMessage(getErrorMessage(error, "Non riesco a inviare l’avviso di annullamento."));
      await client.invalidateQueries({ queryKey: getListAdminOrientationRequestsQueryKey() });
    },
  });
  return <>
    <tr data-testid={`row-orientation-${item.id}`} className="border-b border-[hsl(var(--border)/.65)]">
      <OrientationRequestDateCell item={item} adminNotificationEmail={adminNotificationEmail} />
      <td className="px-4 py-4 font-semibold">{item.firstName}</td>
      <td className="px-4 py-4 font-semibold">{item.lastName}</td>
      <td className="px-4 py-4">{item.email}</td>
      <td className="px-4 py-4">{item.province}</td>
      <td className="whitespace-nowrap px-4 py-4">{item.phone}</td>
      <td className="px-4 py-4">{item.university}</td>
      <td className="min-w-40 px-4 py-4">{item.courseName}</td>
      <td className="px-4 py-4 text-xs">{leadStatusLabels[item.pipelineStatus]}</td>
      <td className="px-4 py-4 text-xs">{item.enrollmentOutcome === "pending" ? "In attesa" : item.enrollmentOutcome === "enrolled" ? "Iscritta" : "Non iscritta"}</td>
      <td className="whitespace-nowrap px-4 py-4 text-xs">{item.followUpAt ? formatDateTime(item.followUpAt) : "—"}</td>
      <td className="px-4 py-4"><EnrollmentDecisionActions item={item} onEnrollmentRecorded={onEnrollmentRecorded} onMarkedNotEnrolled={onMarkedNotEnrolled} /></td>
      <td className="px-4 py-4"><div className="flex min-w-48 flex-col items-start gap-2"><WhatsAppButton phone={item.phone} id={item.id} text={`Ciao ${item.firstName}, sono Sofia! Ho ricevuto la tua richiesta di consulenza per ${item.courseName}.`} />
        <div className="flex flex-wrap gap-3">
          {activeAppointment && item.confirmationEmailStatus !== "sent" && <button type="button" disabled={resendConfirmation.isPending} onClick={resend} className="text-xs font-semibold underline underline-offset-4 disabled:opacity-50">{resendConfirmation.isPending ? "Invio…" : "Reinvia email"}</button>}
          {activeAppointment && <button type="button" disabled={cancelAppointment.isPending} onClick={cancel} className="text-xs font-semibold text-[hsl(var(--destructive))] underline underline-offset-4 disabled:opacity-50">{cancelAppointment.isPending ? "Annullamento…" : "Annulla appuntamento"}</button>}
          {item.appointmentStatus === "cancelled" && cancellationEmailCanRetry(item.cancellationEmailStatus) && <button type="button" disabled={resendCancellationEmail.isPending} onClick={resendCancellation} className="text-xs font-semibold underline underline-offset-4 disabled:opacity-50">{resendCancellationEmail.isPending ? "Invio avviso…" : item.cancellationEmailStatus === "failed" ? "Riprova avviso email" : "Invia avviso email"}</button>}
          {item.appointmentStatus === "cancelled" && item.cancellationEmailStatus === "sent" && <span className="text-xs text-[hsl(var(--muted-foreground))]">Avviso email inviato{item.cancellationEmailSentAt ? ` · ${formatDateTime(item.cancellationEmailSentAt)}` : ""}</span>}
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-semibold underline underline-offset-4">{expanded ? "Chiudi" : "Gestisci"}</button>
        </div>
        {item.appointmentStatus === "cancelled" && cancellationEmailCanRetry(item.cancellationEmailStatus) && item.cancellationEmailError && <span className="max-w-64 whitespace-normal text-xs text-[hsl(var(--destructive))]">{item.cancellationEmailError}</span>}
        {actionMessage && <span role="status" className="max-w-64 whitespace-normal text-xs text-[hsl(var(--muted-foreground))]">{actionMessage}</span>}
      </div></td>
    </tr>
    {expanded && <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.2)]"><td colSpan={13} className="p-5"><OrientationManagementEditor item={item} onRecordEnrollment={onRecordEnrollment} /></td></tr>}
  </>;
}

function ToursTable({ data, adminNotificationEmail, loading, error, onStatus, updating }: { data?: TourBooking[]; adminNotificationEmail: string | null; loading: boolean; error: boolean; onStatus: (id: number, status: BookingStatus) => void; updating: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | BookingStatus | "due">("all");
  const visible = useMemo(() => (data ?? []).filter((item) => {
    const term = search.trim().toLocaleLowerCase("it");
    const matchesSearch = !term || `${item.firstName} ${item.lastName} ${item.email} ${item.phone}`.toLocaleLowerCase("it").includes(term);
    const due = Boolean(item.followUpAt && new Date(item.followUpAt) <= new Date() && item.status !== "cancelled");
    return matchesSearch && (filter === "all" || filter === item.status || (filter === "due" && due));
  }), [data, filter, search]);
  if (loading || error) return <TableState loading={loading} error={error} />;
  if (!data?.length) return <div className="p-12 text-center"><p className="font-serif text-2xl">Ancora nessun Meet.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Le prossime prenotazioni appariranno qui.</p></div>;
  return <div className="p-5 md:p-7">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row">
      <label className="relative block flex-1"><span className="sr-only">Cerca tour</span><input className="field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca nome, email, telefono…" /><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /></label>
      <label className="sm:w-56"><span className="sr-only">Filtra tour</span><select className="field" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Tutti i tour</option><option value="confirmed">Confermati</option><option value="completed">Completati</option><option value="cancelled">Annullati</option><option value="due">Promemoria scaduti</option></select></label>
    </div>
    <p className="mb-2 text-xs text-[hsl(var(--muted-foreground))] lg:hidden">Scorri la tabella per vedere tutti i dati →</p>
    {visible.length === 0 ? <div className="p-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Nessuna prenotazione corrisponde ai filtri.</div> : <div className="overflow-x-auto">
      <table className="w-full min-w-[1400px] text-left text-sm">
        <thead className="border-b border-[hsl(var(--border))] text-[.68rem] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><tr>{["Data / ora appuntamento", "Nome", "Cognome", "Email", "Provincia", "Telefono", "Stato", "Contatta", "Promemoria", "Ricevuta", "Gestione"].map((heading) => <th key={heading} scope="col" className="px-4 py-4">{heading}</th>)}</tr></thead>
        <tbody>{visible.map((item) => <TourRow key={item.id} item={item} adminNotificationEmail={adminNotificationEmail} onStatus={onStatus} updating={updating} />)}</tbody>
      </table>
    </div>}
  </div>;
}

function TourRow({ item, adminNotificationEmail, onStatus, updating }: { item: TourBooking; adminNotificationEmail: string | null; onStatus: (id: number, status: BookingStatus) => void; updating: boolean }) {
  const client = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const resendConfirmation = useResendTourConfirmation();
  const resendCancellationEmail = useResendTourCancellationEmail();
  const resend = () => resendConfirmation.mutate({ id: item.id }, {
    onSuccess: async (result) => {
      setEmailMessage(result.message);
      await client.invalidateQueries({ queryKey: getListAdminTourBookingsQueryKey() });
    },
    onError: (error) => setEmailMessage(getErrorMessage(error, "Non riesco a inviare la conferma.")),
  });
  const resendCancellation = () => resendCancellationEmail.mutate({ id: item.id }, {
    onSuccess: async (result) => {
      setEmailMessage(result.message);
      await client.invalidateQueries({ queryKey: getListAdminTourBookingsQueryKey() });
    },
    onError: async (error) => {
      setEmailMessage(getErrorMessage(error, "Non riesco a inviare l’avviso di annullamento."));
      await client.invalidateQueries({ queryKey: getListAdminTourBookingsQueryKey() });
    },
  });
  return <>
    <tr data-testid={`row-tour-${item.id}`} className="border-b border-[hsl(var(--border)/.65)]">
      <td className="px-4 py-4">
        <span className="whitespace-nowrap">{formatDate(item.date)} · {item.time}</span>
        {item.meetUrl && <a className="mt-1 block whitespace-nowrap text-xs font-semibold underline underline-offset-4" href={createMeetAccountChooserUrl(item.meetUrl, adminNotificationEmail)} target="_blank" rel="noopener noreferrer" data-testid={`link-meet-tour-${item.id}`}>Apri Google Meet</a>}
        {!item.meetUrl && item.status !== "cancelled" && <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Link non disponibile</span>}
      </td>
      <td className="px-4 py-4 font-semibold">{item.firstName}</td>
      <td className="px-4 py-4 font-semibold">{item.lastName}</td>
      <td className="px-4 py-4">{item.email}</td>
      <td className="px-4 py-4">{item.province}</td>
      <td className="whitespace-nowrap px-4 py-4">{item.phone}</td>
      <td className="px-4 py-4"><select disabled={updating} value={item.status} onChange={(event) => onStatus(item.id, event.target.value as BookingStatus)} data-testid={`select-status-${item.id}`} className={`border px-2 py-2 text-xs ${item.status === "confirmed" ? "border-[hsl(160_28%_70%)] bg-[hsl(160_35%_94%)]" : item.status === "cancelled" ? "border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)]" : "border-[hsl(var(--border))]"}`}><option value="confirmed">Confermato</option><option value="cancelled">Annullato</option><option value="completed">Completato</option></select></td>
      <td className="whitespace-nowrap px-4 py-4"><WhatsAppButton phone={item.phone} id={item.id} text={`Ciao ${item.firstName}, sono Sofia! Ti scrivo per il nostro Meet del ${formatDate(item.date)} alle ${item.time}.`} /></td>
      <td className="whitespace-nowrap px-4 py-4 text-xs">{item.followUpAt ? formatDateTime(item.followUpAt) : "—"}</td>
      <td className="whitespace-nowrap px-4 py-4 text-xs text-[hsl(var(--muted-foreground))]">{formatDateTime(item.createdAt)}</td>
      <td className="px-4 py-4"><div className="flex flex-col items-start gap-2">
        {item.status === "confirmed" && item.meetUrl && item.confirmationEmailStatus !== "sent" && <button type="button" disabled={resendConfirmation.isPending} onClick={resend} className="whitespace-nowrap text-xs font-semibold underline underline-offset-4 disabled:opacity-50">{resendConfirmation.isPending ? "Invio…" : "Reinvia email"}</button>}
        {item.status === "cancelled" && cancellationEmailCanRetry(item.cancellationEmailStatus) && <button type="button" disabled={resendCancellationEmail.isPending} onClick={resendCancellation} className="whitespace-nowrap text-xs font-semibold underline underline-offset-4 disabled:opacity-50">{resendCancellationEmail.isPending ? "Invio avviso…" : item.cancellationEmailStatus === "failed" ? "Riprova avviso email" : "Invia avviso email"}</button>}
        {item.status === "cancelled" && cancellationEmailCanRetry(item.cancellationEmailStatus) && item.cancellationEmailError && <span className="max-w-56 whitespace-normal text-xs text-[hsl(var(--destructive))]">{item.cancellationEmailError}</span>}
        {item.status === "cancelled" && item.cancellationEmailStatus === "sent" && <span className="text-xs text-[hsl(var(--muted-foreground))]">Avviso email inviato{item.cancellationEmailSentAt ? ` · ${formatDateTime(item.cancellationEmailSentAt)}` : ""}</span>}
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-semibold underline underline-offset-4">{expanded ? "Chiudi" : "Gestisci"}</button>
        {emailMessage && <span role="status" className="max-w-56 whitespace-normal text-xs text-[hsl(var(--muted-foreground))]">{emailMessage}</span>}
      </div></td>
    </tr>
    {expanded && <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.2)]"><td colSpan={11} className="p-5"><TourManagementEditor item={item} /></td></tr>}
  </>;
}

function Admin() {
  const { data, isLoading, isError } = useGetAdminStatus();
  if (isLoading) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--secondary)/.35)]"><div className="w-64 space-y-3"><div className="h-10 animate-pulse bg-[hsl(var(--muted))]" /><div className="h-24 animate-pulse bg-[hsl(var(--muted))]" /></div></div>;
  if (isError || !data) return <div className="flex min-h-[100dvh] items-center justify-center p-5 text-center"><div><p className="font-serif text-3xl">Area non disponibile</p><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Controlla la connessione e ricarica la pagina.</p></div></div>;
  if (!data.setupComplete || !data.authenticated) return <AdminAuth setupComplete={data.setupComplete} />;
  return <Dashboard />;
}

function Router() {
  const [location] = useLocation();
  useEffect(() => {
    const pages: Record<string, { title: string; description: string }> = {
      '/': { title: 'Sofia | Consulenza universitaria personalizzata', description: 'Trova il corso di laurea adatto a te tra Pegaso, Mercatorum e San Raffaele. Richiedi una consulenza con Sofia o prenota un tour online della piattaforma.' },
      '/prenota-consulenza': { title: 'Prenota una consulenza | Sofia', description: 'Scegli ateneo, corso, data e orario per prenotare una consulenza con Sofia.' },
      '/prenota-tour': { title: 'Prenota il tour della piattaforma | Sofia', description: 'Scegli la data e l’orario per prenotare il tour online della piattaforma con Sofia.' },
      '/chi-sono': { title: 'Chi sono | Sofia, consulente universitaria', description: 'Conosci Sofia e scopri come un supporto personale può aiutarti a scegliere il tuo percorso universitario online.' },
      '/contatti': { title: 'Contatti | Parla con Sofia', description: 'Contatta Sofia per una consulenza universitaria personalizzata e inizia a valutare le tue possibilità di studio.' },
      '/admin': { title: 'Area riservata | Sofia', description: 'Accesso riservato alla gestione delle richieste e delle prenotazioni.' },
    };
    const page = pages[location] ?? pages['/'];
    document.title = page.title;
    const values: Record<string, string> = {
      'meta[name="description"]': page.description,
      'meta[name="robots"]': location === '/admin' ? 'noindex, nofollow' : 'index, follow',
      'meta[property="og:title"]': page.title,
      'meta[property="og:description"]': page.description,
      'meta[name="twitter:title"]': page.title,
      'meta[name="twitter:description"]': page.description,
    };
    for (const [selector, content] of Object.entries(values)) {
      document.querySelector(selector)?.setAttribute('content', content);
    }
  }, [location]);
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/prenota-consulenza" component={OrientationBookingPage} /><Route path="/prenota-tour" component={TourBookingPage} /><Route path="/chi-sono" component={About} /><Route path="/contatti" component={Contacts} /><Route path="/admin" component={Admin} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;