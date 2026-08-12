import { redirect } from 'next/navigation';
import AccountMenu from '@/components/AccountMenu';
import FriendsMenu from '@/components/FriendsMenu';
import GameCard from '@/components/GameCard';
import { GAMES } from '@/lib/games';
import { SITE_NAME } from '@/lib/site';

// A warm-charcoal, arcade palette scoped to the homepage. Overriding these tokens
// on the wrapper re-skins shared components (AccountMenu, buttons) to match, while
// the rest of the app — including /games/laser-chess — keeps the neon-cyan theme.
const arcadeTheme = {
  '--background': '#16171d',
  '--foreground': '#f2f3f5',
  '--card': '#1e2027',
  '--card-foreground': '#f2f3f5',
  '--popover': '#1e2027',
  '--popover-foreground': '#f2f3f5',
  '--primary': '#c3f53b',
  '--primary-foreground': '#16171d',
  '--secondary': '#23262e',
  '--secondary-foreground': '#f2f3f5',
  '--muted': '#1f2229',
  '--muted-foreground': '#9aa0ab',
  '--accent': '#262a33',
  '--accent-foreground': '#f2f3f5',
  '--border': '#2a2d36',
  '--input': '#2a2d36',
  '--ring': '#c3f53b',
  background:
    'radial-gradient(52rem 40rem at 10% -12%, rgba(195,245,59,0.10), transparent 60%),' +
    'radial-gradient(46rem 38rem at 102% 108%, rgba(255,176,32,0.09), transparent 58%),' +
    '#16171d',
} as React.CSSProperties;

// The Game Night catalogue — the platform's main product. Server-rendered for SEO.
export default async function Home({ searchParams }: { searchParams: Promise<{ game?: string | string[] }> }) {
  // Backward-compat: old Laser Chess share links were /?game=CODE. Forward them to
  // the game's new home so existing invites keep working.
  const { game } = await searchParams;
  const raw = Array.isArray(game) ? game[0] : game;
  const code = (raw || '').toUpperCase().trim();
  if (code) redirect(`/games/laser-chess?game=${encodeURIComponent(code)}`);

  const liveCount = GAMES.filter((g) => g.status === 'live').length;

  return (
    <main style={arcadeTheme} className="relative min-h-dvh overflow-hidden">
      {/* faint neon glows + grid for arcade depth */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-28 size-96 rounded-full bg-[#c3f53b] opacity-[0.07] blur-3xl" />
        <div className="absolute -bottom-32 right-[-4rem] size-96 rounded-full bg-[#ffb020] opacity-[0.06] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[#c3f53b] font-display text-sm font-extrabold text-[#16171d] shadow-[0_0_22px_rgba(195,245,59,0.45)]">
              GN
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-[#f2f3f5]">{SITE_NAME}</span>
          </a>
          <div className="flex items-center gap-1.5">
            <FriendsMenu />
            <AccountMenu />
          </div>
        </header>

        {/* hero */}
        <div className="mx-auto max-w-2xl px-5 pb-2 pt-6 text-center sm:pt-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2a2d36] bg-[#1e2027]/80 px-4 py-1.5 text-[12px] font-semibold text-[#c3f53b] shadow-sm backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-[#c3f53b]" /> Real-time multiplayer · free · no installs
          </span>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-[#f2f3f5] sm:text-6xl">
            Your table for{' '}
            <span className="bg-gradient-to-r from-[#c3f53b] to-[#ffb020] bg-clip-text text-transparent">game night</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#9aa0ab]">
            A growing arcade of fast, real-time multiplayer games. Pick one, grab the link, and play with friends in seconds —
            no downloads, no accounts required.
          </p>
        </div>

        {/* catalogue */}
        <div className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-10 sm:px-8">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-[#f2f3f5]">Games</h2>
            <span className="whitespace-nowrap rounded-full border border-[#2a2d36] bg-[#1e2027] px-3 py-1 text-xs font-medium text-[#9aa0ab]">
              {liveCount} playable · {GAMES.length - liveCount} coming soon
            </span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </div>
        </div>

        <footer className="px-5 py-8 text-center text-xs text-[#6b7280]">{SITE_NAME} · play together, anywhere.</footer>
      </div>
    </main>
  );
}
