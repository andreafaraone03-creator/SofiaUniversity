import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--secondary))] px-5 text-[hsl(var(--background))]">
      <main className="relative w-full max-w-3xl overflow-hidden border border-[hsl(var(--primary)/.55)] p-8 md:p-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[24px] border-[hsl(var(--primary)/.35)]" />
        <div className="relative">
          <div className="flex items-center gap-3 text-[hsl(var(--accent))]"><Compass size={22} /><span className="eyebrow !text-[hsl(var(--accent))]">fuori rotta · 404</span></div>
          <h1 className="mt-10 font-serif text-6xl leading-[.9] md:text-8xl">Questa strada<br /><span className="text-[hsl(var(--primary))]">non esiste.</span></h1>
          <p className="mt-7 max-w-md leading-relaxed text-[hsl(var(--background)/.68)]">La pagina che cerchi non è sulla mappa. Torniamo a un punto da cui partire.</p>
          <Link href="/" className="btn-rose mt-9" data-testid="link-not-found-home"><ArrowLeft size={16} />Torna alla home</Link>
        </div>
      </main>
    </div>
  );
}
