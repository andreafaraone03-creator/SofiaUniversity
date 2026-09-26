import type { AnchorHTMLAttributes } from 'react';
import { ArrowRight, GraduationCap, ShieldCheck, Sparkles, Video } from 'lucide-react';
import './_group.css';

type PreviewLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };
function Link({ href: _href, ...props }: PreviewLinkProps) {
  return <a href="#" {...props} />;
}

function SiteHeader() {
  const nav = [
    { href: '/', label: 'Home' },
    { href: '/chi-sono', label: 'Chi sono' },
    { href: '/contatti', label: 'Contatti' },
  ];
  const activeLink = (href: string) => href === '/'
    ? 'font-semibold text-[hsl(var(--foreground))] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[hsl(var(--primary))]'
    : 'text-[hsl(var(--muted-foreground))]';

  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/.75)] bg-[hsl(var(--background)/.95)] backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" data-testid="link-logo" className="group flex shrink-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] font-serif text-lg italic">S</span>
          <span className="leading-none"><strong className="block font-serif text-lg font-medium">sofia</strong><small className="eyebrow block !text-[.52rem] !tracking-[.18em]">orientamento</small></span>
        </Link>
        <nav className="hidden items-center md:flex" aria-label="Navigazione principale">
          {nav.map((item) => <Link key={item.href} href={item.href} aria-current={item.href === '/' ? 'page' : undefined} data-testid={`link-nav-${item.label.toLowerCase().replace(' ', '-')}`} className={`relative px-4 py-3 text-sm transition-colors hover:text-[hsl(var(--primary))] before:absolute before:left-0 before:top-1/2 before:h-4 before:-translate-y-1/2 before:border-l before:border-[hsl(var(--border))] first:before:hidden ${activeLink(item.href)}`}>{item.label}</Link>)}
          <Link href="/admin" data-testid="link-admin" className="ml-3 inline-flex items-center gap-2 border border-[hsl(var(--border))] px-4 py-2.5 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]"><ShieldCheck size={15} />Area riservata<ArrowRight size={13} /></Link>
        </nav>
      </div>
      <div className="border-t border-[hsl(var(--border)/.7)] md:hidden">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 sm:px-5" aria-label="Navigazione principale">
          {nav.map((item) => <Link key={item.href} href={item.href} aria-current={item.href === '/' ? 'page' : undefined} data-testid={`link-nav-${item.label.toLowerCase().replace(' ', '-')}`} className={`relative whitespace-nowrap px-2 py-1.5 text-xs transition-colors ${activeLink(item.href)}`}>{item.label}</Link>)}
          <Link href="/admin" data-testid="link-admin" className="inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))]"><ShieldCheck size={14} />Area riservata</Link>
        </nav>
      </div>
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
    <div className="flex w-max items-center whitespace-nowrap">
      {partners.map(({ name, src }) => <div key={name} className="flex w-44 shrink-0 flex-col items-center justify-center gap-2 md:w-56"><img src={src} alt={`Logo ${name}`} loading="lazy" className="h-[30px] max-w-full object-contain" /><span className="eyebrow !text-[.58rem] text-center">{name}</span></div>)}
    </div>
  </div>;
}

function SectionKicker({ children }: { children: string }) {
  return <p className="eyebrow mb-5 flex items-center gap-3"><span className="h-px w-8 bg-[hsl(var(--primary))]" />{children}</p>;
}

function ServiceCard({ href, number, label, title, description, detail, Icon, testId }: {
  href: string;
  number: string;
  label: string;
  title: string;
  description: string;
  detail: string;
  Icon: typeof GraduationCap;
  testId: string;
}) {
  return <Link href={href} data-testid={testId} className="group flex h-full min-h-[300px] flex-col border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-all hover:-translate-y-1 hover:border-[hsl(var(--primary))] hover:shadow-[0_18px_48px_hsl(var(--foreground)/.08)] md:p-8">
    <div className="flex items-center justify-between">
      <span className="eyebrow">{number} / {label}</span>
      <span className="flex h-11 w-11 items-center justify-center bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--foreground))] transition-colors group-hover:bg-[hsl(var(--primary)/.35)]"><Icon size={21} strokeWidth={1.6} /></span>
    </div>
    <div className="mt-7">
      <h3 className="max-w-sm font-serif text-3xl leading-tight">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p>
    </div>
    <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-[hsl(var(--border))] pt-5">
      <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{detail}</span>
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))] underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-4">
        {number === '01' ? 'Prenota la consulenza' : 'Prenota il tour'}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </span>
    </div>
  </Link>;
}

export function Refined() {
  return <div className="grain min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <SiteHeader />
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-14 md:grid-cols-[1.1fr_.9fr] md:items-end md:px-8 md:pb-24 md:pt-24">
        <div><SectionKicker>una scelta, finalmente tua</SectionKicker><h1 className="max-w-3xl font-serif text-5xl leading-[.98] tracking-[-.04em] sm:text-7xl md:text-[6.3rem]">L’università<br /><em className="text-[hsl(var(--primary))]">giusta per te.</em></h1><p className="mt-8 max-w-lg font-serif text-2xl leading-snug sm:text-3xl">Il tuo futuro universitario inizia qui: scegli la strada giusta con una consulenza personalizzata.</p><p className="mt-4 max-w-lg text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Sono Sofia. Ti aiuto a capire cosa vuoi, a trovare il percorso più adatto e a iniziare senza sentirti solo.</p><div className="mt-8 flex flex-wrap gap-3"><a href="#servizi" className="inline-flex items-center justify-center gap-2 bg-[hsl(var(--foreground))] px-5 py-3 text-sm text-[hsl(var(--background))]">Scopri come posso aiutarti <ArrowRight size={16} /></a><Link href="/chi-sono" className="inline-flex items-center gap-2 px-3 py-3 text-sm underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-4">Conosci Sofia</Link></div></div>
        <div className="relative min-h-[310px] overflow-hidden bg-[hsl(var(--secondary))] p-7 md:min-h-[430px] md:p-10"><div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[hsl(var(--accent)/.65)] blur-2xl" /><div className="relative flex h-full flex-col justify-between"><div className="flex justify-between"><span className="eyebrow">01 / il primo passo</span><Sparkles size={20} strokeWidth={1.5} /></div><div><p className="max-w-xs font-serif text-3xl leading-tight md:text-4xl">Non devi avere già tutte le risposte.</p><p className="mt-4 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Basta una domanda sincera. Da lì, costruiamo una direzione.</p></div><div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-px w-10 bg-[hsl(var(--primary))]" />consulenza personale · online</div></div></div>
      </section>
      <section id="servizi" className="mx-auto max-w-7xl scroll-mt-20 px-5 pb-12 pt-12 md:px-8 md:pb-20 md:pt-16">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl"><SectionKicker>il tuo prossimo passo</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Scegli il supporto<br /><em>che ti serve.</em></h2><p className="mt-4 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Due modi per iniziare, ognuno con la sua prenotazione dedicata.</p></div>
          <span className="inline-flex w-fit items-center gap-2 border border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />Ogni servizio ha il suo modulo dedicato</span>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <ServiceCard href="/prenota-orientamento" number="01" label="ORIENTAMENTO" title="Consulenza sul corso di laurea" description="Confrontiamo atenei e corsi in base ai tuoi obiettivi, per capire quale percorso è più adatto a te." detail="ATENEO · CORSO DI LAUREA" Icon={GraduationCap} testId="link-booking-orientation" />
          <ServiceCard href="/prenota-tour" number="02" label="TOUR DELLA PIATTAFORMA" title="Scopri la piattaforma con Sofia" description="Un incontro guidato online per vedere come funziona e fare tutte le tue domande." detail="MEET · 1 ORA" Icon={Video} testId="link-booking-tour" />
        </div>
        <div className="mt-9"><PartnerTicker /></div>
      </section>
    </main>
  </div>;
}