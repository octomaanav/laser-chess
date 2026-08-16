import { redirect } from 'next/navigation';
import Footer from '@/components/Footer';
import GameCard from '@/components/GameCard';
import Navbar from '@/components/Navbar';
import { GAMES } from '@/lib/games';
import { SITE_NAME } from '@/lib/site';

// The Game Night catalogue - the platform's main product. Server-rendered for SEO.
export default async function Home({ searchParams }: { searchParams: Promise<{ game?: string | string[] }> }) {
  // Backward-compat: old Laser Chess share links were /?game=CODE. Forward them to
  // the game's new home so existing invites keep working.
  const { game } = await searchParams;
  const raw = Array.isArray(game) ? game[0] : game;
  const code = (raw || '').toUpperCase().trim();
  if (code) redirect(`/games/laser-chess?game=${encodeURIComponent(code)}`);

  const liveCount = GAMES.filter((g) => g.status === 'live').length;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground transition-colors duration-200">
      {/* ambient glows + subtle grid for depth in both light and dark */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-28 size-96 rounded-full bg-lime-500/10 dark:bg-[#c3f53b]/10 blur-3xl" />
        <div className="absolute -bottom-32 right-[-4rem] size-96 rounded-full bg-amber-500/10 dark:bg-[#ffb020]/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <Navbar game="platform" className="border-b-0" />

        {/* hero */}
        <div className="mx-auto max-w-2xl px-5 pb-2 pt-6 text-center sm:pt-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-[12px] font-semibold text-lime-700 dark:text-[#c3f53b] shadow-sm backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-lime-600 dark:bg-[#c3f53b]" /> Real-time multiplayer · free · no installs
          </span>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Your table for{' '}
            <span className="bg-gradient-to-r from-lime-600 via-amber-500 to-orange-500 dark:from-[#c3f53b] dark:to-[#ffb020] bg-clip-text text-transparent">game night</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            A growing arcade of fast, real-time multiplayer games. Pick one, grab the link, and play with friends in seconds,
            with no downloads and no accounts required.
          </p>
        </div>

        {/* catalogue */}
        <div className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-10 sm:px-8">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">Games</h2>
            <span className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              {liveCount} playable · {GAMES.length - liveCount} coming soon
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </div>
        </div>

        <Footer className="pb-10 pt-4" />
      </div>
    </main>
  );
}
