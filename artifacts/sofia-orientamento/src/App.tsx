import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  getGetAdminStatusQueryKey,
  getGetAdminSummaryQueryKey,
  getListAdminTourBookingsQueryKey,
  getListTourSlotsQueryKey,
  useCreateOrientationRequest,
  useCreateTourBooking,
  useGetAdminStatus,
  useGetAdminSummary,
  useListAdminOrientationRequests,
  useListAdminTourBookings,
  useListCourses,
  useListTourSlots,
  useLoginAdmin,
  useLogoutAdmin,
  useSetupAdmin,
  useUpdateTourBookingStatus,
} from '@workspace/api-client-react';
import type { TourBooking, TourSlot } from '@workspace/api-client-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
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

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const nav = [
    { href: '/', label: 'Home' },
    { href: '/chi-sono', label: 'Chi sono' },
    { href: '/contatti', label: 'Contatti' },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/.75)] bg-[hsl(var(--background)/.92)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link href="/" data-testid="link-logo" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-serif text-lg italic">S</span>
          <span className="leading-none"><strong className="block font-serif text-lg font-medium">sofia</strong><small className="eyebrow block !text-[.52rem] !tracking-[.18em]">orientamento</small></span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigazione principale">
          {nav.map((item) => <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label.toLowerCase().replace(' ', '-')}`} className={`text-sm transition-colors hover:text-[hsl(var(--primary))] ${location === item.href ? 'font-semibold' : 'text-[hsl(var(--muted-foreground))]'}`}>{item.label}</Link>)}
          <Link href="/admin" data-testid="link-admin" className="flex items-center gap-2 border-l border-[hsl(var(--border))] pl-8 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"><ShieldCheck size={15} /> Area riservata</Link>
        </nav>
        <button type="button" onClick={() => setOpen(!open)} className="md:hidden" aria-label="Apri menu" data-testid="button-menu">{open ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
      {open && <nav className="border-t border-[hsl(var(--border))] px-5 py-4 md:hidden" aria-label="Navigazione mobile">
        {nav.map((item) => <Link key={item.href} onClick={() => setOpen(false)} href={item.href} data-testid={`link-mobile-${item.label.toLowerCase().replace(' ', '-')}`} className="block border-b border-[hsl(var(--border)/.55)] py-3 text-sm">{item.label}</Link>)}
        <Link onClick={() => setOpen(false)} href="/admin" data-testid="link-mobile-admin" className="flex items-center gap-2 py-3 text-sm"><ShieldCheck size={15} /> Area riservata</Link>
      </nav>}
    </header>
  );
}

function PartnerTicker() {
  const partners = [
    { name: 'Università Pegaso', src: 'https://images.ctfassets.net/5bcqzxwt09xw/2P2IePvy4MXoer2sa69Nka/67617a6bdcd02fd420fc993e281dfdcf/logo.png?fm=webp&q=80&h=25' },
    { name: 'Universitas Mercatorum', src: 'https://images.ctfassets.net/5bcqzxwt09xw/1vWByA5uMp9RSFsHcXiFfZ/8a543b18bf7a17436809f43fcdf8072e/logo-mercatorum.gif?fm=webp&q=80&h=30' },
    { name: 'Università San Raffaele Roma', src: 'https://images.ctfassets.net/5bcqzxwt09xw/7jxFdLUR9wOmTuj6HOcXk5/c04504f178cdac608805d33f547227de/logo-utsr-2025.png?fm=webp&q=80&h=30' },
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
  return <div className="flex w-44 shrink-0 flex-col items-center justify-center gap-2 md:w-56">
    {!failed && <img src={src} alt={`Logo ${name}`} onError={() => setFailed(true)} loading="lazy" className="h-[30px] max-w-full object-contain" />}
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
  const { data: courses, isLoading, isError, refetch } = useListCourses();
  const create = useCreateOrientationRequest();
  const [values, setValues] = useState<ContactValues>(contactDefaults);
  const [university, setUniversity] = useState('');
  const [courseId, setCourseId] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const sortedCourses = useMemo(() => (courses ?? []).filter((course) => !university || course.university === university), [courses, university]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (!university || !courseId) { setMessage({ kind: 'error', text: 'Scegli un ateneo e un corso per continuare.' }); return; }
    create.mutate({ data: { ...values, university, courseId } }, {
      onSuccess: () => { setMessage({ kind: 'success', text: 'Grazie, ho ricevuto la tua richiesta. Ti contatterò presto per parlarne insieme.' }); setValues(contactDefaults); setUniversity(''); setCourseId(''); },
      onError: (error) => setMessage({ kind: 'error', text: getErrorMessage(error, 'Non è stato possibile inviare la richiesta. Riprova tra poco.') }),
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
    {isError && <div className="flex items-center justify-between border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)] p-3 text-sm"><span>Non riesco a caricare i corsi.</span><button type="button" onClick={() => refetch()} className="font-semibold underline" data-testid="button-retry-courses">Riprova</button></div>}
    <div className="border-t border-[hsl(var(--border))] pt-6"><p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">Lasciami i tuoi recapiti: partiremo da qui, senza impegno.</p><ContactFields values={values} setValues={setValues} /></div>
    {message && <Alert kind={message.kind}>{message.text}</Alert>}
    <button type="submit" disabled={create.isPending} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60" data-testid="button-submit-orientation">{create.isPending ? 'Invio in corso…' : <>Invia la richiesta <ArrowRight size={16} /></>}</button>
  </form>;
}

function TourForm() {
  const client = useQueryClient();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [values, setValues] = useState<ContactValues>(contactDefaults);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const create = useCreateTourBooking();
  const slotsQuery = useListTourSlots({ date }, { query: { enabled: Boolean(date), queryKey: getListTourSlotsQueryKey({ date }) } });
  const slots = (slotsQuery.data ?? []) as TourSlot[];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (!date || !time) { setMessage({ kind: 'error', text: 'Scegli prima una data e un orario disponibile.' }); return; }
    if (date < romeToday()) { setMessage({ kind: 'error', text: 'La data scelta è passata. Seleziona una nuova data.' }); return; }
    create.mutate({ data: { ...values, date, time } }, {
      onSuccess: () => { client.invalidateQueries({ queryKey: getListTourSlotsQueryKey({ date }) }); setMessage({ kind: 'success', text: 'Il tuo Meet è prenotato. Sofia ti condividerà personalmente i dettagli per partecipare.' }); setValues(contactDefaults); setDate(''); setTime(''); },
      onError: (error) => setMessage({ kind: 'error', text: getErrorMessage(error, 'Non è stato possibile prenotare il tour. Riprova tra poco.') }),
    });
  };
  return <form onSubmit={submit} className="space-y-6" data-testid="form-tour">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold">Data del Meet<input className="field mt-2" data-testid="input-tour-date" required type="date" min={romeToday()} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} /></label>
      <div><span className="text-xs font-semibold">Orario <span className="font-normal text-[hsl(var(--muted-foreground))]">09:00 — 20:00</span></span><div className="mt-2 grid grid-cols-4 gap-2">{!date ? <p className="col-span-4 border border-dashed border-[hsl(var(--border))] p-3 text-xs text-[hsl(var(--muted-foreground))]">Scegli una data per vedere gli orari.</p> : slotsQuery.isLoading ? <div className="col-span-4 h-10 animate-pulse bg-[hsl(var(--muted))]" /> : slotsQuery.isError ? <p className="col-span-4 text-xs text-[hsl(var(--destructive))]">Impossibile caricare gli orari.</p> : slots.length === 0 ? <p className="col-span-4 text-xs text-[hsl(var(--muted-foreground))]">Nessun orario disponibile per questa data.</p> : slots.map((slot) => <button type="button" key={slot.time} disabled={!slot.available} onClick={() => setTime(slot.time)} data-testid={`button-slot-${slot.time}`} className={`border px-2 py-2 text-xs transition-colors ${time === slot.time ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]'} disabled:cursor-not-allowed disabled:opacity-30`}>{slot.time}</button>)}</div></div>
    </div>
    <p className="text-xs text-[hsl(var(--muted-foreground))]">Gli appuntamenti iniziano ogni ora dalle 09:00 alle 20:00 e terminano entro le 21:00.</p>
    <div className="border-t border-[hsl(var(--border))] pt-6"><p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">Un incontro concreto, dal tuo computer, con tutto il tempo per le tue domande.</p><ContactFields values={values} setValues={setValues} /></div>
    {message && <Alert kind={message.kind}>{message.text}</Alert>}
    <button type="submit" disabled={create.isPending} className="btn-rose w-full disabled:cursor-wait disabled:opacity-60" data-testid="button-submit-tour">{create.isPending ? 'Prenotazione in corso…' : <>Prenota il tuo Meet <CalendarDays size={16} /></>}</button>
  </form>;
}

function Home() {
  return <div className="grain min-h-[100dvh]"><SiteHeader /><main>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-14 md:grid-cols-[1.1fr_.9fr] md:items-end md:px-8 md:pb-24 md:pt-24">
      <div className="page-in"><SectionKicker>una scelta, finalmente tua</SectionKicker><h1 className="max-w-3xl font-serif text-5xl leading-[.98] tracking-[-.04em] sm:text-7xl md:text-[6.3rem]">L’università<br /><em className="text-[hsl(var(--primary))]">giusta per te.</em></h1><p className="mt-8 max-w-lg font-serif text-2xl leading-snug text-[hsl(var(--foreground))] sm:text-3xl">Il tuo futuro universitario inizia qui: scegli la strada giusta con una consulenza personalizzata.</p><p className="mt-4 max-w-lg text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Sono Sofia. Ti aiuto a capire cosa vuoi, a trovare il percorso più adatto e a iniziare senza sentirti solo.</p><div className="mt-8 flex flex-wrap gap-3"><a href="#servizi" className="btn-primary" data-testid="link-discover-services">Scopri come posso aiutarti <ArrowRight size={16} /></a><Link href="/chi-sono" className="inline-flex items-center gap-2 px-3 py-3 text-sm underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-4" data-testid="link-meet-sofia">Conosci Sofia</Link></div></div>
      <div className="page-in delay-2 relative min-h-[310px] overflow-hidden bg-[hsl(var(--secondary))] p-7 md:min-h-[430px] md:p-10"><div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[hsl(var(--accent)/.65)] blur-2xl" /><div className="relative flex h-full flex-col justify-between"><div className="flex justify-between"><span className="eyebrow">01 / il primo passo</span><Sparkles size={20} strokeWidth={1.5} /></div><div><p className="max-w-xs font-serif text-3xl leading-tight md:text-4xl">Non devi avere già tutte le risposte.</p><p className="mt-4 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Basta una domanda sincera. Da lì, costruiamo una direzione.</p></div><div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-px w-10 bg-[hsl(var(--primary))]" />consulenza personale · online</div></div></div>
    </section>
    <section id="servizi" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16 md:px-8 md:py-24"><div className="max-w-xl"><SectionKicker>da dove vuoi partire?</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Facciamo ordine,<br /><em>insieme.</em></h2><p className="mt-5 text-[hsl(var(--muted-foreground))]">Scegli il momento che ti serve. Non c’è un percorso predefinito: c’è il tuo.</p></div>
      <div className="mt-10"><PartnerTicker /></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => openBooking('orientation')} data-testid="button-open-orientation" aria-label="Vai alla prenotazione per l'orientamento del corso di laurea" aria-pressed={active === 'orientation'} className={`group border p-6 text-left transition-colors md:p-8 ${active === 'orientation' ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary)/.45)]'}`}>
            <span className="mb-9 flex h-10 w-10 items-center justify-center bg-[hsl(var(--secondary))] text-lg">01</span><span className="eyebrow">Orientamento</span><h3 className="mt-2 font-serif text-3xl">Orientamento Corso di Laurea</h3><p className="mt-3 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Confrontiamo atenei, corsi e possibilità per capire quale strada ti somiglia davvero.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-4">Vai alla prenotazione <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
          </button>
          <button type="button" onClick={() => openBooking('tour')} data-testid="button-open-tour" aria-label="Vai alla prenotazione del tour online della piattaforma" aria-pressed={active === 'tour'} className={`group border p-6 text-left transition-colors md:p-8 ${active === 'tour' ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary)/.45)]'}`}>
            <span className="mb-9 flex h-10 w-10 items-center justify-center bg-[hsl(var(--accent))] text-lg">02</span><span className="eyebrow">Meet tour</span><h3 className="mt-2 font-serif text-3xl">Prenota Tour della Piattaforma (Meet)</h3><p className="mt-3 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Ti accompagno dentro la piattaforma con un tour online, semplice e senza tecnicismi.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-4">Vai alla prenotazione <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
          </button>
        </div>
        <div id="prenota" data-testid="booking-section" className="mt-5 scroll-mt-24 border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-9">
          <div className="grid gap-10 md:grid-cols-[.7fr_1.3fr]"><div className="border-b border-[hsl(var(--border))] pb-6 md:border-b-0 md:border-r md:pb-0 md:pr-9"><span className="eyebrow">{active === 'orientation' ? '01 / orientamento corso' : '02 / tour della piattaforma'}</span><h3 id="booking-title" aria-live="polite" className="mt-4 font-serif text-3xl">{active === 'orientation' ? 'Raccontami cosa stai cercando.' : 'Troviamo un’ora per te.'}</h3><p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{active === 'orientation' ? 'Compila il modulo di prenotazione: ti ricontatterò per una prima chiacchierata.' : 'Scegli data e ora per prenotare il tuo tour online di un’ora.'}</p><div className="mt-8 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><Clock3 size={15} /> Risposta personale, non automatica</div></div><div className="pt-1">{active === 'orientation' ? <OrientationForm /> : <TourForm />}</div></div>
        </div>
    </section>
    <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)]"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[.8fr_1.2fr] md:px-8 md:py-20"><div><SectionKicker>come lavoriamo</SectionKicker><p className="font-serif text-3xl leading-tight">La tua situazione<br />è il punto di partenza.</p></div><div className="grid gap-8 sm:grid-cols-3"><div><span className="mono text-sm text-[hsl(var(--primary))]">01</span><h3 className="mt-3 font-semibold">Ascolto</h3><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Partiamo da te, non da un catalogo.</p></div><div><span className="mono text-sm text-[hsl(var(--primary))]">02</span><h3 className="mt-3 font-semibold">Chiarezza</h3><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Mettiamo a confronto le opzioni.</p></div><div><span className="mono text-sm text-[hsl(var(--primary))]">03</span><h3 className="mt-3 font-semibold">Presenza</h3><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Ci sono anche dopo la scelta.</p></div></div></div></section>
  </main><SiteFooter /></div>;
}

function About() {
  return <div className="grain min-h-[100dvh]">
    <SiteHeader />
    <main className="page-in">
      <section className="mx-auto max-w-7xl px-5 pb-12 pt-16 md:px-8 md:pb-20 md:pt-24">
        <SectionKicker>chi c’è dall’altra parte</SectionKicker>
        <h1 className="max-w-3xl font-serif text-5xl leading-[.98] tracking-[-.04em] sm:text-7xl">Ciao, sono <em className="text-[hsl(var(--primary))]">Sofia.</em></h1>
      </section>
      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.38)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-2 md:items-center md:px-8 md:py-20">
          <AboutImage label="La foto di Sofia" tone="rose" />
          <div><SectionKicker>01 / incontriamoci</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Una persona, prima di tutto.</h2><p className="mt-6 leading-relaxed text-[hsl(var(--muted-foreground))]">Sono Sofia e mi occupo di orientamento universitario. Il mio lavoro è ascoltare le tue esigenze, aiutarti a confrontare percorsi e atenei e accompagnarti nelle domande che arrivano lungo la strada.</p><p className="mt-4 leading-relaxed text-[hsl(var(--muted-foreground))]">Qui non trovi una scelta già fatta per te: trovi spazio per fare la tua, con più chiarezza.</p></div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
        <div className="md:order-1"><SectionKicker>02 / il percorso</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Perché ho iniziato un percorso all’università telematica.</h2><p className="mt-6 leading-relaxed text-[hsl(var(--muted-foreground))]">Lavoravo in un negozio e avevo ottenuto un contratto a tempo indeterminato. Eppure continuavo a chiedermi: sono davvero soddisfatta di quello che sto facendo? Dentro di me c’era un sogno più grande e non volevo fare la commessa per tutta la vita.</p><p className="mt-4 leading-relaxed text-[hsl(var(--muted-foreground))]">Lavorando a tempo pieno, la presenza obbligatoria e gli spostamenti richiesti da un’università tradizionale non erano compatibili con la mia vita. Ho scelto l’università telematica: non la strada più semplice, ma quella più adatta a me.</p><p className="mt-4 border-l-2 border-[hsl(var(--primary))] pl-4 leading-relaxed text-[hsl(var(--muted-foreground))]">Dopo aver confrontato diversi atenei, ho scelto Scienze e Tecniche Psicologiche (L-24) alla Mercatorum. Per ciò che cercavo, mi convinceva il rapporto tra qualità, prezzo e opportunità offerte. Oggi sono felice di aver fatto questa scelta.</p></div>
        <div className="md:order-2"><AboutImage label="Il percorso universitario online" tone="ivory" /></div>
      </section>
      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.38)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-24">
          <AboutImage label="Orientamento e supporto all’iscrizione" tone="peach" />
          <div><SectionKicker>03 / un supporto reale</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Non devi fare tutto da solo.</h2><p className="mt-6 leading-relaxed text-[hsl(var(--muted-foreground))]">Un consulente ti aiuta a confrontare i corsi in base ai tuoi obiettivi, a capire requisiti e scadenze, e a orientarti tra documenti e procedure di iscrizione.</p><p className="mt-4 leading-relaxed text-[hsl(var(--muted-foreground))]">Possiamo verificare insieme anche eventuali agevolazioni o sconti, quando disponibili e se possiedi i requisiti. Nessuna promessa automatica: solo indicazioni personalizzate, passo dopo passo.</p><Link href="/#servizi" className="btn-primary mt-7" data-testid="link-about-orientation">Parliamo del tuo percorso <ArrowRight size={16} /></Link></div>
        </div>
      </section>
    </main><SiteFooter />
  </div>;
}

function AboutImage({ label, tone }: { label: string; tone: 'rose' | 'ivory' | 'peach' }) {
  const backgrounds = { rose: 'bg-[hsl(var(--secondary))]', ivory: 'bg-[hsl(var(--card))]', peach: 'bg-[hsl(var(--accent))]' };
  return <div role="img" aria-label={`Segnaposto immagine: ${label}`} className={`relative flex min-h-[320px] items-center justify-center overflow-hidden border border-[hsl(var(--border))] md:min-h-[430px] ${backgrounds[tone]}`}>
    <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full border border-[hsl(var(--foreground)/.15)]" />
    <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-[hsl(var(--primary)/.25)]" />
    <div className="relative max-w-[220px] border border-[hsl(var(--foreground)/.16)] bg-[hsl(var(--card)/.78)] px-7 py-9 text-center">
      <span className="serif text-4xl italic text-[hsl(var(--primary))]">S.</span>
      <p className="eyebrow mt-5 !text-[.6rem]">spazio per una fotografia</p>
      <p className="mt-2 text-sm">{label}</p>
    </div>
  </div>;
}

function Contacts() {
  // These are public contact details; environment values can override them later.
  const tiktok = (import.meta.env.VITE_TIKTOK_URL as string | undefined) || 'https://www.tiktok.com/@studentessauni_sofia';
  const whatsapp = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) || '+39 3420662333';
  const email = import.meta.env.VITE_CONTACT_EMAIL as string | undefined;
  const cards = [
    { name: 'WhatsApp', icon: <MessageCircle size={25} strokeWidth={1.5} />, href: whatsapp ? `https://wa.me/${normalizeItalianPhone(whatsapp)}` : undefined, description: 'Scrivimi direttamente, senza formalità.', config: 'Il numero di Sofia sarà disponibile qui a breve.' },
    { name: 'TikTok', icon: <span className="text-xl font-bold">TT</span>, href: tiktok || undefined, description: 'Seguimi per orientarti con più leggerezza.', config: 'Il profilo di Sofia sarà disponibile qui a breve.' },
  ];
  return <div className="grain min-h-[100dvh]"><SiteHeader /><main className="page-in">
    <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 md:px-8 md:pb-24 md:pt-24"><SectionKicker>parliamone</SectionKicker><div className="grid gap-10 md:grid-cols-[1fr_.8fr] md:items-end"><h1 className="max-w-3xl font-serif text-5xl leading-[.98] sm:text-7xl">La domanda<br /><em className="text-[hsl(var(--primary))]">è il tuo inizio.</em></h1><p className="max-w-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Scrivimi nel modo che preferisci. Ti risponderò personalmente appena possibile.</p></div></section>
    <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)]"><div className="mx-auto grid max-w-7xl gap-0 px-5 md:grid-cols-2 md:px-8">
      {cards.map((card, index) => {
        const content = <><span className="flex items-center justify-between">{card.icon}{card.href && <ArrowRight className="transition-transform group-hover:translate-x-1" size={19} />}</span><h2 className="mt-12 font-serif text-3xl">{card.name}</h2><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">{card.href ? card.description : card.config}</p></>;
        const className = `group block py-10 ${index === 0 ? 'border-b border-[hsl(var(--border))] md:border-b-0 md:border-r md:pr-14' : 'md:pl-14'}`;
        return card.href
          ? <a key={card.name} href={card.href} target="_blank" rel="noreferrer" data-testid={`link-${card.name.toLowerCase()}`} className={className}>{content}</a>
          : <div key={card.name} data-testid={`status-${card.name.toLowerCase()}-unconfigured`} className={`${className} opacity-70`}>{content}</div>;
      })}
    </div></section>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24"><div><SectionKicker>{email ? 'anche via email' : 'inizia da qui'}</SectionKicker>{email ? <a href={`mailto:${email}`} data-testid="link-email" className="group flex items-center gap-3 font-serif text-2xl underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-8">{email} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></a> : <Link href="/#servizi" data-testid="link-contact-orientation" className="inline-flex items-center gap-2 font-serif text-2xl underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-8">Invia una richiesta di orientamento <ArrowRight size={18} /></Link>}</div><div><SectionKicker>ovunque tu sia</SectionKicker><p className="flex items-center gap-2 text-sm"><MapPin size={16} className="text-[hsl(var(--primary))]" /> Consulenze online, ovunque tu sia</p></div></section>
    <section className="mx-5 mb-16 bg-[hsl(var(--foreground))] px-6 py-14 text-center text-[hsl(var(--background))] md:mx-8 md:mb-24 md:py-20"><p className="eyebrow !text-[hsl(var(--primary))]">una frase da ricordare</p><p className="mx-auto mt-5 max-w-2xl font-serif text-3xl leading-tight md:text-5xl">La conoscenza è l'investimento che paga i migliori interessi. Sii il protagonista del tuo futuro.</p></section>
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
  return <div className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--secondary)/.4)] px-5 py-12"><div className="w-full max-w-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-7 shadow-[0_20px_50px_hsl(var(--foreground)/.05)] md:p-10"><Link href="/" data-testid="link-admin-logo" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-serif text-lg italic">S</span><span className="font-serif text-lg">sofia / riservata</span></Link><div className="mt-12"><SectionKicker>{setupComplete ? 'accesso protetto' : 'prima configurazione'}</SectionKicker><h1 className="font-serif text-4xl">{setupComplete ? 'Bentornata, Sofia.' : 'Crea il tuo accesso.'}</h1><p className="mt-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{setupComplete ? 'Accedi per vedere chi sta cercando il suo prossimo percorso.' : 'Questo account sarà l’unico accesso alla tua area riservata.'}</p></div><form onSubmit={submit} className="mt-8 space-y-5"><label className="text-xs font-semibold">Username<input className="field mt-2" data-testid="input-admin-username" required minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} /></label><label className="text-xs font-semibold">Password<input className="field mt-2" data-testid="input-admin-password" required minLength={10} type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>{!setupComplete && <label className="text-xs font-semibold">Ripeti la password<input className="field mt-2" data-testid="input-admin-confirm-password" required minLength={10} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>}{error && <Alert kind="error">{error}</Alert>}<button disabled={pending} className="btn-primary w-full disabled:opacity-60" data-testid="button-admin-submit">{pending ? 'Attendi…' : setupComplete ? 'Accedi alla dashboard' : 'Crea account e accedi'} <ArrowRight size={16} /></button></form></div></div>;
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
  const [tab, setTab] = useState<'orientation' | 'tours'>('orientation');
  const { data: summary, isLoading: summaryLoading } = useGetAdminSummary();
  const requests = useListAdminOrientationRequests();
  const bookings = useListAdminTourBookings();
  const logout = useLogoutAdmin();
  const update = useUpdateTourBookingStatus();
  const next = summary?.nextBooking;
  const statusUpdate = (id: number, status: BookingStatus) => update.mutate({ id, data: { status } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListAdminTourBookingsQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); } });
  return <div className="min-h-[100dvh] bg-[hsl(var(--secondary)/.28)]"><header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 md:px-8"><Link href="/" data-testid="link-dashboard-logo" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-serif text-lg italic">S</span><span className="font-serif text-lg">sofia / riservata</span></Link><button type="button" onClick={() => logout.mutate(undefined, { onSuccess: () => client.invalidateQueries({ queryKey: getGetAdminStatusQueryKey() }) })} className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-logout"><LogOut size={15} /> Esci</button></div></header><main className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-12"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow">area riservata · oggi</p><h1 className="mt-2 font-serif text-4xl md:text-5xl">Le persone che ti stanno cercando.</h1></div><span className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-2 w-2 rounded-full bg-[hsl(160_36%_55%)]" /> Sessione attiva</span></div><div className="mt-10 grid gap-3 sm:grid-cols-3"><Metric label="Richieste orientamento" value={summaryLoading ? '—' : summary?.orientationRequests ?? 0} icon={<Search size={16} />} /><Metric label="Tour prenotati" value={summaryLoading ? '—' : summary?.tourBookings ?? 0} icon={<CalendarDays size={16} />} /><Metric label="In arrivo" value={summaryLoading ? '—' : summary?.upcomingBookings ?? 0} icon={<Clock3 size={16} />} /></div>{next && <div className="mt-5 flex flex-col justify-between gap-4 border border-[hsl(var(--primary)/.5)] bg-[hsl(var(--primary)/.12)] p-5 sm:flex-row sm:items-center"><div><p className="eyebrow !text-[hsl(var(--foreground))]">prossimo appuntamento</p><p className="mt-2 font-serif text-2xl">{next.firstName} {next.lastName}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(next.date)} · {next.time}</p></div><WhatsAppButton phone={next.phone} id={`next-${next.id}`} text={`Ciao ${next.firstName}, sono Sofia! Ti confermo il nostro Meet del ${formatDate(next.date)} alle ${next.time}.`} /></div>}<div className="mt-10 border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="flex border-b border-[hsl(var(--border))]"><button type="button" onClick={() => setTab('orientation')} data-testid="tab-orientation" className={`px-5 py-4 text-sm ${tab === 'orientation' ? 'border-b-2 border-[hsl(var(--foreground))] font-semibold' : 'text-[hsl(var(--muted-foreground))]'}`}>Richieste orientamento</button><button type="button" onClick={() => setTab('tours')} data-testid="tab-tours" className={`px-5 py-4 text-sm ${tab === 'tours' ? 'border-b-2 border-[hsl(var(--foreground))] font-semibold' : 'text-[hsl(var(--muted-foreground))]'}`}>Tour Meet</button></div>{tab === 'orientation' ? <OrientationTable data={requests.data} loading={requests.isLoading} error={requests.isError} /> : <ToursTable data={bookings.data} loading={bookings.isLoading} error={bookings.isError} onStatus={statusUpdate} updating={update.isPending} />}</div></main></div>;
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">{icon}<span className="eyebrow !text-[.58rem]">{label}</span></div><p className="mt-7 font-serif text-4xl">{value}</p></div>;
}

function TableState({ loading, error }: { loading: boolean; error: boolean }) {
  if (loading) return <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse bg-[hsl(var(--muted))]" />)}</div>;
  if (error) return <div className="p-10 text-center text-sm text-[hsl(var(--destructive))]">Non riesco a caricare i dati. Aggiorna la pagina e riprova.</div>;
  return null;
}

function OrientationTable({ data, loading, error }: { data?: Array<{ id: number; firstName: string; lastName: string; email: string; province: string; phone: string; university: string; courseName: string; createdAt: string }>; loading: boolean; error: boolean }) {
  if (loading || error) return <TableState loading={loading} error={error} />;
  if (!data?.length) return <div className="p-12 text-center"><p className="font-serif text-2xl">Ancora nessuna richiesta.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Quando arriverà, la vedrai qui.</p></div>;
  return <div className="overflow-x-auto">
    <p className="px-5 pt-4 text-xs text-[hsl(var(--muted-foreground))] lg:hidden">Scorri la tabella per vedere tutti i dati →</p>
    <table className="w-full min-w-[1260px] text-left text-sm">
      <thead className="border-b border-[hsl(var(--border))] text-[.68rem] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">
        <tr>{['Data / ora', 'Nome', 'Cognome', 'Email', 'Provincia', 'Telefono', 'Ateneo', 'Corso scelto', 'Contatta'].map((heading) => <th key={heading} scope="col" className="px-4 py-4">{heading}</th>)}</tr>
      </thead>
      <tbody>{data.map((item) => <tr key={item.id} data-testid={`row-orientation-${item.id}`} className="border-b border-[hsl(var(--border)/.65)] last:border-0">
        <td className="whitespace-nowrap px-4 py-4 text-xs">{formatDateTime(item.createdAt)}</td>
        <td className="px-4 py-4 font-semibold">{item.firstName}</td>
        <td className="px-4 py-4 font-semibold">{item.lastName}</td>
        <td className="px-4 py-4">{item.email}</td>
        <td className="px-4 py-4">{item.province}</td>
        <td className="whitespace-nowrap px-4 py-4">{item.phone}</td>
        <td className="px-4 py-4">{item.university}</td>
        <td className="min-w-40 px-4 py-4">{item.courseName}</td>
        <td className="whitespace-nowrap px-4 py-4"><WhatsAppButton phone={item.phone} id={item.id} text={`Ciao ${item.firstName}, sono Sofia! Ho ricevuto la tua richiesta di orientamento per ${item.courseName}.`} /></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function ToursTable({ data, loading, error, onStatus, updating }: { data?: TourBooking[]; loading: boolean; error: boolean; onStatus: (id: number, status: BookingStatus) => void; updating: boolean }) {
  if (loading || error) return <TableState loading={loading} error={error} />;
  if (!data?.length) return <div className="p-12 text-center"><p className="font-serif text-2xl">Ancora nessun Meet.</p><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Le prossime prenotazioni appariranno qui.</p></div>;
  return <div className="overflow-x-auto">
    <p className="px-5 pt-4 text-xs text-[hsl(var(--muted-foreground))] lg:hidden">Scorri la tabella per vedere tutti i dati →</p>
    <table className="w-full min-w-[1180px] text-left text-sm">
    <thead className="border-b border-[hsl(var(--border))] text-[.68rem] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">
      <tr>{['Data / ora appuntamento', 'Nome', 'Cognome', 'Email', 'Provincia', 'Telefono', 'Stato', 'Contatta', 'Ricevuta'].map((heading) => <th key={heading} scope="col" className="px-4 py-4">{heading}</th>)}</tr>
    </thead>
    <tbody>{data.map((item) => <tr key={item.id} data-testid={`row-tour-${item.id}`} className="border-b border-[hsl(var(--border)/.65)] last:border-0">
      <td className="whitespace-nowrap px-4 py-4">{formatDate(item.date)} · {item.time}</td>
      <td className="px-4 py-4 font-semibold">{item.firstName}</td>
      <td className="px-4 py-4 font-semibold">{item.lastName}</td>
      <td className="px-4 py-4">{item.email}</td>
      <td className="px-4 py-4">{item.province}</td>
      <td className="whitespace-nowrap px-4 py-4">{item.phone}</td>
      <td className="px-4 py-4"><select disabled={updating} value={item.status} onChange={(e) => onStatus(item.id, e.target.value as BookingStatus)} data-testid={`select-status-${item.id}`} className={`border px-2 py-2 text-xs ${item.status === 'confirmed' ? 'border-[hsl(160_28%_70%)] bg-[hsl(160_35%_94%)]' : item.status === 'cancelled' ? 'border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.06)]' : 'border-[hsl(var(--border))]'}`}><option value="confirmed">Confermato</option><option value="cancelled">Annullato</option><option value="completed">Completato</option></select></td>
      <td className="whitespace-nowrap px-4 py-4"><WhatsAppButton phone={item.phone} id={item.id} text={`Ciao ${item.firstName}, sono Sofia! Ti scrivo per il nostro Meet del ${formatDate(item.date)} alle ${item.time}.`} /></td>
      <td className="whitespace-nowrap px-4 py-4 text-xs text-[hsl(var(--muted-foreground))]">{formatDateTime(item.createdAt)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

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
      '/': { title: 'Sofia | Orientamento universitario personalizzato', description: 'Trova il corso di laurea adatto a te tra Pegaso, Mercatorum e San Raffaele. Richiedi una consulenza con Sofia o prenota un tour online della piattaforma.' },
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
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/chi-sono" component={About} /><Route path="/contatti" component={Contacts} /><Route path="/admin" component={Admin} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}

export default App;