import { useState, type AnchorHTMLAttributes } from 'react';
import { ArrowRight, GraduationCap, ShieldCheck, Sparkles, Video } from 'lucide-react';
import './_group.css';

const navigation = [
  { href: '/', label: 'Home' },
  { href: '/chi-sono', label: 'Chi sono' },
  { href: '/contatti', label: 'Contatti' },
];

function StubLink({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} {...props} onClick={(event) => { event.preventDefault(); props.onClick?.(event); }}>
      {children}
    </a>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/.75)] bg-[hsl(var(--background)/.95)] backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 md:px-8">
        <StubLink href="/" data-testid="link-logo" className="group flex shrink-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-serif text-lg italic">S</span>
          <span className="leading-none">
            <strong className="block font-serif text-lg font-medium">sofia</strong>
            <small className="eyebrow block !text-[.52rem] !tracking-[.18em]">orientamento</small>
          </span>
        </StubLink>
        <nav className="hidden items-center md:flex" aria-label="Navigazione principale">
          {navigation.map((item) => (
            <StubLink
              key={item.href}
              href={item.href}
              data-testid={`link-nav-${item.label.toLowerCase().replace(' ', '-')}`}
              className="relative px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--primary))] before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:border-l before:border-[hsl(var(--border))] first:before:hidden"
            >
              {item.label}
            </StubLink>
          ))}
          <StubLink
            href="/admin"
            data-testid="link-admin"
            className="ml-3 inline-flex items-center gap-2 border border-[hsl(var(--border))] px-4 py-2.5 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]"
          >
            <ShieldCheck size={15} />Area riservata<ArrowRight size={13} />
          </StubLink>
        </nav>
      </div>
      <div className="border-t border-[hsl(var(--border)/.7)] md:hidden">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 sm:px-5" aria-label="Navigazione principale">
          {navigation.map((item) => (
            <StubLink
              key={item.href}
              href={item.href}
              data-testid={`link-mobile-${item.label.toLowerCase().replace(' ', '-')}`}
              className="relative whitespace-nowrap px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))]"
            >
              {item.label}
            </StubLink>
          ))}
          <StubLink href="/admin" data-testid="link-mobile-admin" className="inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <ShieldCheck size={14} />Area riservata
          </StubLink>
        </nav>
      </div>
    </header>
  );
}

function SectionKicker({ children }: { children: string }) {
  return <p className="eyebrow mb-5 flex items-center gap-3"><span className="h-px w-8 bg-[hsl(var(--primary))]" />{children}</p>;
}

function ChoiceRow({
  number,
  label,
  title,
  description,
  detail,
  cta,
  href,
  testId,
  Icon,
}: {
  number: string;
  label: string;
  title: string;
  description: string;
  detail: string;
  cta: string;
  href: string;
  testId: string;
  Icon: typeof GraduationCap;
}) {
  return (
    <StubLink
      href={href}
      data-testid={testId}
      className="group grid gap-5 border-b border-[hsl(var(--border))] py-7 transition-colors hover:bg-[hsl(var(--secondary)/.18)] sm:grid-cols-[4.5rem_1fr_auto] sm:items-center sm:px-5 md:gap-8 md:py-8"
    >
      <div className="flex items-center gap-3 sm:block">
        <span className="font-mono text-sm text-[hsl(var(--primary))]">{number}</span>
        <span className="eyebrow !text-[.61rem]">{label}</span>
      </div>
      <div className="flex gap-4">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--foreground))] transition-colors group-hover:bg-[hsl(var(--primary)/.35)] sm:flex">
          <Icon size={21} strokeWidth={1.6} />
        </span>
        <div>
          <h3 className="font-serif text-2xl leading-tight md:text-[1.8rem]">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p>
          <p className="mt-3 text-[.66rem] font-medium tracking-[.12em] text-[hsl(var(--muted-foreground))]">{detail}</p>
        </div>
      </div>
      <span className="inline-flex min-h-11 w-fit items-center gap-2 bg-[hsl(var(--foreground))] px-4 py-3 text-sm font-semibold text-[hsl(var(--background))] transition-colors group-hover:bg-[hsl(var(--primary))] group-hover:text-[hsl(var(--foreground))] sm:ml-3">
        {cta}<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </span>
    </StubLink>
  );
}

function PartnerTicker() {
  const partners = [
    { name: 'Università Pegaso', src: 'https://images.ctfassets.net/5bcqzxwt09xw/2P2IePvy4MXoer2sa69Nka/67617a6bdcd02fd420fc993e281dfdcf/logo.png?fm=webp&q=80&h=25' },
    { name: 'Universitas Mercatorum', src: 'https://images.ctfassets.net/5bcqzxwt09xw/1vWByA5uMp9RSFsHcXiFfZ/8a543b18bf7a17436809f43fcdf8072e/logo-mercatorum.gif?fm=webp&q=80&h=30' },
    { name: 'Università San Raffaele Roma', src: 'https://images.ctfassets.net/5bcqzxwt09xw/7jxFdLUR9wOmTuj6HOcXk5/c04504f178cdac608805d33f547227de/logo-utsr-2025.png?fm=webp&q=80&h=30' },
  ];
  return (
    <div className="grid gap-5 border-y border-[hsl(var(--border)/.8)] bg-[hsl(var(--card))] px-4 py-5 sm:grid-cols-3 sm:gap-2" aria-label="Atenei partner">
      {partners.map((partner) => (
        <PartnerLogo key={partner.name} {...partner} />
      ))}
    </div>
  );
}

function PartnerLogo({ name, src }: { name: string; src: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex min-h-[54px] flex-col items-center justify-center gap-2">
      {!failed && <img src={src} alt={`Logo ${name}`} onError={() => setFailed(true)} loading="lazy" className="h-[30px] max-w-full object-contain" />}
      <span className="eyebrow text-center !text-[.58rem]">{name}</span>
    </div>
  );
}

export function SofiaChoice() {
  return (
    <div className="grain min-h-[100dvh] bg-[hsl(var(--background))] font-sans text-[hsl(var(--foreground))]">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-14 md:grid-cols-[1.1fr_.9fr] md:items-end md:px-8 md:pb-20 md:pt-24">
          <div className="page-in">
            <SectionKicker>una scelta, finalmente tua</SectionKicker>
            <h1 className="max-w-3xl font-serif text-5xl leading-[.98] tracking-[-.04em] sm:text-7xl md:text-[6.3rem]">
              L’università<br /><em className="text-[hsl(var(--primary))]">giusta per te.</em>
            </h1>
            <p className="mt-8 max-w-lg font-serif text-2xl leading-snug text-[hsl(var(--foreground))] sm:text-3xl">
              Il tuo futuro universitario inizia qui: scegli la strada giusta con una consulenza personalizzata.
            </p>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              Sono Sofia. Ti aiuto a capire cosa vuoi, a trovare il percorso più adatto e a iniziare senza sentirti solo.
            </p>
          </div>
          <div className="page-in delay-2 relative min-h-[280px] overflow-hidden bg-[hsl(var(--secondary))] p-7 md:min-h-[360px] md:p-10">
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[hsl(var(--accent)/.65)] blur-2xl" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex justify-between">
                <span className="eyebrow">01 / il primo passo</span>
                <Sparkles size={20} strokeWidth={1.5} />
              </div>
              <div className="py-8">
                <p className="max-w-xs font-serif text-3xl leading-tight md:text-4xl">Non devi avere già tutte le risposte.</p>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Basta una domanda sincera. Da lì, costruiamo una direzione.</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="h-px w-10 bg-[hsl(var(--primary))]" />consulenza personale · online
              </div>
            </div>
          </div>
        </section>

        <section id="servizi" className="mx-auto max-w-7xl scroll-mt-20 px-5 pb-12 pt-10 md:px-8 md:pb-20 md:pt-16">
          <div className="grid gap-5 border-b border-[hsl(var(--border))] pb-6 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-2xl">
              <SectionKicker>il tuo prossimo passo</SectionKicker>
              <h2 className="font-serif text-4xl leading-tight md:text-5xl">Scegli il supporto<br /><em>che ti serve.</em></h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Due modi per iniziare, ognuno con la sua prenotazione dedicata.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 border border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />Ogni servizio ha il suo modulo dedicato
            </span>
          </div>
          <div className="mt-2">
            <ChoiceRow
              number="01"
              label="ORIENTAMENTO"
              title="Consulenza sul corso di laurea"
              description="Confrontiamo atenei e corsi in base ai tuoi obiettivi, per capire quale percorso è più adatto a te."
              detail="ATENEO · CORSO DI LAUREA"
              cta="Prenota la consulenza"
              href="/prenota-orientamento"
              testId="link-booking-orientation"
              Icon={GraduationCap}
            />
            <ChoiceRow
              number="02"
              label="TOUR DELLA PIATTAFORMA"
              title="Scopri la piattaforma con Sofia"
              description="Un incontro guidato online per vedere come funziona e fare tutte le tue domande."
              detail="MEET · 1 ORA"
              cta="Prenota il tour"
              href="/prenota-tour"
              testId="link-booking-tour"
              Icon={Video}
            />
          </div>
          <div className="mt-9"><PartnerTicker /></div>
        </section>

        <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[.8fr_1.2fr] md:px-8 md:py-20">
            <div>
              <SectionKicker>come lavoriamo</SectionKicker>
              <p className="font-serif text-3xl leading-tight">La tua situazione<br />è il punto di partenza.</p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              <div><span className="font-mono text-sm text-[hsl(var(--primary))]">01</span><h3 className="mt-3 font-semibold">Ascolto</h3><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Partiamo da te, non da un catalogo.</p></div>
              <div><span className="font-mono text-sm text-[hsl(var(--primary))]">02</span><h3 className="mt-3 font-semibold">Chiarezza</h3><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Mettiamo a confronto le opzioni.</p></div>
              <div><span className="font-mono text-sm text-[hsl(var(--primary))]">03</span><h3 className="mt-3 font-semibold">Presenza</h3><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Ci sono anche dopo la scelta.</p></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default SofiaChoice;