'use client';
import { useEffect, useRef, useState } from 'react';
import { getRank, MAX_RATING } from '@/game/ranking';
import { getGame } from '@/lib/games';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  oldRating: number;
  newRating: number;
  gameSlug?: string;
  onClose: () => void;
}

// Sparks fly out of the medal on a promotion - fixed offsets so the burst is
// the same every time rather than jittering between renders.
const SPARKS = [
  { dx: '-84px', dy: '-58px', delay: 0 },
  { dx: '80px', dy: '-64px', delay: 90 },
  { dx: '-96px', dy: '18px', delay: 150 },
  { dx: '92px', dy: '26px', delay: 60 },
  { dx: '-46px', dy: '-92px', delay: 200 },
  { dx: '52px', dy: '-88px', delay: 260 },
];

type Stage = 'enter' | 'reveal' | 'done';

export default function RankUpModal({ oldRating, newRating, gameSlug, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('enter');
  const closeRef = useRef<HTMLButtonElement>(null);

  const promoted = newRating > oldRating;
  const oldRank = getRank(oldRating);
  const newRank = getRank(newRating);
  const color = newRank.color;
  const headline = promoted ? (newRating >= MAX_RATING ? 'Master!' : 'Rank Up!') : 'Rank Lost';

  // Run the beats. Anyone who asked for reduced motion gets the end state at once.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setStage('done');
      return;
    }
    // Short first beat: just long enough for the card to land before the medal
    // strikes. Any longer and the card sits visibly empty.
    const t1 = setTimeout(() => setStage('reveal'), 200);
    const t2 = setTimeout(() => setStage('done'), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Dismissable before the animation finishes - never trap the player.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (stage === 'done') closeRef.current?.focus();
  }, [stage]);

  const gameName = gameSlug ? getGame(gameSlug)?.name : null;
  const revealed = stage !== 'enter';

  return (
    <div
      // pointer-events-auto: GamePlay's own end-of-game Dialog (Radix) sets
      // document.body.style.pointerEvents = 'none' while it's open, and only
      // re-enables it inside its own portal. This modal is a plain fixed div
      // rendered from SocialProvider, not that portal, so without an explicit
      // override here it would inherit `none` and render fully unclickable -
      // both dialogs are open at once the moment a ranked game ends.
      className="pointer-events-auto fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${headline}: ${newRank.name}`}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="rank-rim relative w-full max-w-sm overflow-hidden rounded-3xl border-2 bg-card px-8 pb-8 pt-7 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300"
        style={{ '--rank': color } as React.CSSProperties}
      >
        {/* Rank-coloured wash behind the medal. */}
        <div aria-hidden className="rank-wash pointer-events-none absolute inset-x-0 -top-28 h-64 opacity-70 blur-3xl" />

        <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {gameName ? `Ranked · ${gameName}` : 'Ranked'}
        </p>

        {/* ---- medal ---- */}
        <div className="relative mx-auto mt-5 grid size-34 place-items-center">
          {promoted && revealed && (
            <>
              <span
                aria-hidden
                className="rank-ring absolute size-30 rounded-full border"
                style={{ animation: 'rank-ring 1.9s ease-out 0.25s infinite' }}
              />
              {SPARKS.map((s, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="rank-spark absolute size-1.5 rounded-full"
                  style={
                    {
                      '--dx': s.dx,
                      '--dy': s.dy,
                      animation: `rank-spark 1.6s ease-out ${s.delay}ms infinite`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </>
          )}

          {/* The disc is layered - tinted face, rim light, inner bevel - so it
              reads as a struck medal rather than a circle drawn around an emoji. */}
          <div
            className={cn(
              'rank-face relative grid size-30 place-items-center overflow-hidden rounded-full transition-opacity',
              !revealed && 'opacity-0',
            )}
            style={{ animation: revealed ? 'rank-pop 620ms cubic-bezier(0.22, 1.4, 0.36, 1) both' : undefined }}
          >
            <span aria-hidden className="rank-rim absolute inset-1.75 rounded-full border" />
            <span
              className="relative text-7xl leading-none drop-shadow-lg"
              style={{ animation: stage === 'done' ? 'rank-float 3.5s ease-in-out infinite' : undefined }}
            >
              {newRank.emoji}
            </span>
            {revealed && (
              <span
                aria-hidden
                className="absolute inset-y-0 w-10 bg-white/20"
                style={{ animation: 'rank-sheen 1.1s ease-out 350ms both' }}
              />
            )}
          </div>
        </div>

        {/* ---- copy ---- */}
        <h2
          className={cn(
            'relative mt-4 font-display text-3xl font-bold tracking-tight transition-all duration-500',
            revealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            promoted && 'rank-ink rank-headline',
          )}
        >
          {headline}
        </h2>

        <div
          className={cn(
            'relative mt-1.5 flex items-center justify-center gap-2 text-sm transition-all delay-100 duration-500',
            revealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          <span className="text-muted-foreground/70">{oldRank.name}</span>
          <span aria-hidden className="text-muted-foreground/50">
            {promoted ? '→' : '↓'}
          </span>
          <span className="rank-ink font-semibold">{newRank.name}</span>
        </div>

        {/* ---- ladder: every rank, filled up to where you now sit. Grouped in
                threes so the five tiers are legible at a glance. ---- */}
        <div
          className={cn(
            'relative mt-5 flex items-end justify-center gap-0.75 transition-opacity delay-200 duration-500',
            stage === 'done' ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden
        >
          {Array.from({ length: MAX_RATING + 1 }, (_, i) => {
            const seg = getRank(i);
            const filled = i <= newRating;
            const isCurrent = i === newRating;
            return (
              <span
                key={i}
                className={cn(
                  'rounded-full transition-all duration-500',
                  filled && 'rank-seg',
                  isCurrent ? 'h-5 w-2' : 'h-3 w-1.5',
                  i > 0 && i % 3 === 0 && 'ml-1.5', // tier break
                )}
                style={
                  {
                    '--rank': seg.color,
                    background: filled ? undefined : 'var(--color-muted-foreground)',
                    opacity: filled ? (isCurrent ? 1 : 0.9) : 0.18,
                    boxShadow: isCurrent ? `0 0 12px ${seg.color}` : undefined,
                    transitionDelay: `${i * 22}ms`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>

        <Button
          ref={closeRef}
          size="lg"
          className={cn(
            'relative mt-7 w-full font-semibold transition-all duration-500',
            stage === 'done' ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
          )}
          onClick={onClose}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
