import { useState, type AnchorHTMLAttributes } from 'react';
import { ArrowRight, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import './_group.css';

type PreviewLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };
function Link({ href: _href, ...props }: PreviewLinkProps) {
  return <a href="#" {...props} />;
}

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = '/';
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
        {partners.map(({ name, src }) => <div key={name} className="flex w-44 shrink-0 flex-col items-center justify-center gap-2 md:w-56"><img src={src} alt={`Logo ${name}`} loading="lazy" className="h-[30px] max-w-full object-contain" /><span className="eyebrow !text-[.58rem] text-center">{name}</span></div>)}
      </div>)}
    </div>
  </div>;
}

function SectionKicker({ children }: { children: string }) {
  return <p className="eyebrow mb-5 flex items-center gap-3"><span className="h-px w-8 bg-[hsl(var(--primary))]" />{children}</p>;
}

export function Current() {
  return <div className="grain min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <SiteHeader />
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-14 md:grid-cols-[1.1fr_.9fr] md:items-end md:px-8 md:pb-24 md:pt-24">
        <div><SectionKicker>una scelta, finalmente tua</SectionKicker><h1 className="max-w-3xl font-serif text-5xl leading-[.98] tracking-[-.04em] sm:text-7xl md:text-[6.3rem]">L’università<br /><em className="text-[hsl(var(--primary))]">giusta per te.</em></h1><p className="mt-8 max-w-lg font-serif text-2xl leading-snug sm:text-3xl">Il tuo futuro universitario inizia qui: scegli la strada giusta con una consulenza personalizzata.</p><p className="mt-4 max-w-lg text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Sono Sofia. Ti aiuto a capire cosa vuoi, a trovare il percorso più adatto e a iniziare senza sentirti solo.</p><div className="mt-8 flex flex-wrap gap-3"><a href="#servizi" className="inline-flex items-center justify-center gap-2 bg-[hsl(var(--foreground))] px-5 py-3 text-sm text-[hsl(var(--background))]">Scopri come posso aiutarti <ArrowRight size={16} /></a><Link href="/chi-sono" className="inline-flex items-center gap-2 px-3 py-3 text-sm underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-4">Conosci Sofia</Link></div></div>
        <div className="relative min-h-[310px] overflow-hidden bg-[hsl(var(--secondary))] p-7 md:min-h-[430px] md:p-10"><div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[hsl(var(--accent)/.65)] blur-2xl" /><div className="relative flex h-full flex-col justify-between"><div className="flex justify-between"><span className="eyebrow">01 / il primo passo</span><Sparkles size={20} strokeWidth={1.5} /></div><div><p className="max-w-xs font-serif text-3xl leading-tight md:text-4xl">Non devi avere già tutte le risposte.</p><p className="mt-4 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Basta una domanda sincera. Da lì, costruiamo una direzione.</p></div><div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]"><span className="h-px w-10 bg-[hsl(var(--primary))]" />consulenza personale · online</div></div></div>
      </section>
      <section id="servizi" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16 md:px-8 md:py-24">
        <div className="max-w-xl"><SectionKicker>da dove vuoi partire?</SectionKicker><h2 className="font-serif text-4xl leading-tight md:text-5xl">Facciamo ordine,<br /><em>insieme.</em></h2><p className="mt-5 text-[hsl(var(--muted-foreground))]">Scegli il momento che ti serve. Non c’è un percorso predefinito: c’è il tuo.</p></div>
        <div className="mt-10"><PartnerTicker /></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Link href="/prenota-orientamento" className="group block border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-colors hover:border-[hsl(var(--foreground))] md:p-8">
            <span className="mb-9 flex h-10 w-10 items-center justify-center bg-[hsl(var(--secondary))] text-lg">01</span><span className="eyebrow">Orientamento</span><h3 className="mt-2 font-serif text-3xl">Orientamento Corso di Laurea</h3><p className="mt-3 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Confrontiamo atenei, corsi e possibilità per capire quale strada ti somiglia davvero.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-4">Prenota un orientamento <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
          </Link>
          <Link href="/prenota-tour" className="group block border border-[hsl(var(--border))] p-6 transition-colors hover:border-[hsl(var(--foreground))] md:p-8">
            <span className="mb-9 flex h-10 w-10 items-center justify-center bg-[hsl(var(--accent))] text-lg">02</span><span className="eyebrow">Meet tour</span><h3 className="mt-2 font-serif text-3xl">Prenota Tour della Piattaforma (Meet)</h3><p className="mt-3 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Ti accompagno dentro la piattaforma con un tour online, semplice e senza tecnicismi.</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline decoration-[hsl(var(--primary))] decoration-2 underline-offset-4">Prenota il tour <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </div>
      </section>
    </main>
  </div>;
}