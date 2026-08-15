import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrefFor, type GameEntry } from '@/lib/games';
import GameCardIcon from './GameCardIcon';

// A single catalogue tile for the Game Night homepage - a dark, arcade-style panel.
// Live games are clickable and light up with the game's neon accent on hover;
// upcoming games render dimmed with a muted "Coming soon" pill. The per-game accent
// is applied inline (Tailwind can't see dynamic color values).
export default function GameCard({ game }: { game: GameEntry }) {
  const live = game.status === 'live';

  const inner = (
    <>
      {/* accent glow that blooms on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(130% 100% at 0% 0%, ${game.accent}22, transparent 60%)` }}
      />
      <div className="relative flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className="grid size-14 place-items-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 shadow-inner"
            style={{
              background: `linear-gradient(135deg, ${game.accent}22, ${game.accent}08)`,
              borderColor: `${game.accent}44`,
              boxShadow: `0 0 20px -8px ${game.accent}66`,
            }}
          >
            <GameCardIcon slug={game.slug} accent={game.accent} size={30} />
          </span>
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-500/30 bg-lime-500/10 px-2.5 py-1 text-xs font-semibold text-lime-700 dark:border-[#c3f53b3d] dark:bg-[#c3f53b14] dark:text-[#c3f53b]">
              <span className="size-1.5 animate-pulse rounded-full bg-lime-600 dark:bg-[#c3f53b]" /> Live
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground dark:border-[#30343e] dark:bg-[#23262e] dark:text-[#8a909b]">
              Coming soon
            </span>
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground dark:text-[#f2f3f5]">{game.name}</h3>
          <p className="mt-1 text-sm font-semibold" style={{ color: game.accent }}>
            {game.tagline}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground dark:text-[#9aa0ab]">{game.description}</p>
        </div>

        <div className="flex items-center justify-between border-t border-border dark:border-[#2a2d36] pt-4 text-sm">
          <span className="font-medium text-muted-foreground dark:text-[#7f8794]">{game.players}</span>
          {live ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold transition-transform duration-300 group-hover:translate-x-0.5"
              style={{ background: `${game.accent}1f`, color: game.accent }}
            >
              Play <ArrowRight className="size-4" />
            </span>
          ) : (
            <span className="text-muted-foreground/60 dark:text-[#5c626d]">Coming soon</span>
          )}
        </div>
      </div>
    </>
  );

  const base = 'group relative flex flex-col overflow-hidden rounded-[1.4rem] border border-border/80 dark:border-[#2a2d36] bg-card dark:bg-[#1e2027] p-6 shadow-sm dark:shadow-none';

  if (!live) {
    return (
      <div className={cn(base, 'opacity-70')} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <a
      href={hrefFor(game)}
      style={{ ['--glow' as string]: `${game.accent}55` }}
      className={cn(
        base,
        'shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_-16px_rgba(0,0,0,0.7)] transition-all duration-300',
        'hover:-translate-y-1.5 hover:border-[color:var(--glow)] hover:shadow-[0_22px_55px_-20px_var(--glow)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
      )}
    >
      {inner}
    </a>
  );
}
