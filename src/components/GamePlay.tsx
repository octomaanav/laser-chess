'use client';
import { useEffect, useState } from 'react';
import { Bell, BellOff, ChevronLeft, ChevronRight, Clock, Copy, Loader2, LogOut, Radio, RotateCcw, RotateCw } from 'lucide-react';
import type { GameController, PlayerView, ViewState } from '@/client/controller';
import type { Color, PieceType } from '@/game/types';
import { opposite } from '@/game/engine';
import { colorName } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import Board from './Board';
import FriendsMenu from './FriendsMenu';
import LogoMark, { PersonIcon } from './LogoMark';
import RankBadge from './RankBadge';
import ThemeToggle from './ThemeToggle';
import { useSocial } from '@/client/social/SocialProvider';

// Full, static class strings per player color (Tailwind can't see interpolated names).
const PLAYER: Record<Color, { tint: string; seat: string; solid: string }> = {
  red: {
    tint: 'border-player-red/40 bg-player-red/10 text-player-red',
    seat: 'border-player-red/50 bg-player-red/10',
    solid: 'bg-player-red',
  },
  silver: {
    tint: 'border-player-teal/40 bg-player-teal/10 text-player-teal',
    seat: 'border-player-teal/50 bg-player-teal/10',
    solid: 'bg-player-teal',
  },
};
const YOURS_TINT = 'border-laser/40 bg-laser/10 text-laser';

const LEGEND = [
  { type: 'pharaoh', name: 'Pharaoh', desc: 'protect it at all costs.' },
  { type: 'pyramid', name: 'Pyramid', desc: 'single mirror, deflects 90°.' },
  { type: 'scarab', name: 'Scarab', desc: 'double mirror, indestructible; can swap.' },
  { type: 'anubis', name: 'Anubis', desc: 'shielded front, vulnerable behind.' },
  { type: 'sphinx', name: 'Sphinx', desc: 'your laser; rotate only.' },
] as const;

function PieceGlyph({
  type,
  className,
  color,
  size = 14,
}: {
  type: (typeof LEGEND)[number]['type'];
  className?: string;
  color?: Color;
  size?: number;
}) {
  const colorClass = color === 'red' ? 'text-player-red' : color === 'silver' ? 'text-player-teal' : 'text-foreground';
  const common = { width: size, height: size, viewBox: '0 0 14 14', className: cn('shrink-0', colorClass, className) };
  switch (type) {
    case 'pharaoh':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M2 11.5V6l2.5 2.2L7 2.5l2.5 5.7L12 6v5.5z" />
        </svg>
      );
    case 'pyramid':
      return (
        <svg {...common} fill="currentColor">
          <path d="M2 12 12 2 2Z" />
        </svg>
      );
    case 'scarab':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M2.5 2.5 11.5 11.5" />
        </svg>
      );
    case 'anubis':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2.5" y="1.5" width="9" height="11" rx="2.4" />
          <path d="M2.5 6h9" />
        </svg>
      );
    case 'sphinx':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <rect x="2.5" y="3.5" width="9" height="9" rx="2.4" />
          <path d="M7 3.5V0.5" />
        </svg>
      );
  }
}

export default function GamePlay({ controller, view, gameSlug = 'laser-chess' }: { controller: GameController; view: ViewState; gameSlug?: string }) {
  const { myColor, spectator, turn, winner } = view;
  const yours = !spectator && turn === myColor && !winner;
  const social = useSocial();
  const gameRank = social?.rankInfo?.[gameSlug] ?? null;

  const turnText = winner ? `${colorName(winner)} wins` : yours ? 'Your move' : `${colorName(turn)} to move`;
  const reviewing = view.reviewIndex != null;

  const bottomColor: Color = myColor ?? 'silver';
  const topColor = opposite(bottomColor);
  const oppOffline =
    !spectator && view.bothSeated && !winner && view.players[topColor].seated && !view.players[topColor].online;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(view.shareLink);
      controller.toast('Link copied. Send it to a friend!');
    } catch {
      controller.toast('Copy failed. Please select and copy the link');
    }
  };
  // Quitting a live game resigns it, so let the controller notify the server
  // before the navigation tears the socket down.
  const leave = () => controller.leave(() => (window.location.href = window.location.pathname));

  if (!view.connected || !controller.hasState()) {
    return <GameLoadingSkeleton view={view} leave={leave} />;
  }

  const turnPill = winner ? PLAYER[winner].tint : yours ? YOURS_TINT : PLAYER[turn].tint;

  return (
    <section className="flex h-dvh flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5">
        <a href="/" className="flex items-center gap-2 text-foreground">
          <LogoMark size={22} />
          <span className="hidden font-display text-sm font-semibold tracking-tight sm:inline">Laser Chess</span>
        </a>
        <div className={cn('rounded-full border px-2.5 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0', turnPill)}>
          {view.connected ? turnText : 'Connecting…'}
        </div>
        {view.perMoveMs > 0 && view.turnEndsAt != null && !winner && <MoveTimer endsAt={view.turnEndsAt} />}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            onClick={() => controller.toggleSound()}
            title={view.soundNotifyEnabled ? 'Turn notifications enabled (click to mute)' : 'Turn notifications muted (click to unmute)'}
            aria-label="Toggle turn notifications"
          >
            {view.soundNotifyEnabled ? <Bell className="size-4" /> : <BellOff className="size-4 text-muted-foreground" />}
          </Button>
          <FriendsMenu />
          <Badge
            variant="outline"
            className={cn('font-medium whitespace-nowrap shrink-0', spectator || !myColor ? 'text-muted-foreground' : PLAYER[myColor].tint)}
          >
            {spectator || !myColor ? 'Spectating' : `You: ${colorName(myColor)}`}
          </Badge>
          <span
            className={cn('size-2.5 shrink-0 rounded-full', view.connected ? 'bg-emerald-400' : 'bg-destructive')}
            title={view.connected ? 'connected' : 'disconnected'}
          />
          <Button variant="outline" size="sm" onClick={leave} className="shrink-0">
            <LogOut className="size-4" /> Leave
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-1.5 p-2 sm:p-3">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <SeatLabel color={topColor} info={view.players[topColor]} active={turn === topColor && !winner} you={false} />
          </div>

          {view.waiting && (
            <Banner tone="info">
              <b>Waiting for an opponent…</b> Share your link to invite someone.
            </Banner>
          )}
          {!winner && view.forfeitOf && view.forfeitEndsAt != null ? (
            <ForfeitBanner
              label={spectator ? colorName(view.forfeitOf) : view.forfeitOf === myColor ? 'You' : 'Your opponent'}
              endsAt={view.forfeitEndsAt}
            />
          ) : oppOffline ? (
            <Banner tone="warn">
              <b>Opponent disconnected.</b> Waiting to reconnect…
            </Banner>
          ) : null}

          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center py-1">
            <Board controller={controller} />
          </div>

          {/* Action Panel - positioned below the board for smaller screens with fixed height to prevent layout shifts */}
          <div className="flex lg:hidden h-10 shrink-0 items-center justify-center">
            {view.rotations.length > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-1">
                <span className="pl-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rotate</span>
                {view.rotations.some((rot) => rot.spin === -1) && (
                  <Button size="sm" variant="secondary" className="h-7 text-xs px-2.5" onClick={() => controller.rotateSelected(-1)}>
                    <RotateCcw className="size-3.5" /> Left
                  </Button>
                )}
                {view.rotations.some((rot) => rot.spin === 1) && (
                  <Button size="sm" variant="secondary" className="h-7 text-xs px-2.5" onClick={() => controller.rotateSelected(1)}>
                    <RotateCw className="size-3.5" /> Right
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1">
            <SeatLabel color={bottomColor} info={view.players[bottomColor]} active={turn === bottomColor && !winner} you={!spectator} />
          </div>
        </div>

        <aside className="flex shrink-0 flex-col gap-3 overflow-y-auto border-t border-border/70 p-3 lg:w-80 lg:border-l lg:border-t-0">
          {gameRank && (
            <Card className="relative overflow-hidden gap-3 p-4 border-laser/25 bg-linear-to-br from-laser/12 via-card to-card shadow-lg shadow-laser/5">
              <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-laser/70 to-transparent" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Ranked</div>
                  <div className="mt-1 text-sm text-muted-foreground">Climb one rank per win.</div>
                </div>
                <span className="rounded-full border border-laser/30 bg-laser/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-laser">
                  Live
                </span>
              </div>
              <RankBadge rating={gameRank.rating} size="md" />
            </Card>
          )}

          {!spectator && !view.bothSeated && (
            <Card className="gap-3 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invite a friend</div>
              <div className="flex gap-2">
                <Input readOnly value={view.shareLink} onClick={(e) => (e.target as HTMLInputElement).select()} className="text-xs" />
                <Button variant="secondary" size="sm" onClick={copyLink}>
                  <Copy className="size-4" /> Copy
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Room code: <b className="font-mono tracking-widest text-foreground">{view.roomCode ?? 'None'}</b>
              </div>
            </Card>
          )}

          <CasualtiesCard view={view} />

          {view.moves > 0 && (
            <Card className="gap-3 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Moves · {view.moves}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => controller.reviewPrev()} title="previous move">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="flex-1 text-center text-xs text-muted-foreground">{view.reviewLabel ?? 'Live'}</span>
                <Button variant="outline" size="icon" onClick={() => controller.reviewNext()} disabled={!reviewing} title="next move">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              {reviewing && (
                <Button size="sm" className="w-full" onClick={() => controller.reviewLive()}>
                  <Radio className="size-4" /> Back to live
                </Button>
              )}
            </Card>
          )}

          <Card className="hidden gap-3 p-4 lg:flex">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pieces</div>
            <ul className="flex flex-col gap-2 text-sm">
              {LEGEND.map((p) => (
                <li key={p.name} className="flex items-center gap-2.5">
                  <PieceGlyph type={p.type} />
                  <span className="text-muted-foreground">
                    <b className="text-foreground">{p.name}:</b> {p.desc}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">Tap a piece → tap a dot to move, or the ↻ handles to rotate.</p>
          </Card>
        </aside>
      </main>

      {winner && <WinOverlay controller={controller} view={view} />}
    </section>
  );
}

function MoveTimer({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, endsAt - now);
  const total = Math.ceil(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm font-semibold tabular-nums',
        ms <= 10000 ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-border bg-secondary text-foreground',
      )}
    >
      <Clock className="size-3.5" />
      {mm}:{String(ss).padStart(2, '0')}
    </span>
  );
}

function Banner({ tone, children }: { tone: 'info' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'w-full max-w-md rounded-lg border px-3 py-2 text-center text-sm',
        tone === 'warn' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-laser/30 bg-laser/10 text-foreground',
      )}
    >
      {children}
    </div>
  );
}

function ForfeitBanner({ label, endsAt }: { label: string; endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <Banner tone="warn">
      <b>{label} disconnected.</b> Forfeit in {secs}s unless they reconnect…
    </Banner>
  );
}

function SeatLabel({ color, info, active, you }: { color: Color; info: PlayerView; active: boolean; you: boolean }) {
  const name = info.seated ? info.name || colorName(color) : 'Waiting…';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
        active ? PLAYER[color].seat : 'border-border bg-secondary/60',
      )}
    >
      <span className={cn('grid size-6 place-items-center rounded-full text-background', PLAYER[color].solid)}>
        <PersonIcon size={13} />
      </span>
      <span className="font-medium text-foreground">{name}</span>
      {you && <span className="text-xs text-muted-foreground">(you)</span>}
      {info.seated && <span className={cn('size-2 rounded-full', info.online ? 'bg-emerald-400' : 'bg-muted-foreground/50')} />}
    </div>
  );
}

const PIECE_ORDER: PieceType[] = ['pharaoh', 'sphinx', 'anubis', 'scarab', 'pyramid'];

// Card in the right sidebar showing all casualties / destroyed pieces grouped by side with team color accents.
function CasualtiesCard({ view }: { view: ViewState }) {
  const total = view.captured.red.length + view.captured.silver.length;
  if (total === 0) return null;

  // Show top opponent at top, bottom player at bottom to mirror the board orientation
  const bottomColor: Color = view.myColor ?? 'silver';
  const topColor = opposite(bottomColor);
  const displayColors: Color[] = [topColor, bottomColor];

  return (
    <Card className="gap-3 p-4 animate-in fade-in slide-in-from-right-1 duration-200">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Casualties</div>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
          {total} lost
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {displayColors.map((color) => {
          const pieces = view.captured[color];
          const playerInfo = view.players[color];
          const isYou = !view.spectator && color === view.myColor;
          const name = playerInfo.seated ? playerInfo.name || colorName(color) : colorName(color);
          const counts = new Map<PieceType, number>();
          for (const t of pieces) counts.set(t, (counts.get(t) ?? 0) + 1);

          return (
            <div
              key={color}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-2.5 transition-colors',
                color === 'red' ? 'border-player-red/20 bg-player-red/5' : 'border-player-teal/20 bg-player-teal/5'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn('size-2 rounded-full shrink-0', color === 'red' ? 'bg-player-red' : 'bg-player-teal')} />
                  <span className="truncate text-xs font-medium text-foreground">
                    {name} {isYou && <span className="text-[11px] text-muted-foreground font-normal">(you)</span>}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground shrink-0 tabular-nums">
                  {pieces.length} {pieces.length === 1 ? 'lost' : 'lost'}
                </span>
              </div>

              {pieces.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {PIECE_ORDER.filter((t) => counts.has(t)).map((t) => {
                    const count = counts.get(t)!;
                    const pieceDef = LEGEND.find((l) => l.type === t);
                    return (
                      <div
                        key={t}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium backdrop-blur-xs',
                          color === 'red'
                            ? 'border-player-red/30 bg-player-red/10 text-player-red'
                            : 'border-player-teal/30 bg-player-teal/10 text-player-teal'
                        )}
                        title={`${name} lost ${count} ${pieceDef?.name || t}`}
                      >
                        <PieceGlyph type={t} color={color} size={15} />
                        <span className="font-semibold text-foreground text-[11px]">{pieceDef?.name || t}</span>
                        <span className="font-bold tabular-nums text-xs">×{count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[11px] italic text-muted-foreground">No pieces lost</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WinOverlay({ controller, view }: { controller: GameController; view: ViewState }) {
  const { winner, spectator, myColor, overReason } = view;
  const won = !spectator && winner === myColor;
  const byTimeout = overReason === 'timeout';
  const byForfeit = overReason === 'forfeit';
  const loser = colorName(opposite(winner!));
  const emoji = spectator ? '🎉' : won ? '🏆' : '💥';
  const title = spectator ? `${colorName(winner!)} wins!` : won ? 'Victory!' : 'Defeat';
  const sub = spectator
    ? byTimeout
      ? `${loser} ran out of time.`
      : byForfeit
        ? `${loser} disconnected.`
        : 'The game is over.'
    : won
      ? byTimeout
        ? 'Your opponent ran out of time.'
        : byForfeit
          ? 'Your opponent left the game.'
          : 'You struck the enemy Pharaoh.'
      : byTimeout
        ? 'You ran out of time.'
        : byForfeit
          ? 'You were disconnected too long.'
          : 'Your Pharaoh was hit.';
  const { rematchMine, rematchOpp } = view;
  const oppColor = myColor ? opposite(myColor) : 'silver';
  const oppName = view.players[oppColor].name || colorName(oppColor);

  return (
    <Dialog open>
      <DialogContent className="glow-primary sm:max-w-sm [&>button]:hidden">
        <DialogHeader className="items-center text-center">
          <div className="text-5xl">{emoji}</div>
          <DialogTitle className={cn('font-display text-3xl', winner === 'red' ? 'text-player-red' : 'text-player-teal')}>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </DialogHeader>
        {!spectator && rematchOpp && !rematchMine && <p className="text-center text-sm text-laser">{oppName} wants a rematch</p>}
        {!spectator && rematchMine && !rematchOpp && <p className="text-center text-sm text-muted-foreground">Waiting for {oppName} to accept…</p>}
        <DialogFooter className="sm:flex-col sm:space-x-0">
          {!spectator &&
            (rematchOpp && !rematchMine ? (
              <div className="flex gap-2">
                <Button className="glow-primary flex-1" onClick={() => controller.rematch()}>
                  Accept rematch
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => controller.declineRematch()}>
                  Decline
                </Button>
              </div>
            ) : rematchMine ? (
              <Button variant="outline" className="w-full" onClick={() => controller.declineRematch()}>
                Cancel request
              </Button>
            ) : (
              <Button className="glow-primary w-full" onClick={() => controller.rematch()}>
                Rematch (swap sides)
              </Button>
            ))}
          <Button variant="ghost" className="w-full" onClick={() => (window.location.href = window.location.pathname)}>
            New game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GameLoadingSkeleton({ view, leave }: { view: ViewState; leave: () => void }) {
  return (
    <section className="flex h-dvh flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5">
        <div className="flex items-center gap-2 text-foreground">
          <LogoMark size={22} />
          <span className="hidden font-display text-sm font-semibold tracking-tight sm:inline">Laser Chess</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-laser/40 bg-laser/10 px-3 py-1 text-xs font-semibold text-laser animate-pulse">
          <Loader2 className="size-3.5 animate-spin" />
          <span>{view.roomCode ? `Joining ${view.roomCode}…` : 'Connecting…'}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={leave}>
            <LogOut className="size-4" /> Leave
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-1.5 p-2 sm:p-3">
          <Skeleton className="h-9 w-36 rounded-full" />

          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center py-1">
            <div className="relative flex aspect-[10/8] w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-border/80 bg-card/60 p-4 shadow-2xl backdrop-blur">
              <div className="absolute inset-4 grid grid-cols-10 grid-rows-8 gap-1 opacity-15">
                {Array.from({ length: 80 }).map((_, i) => (
                  <div key={i} className="rounded-sm border border-border/40 bg-muted/20" />
                ))}
              </div>
              <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                <div className="relative grid size-12 place-items-center rounded-full border border-laser/40 bg-laser/10 shadow-lg shadow-laser/20">
                  <Loader2 className="size-6 text-laser animate-spin" />
                </div>
                <div className="font-display text-base font-semibold tracking-wide text-foreground">
                  Connecting to Laser Chess
                </div>
                <p className="text-xs text-muted-foreground">
                  {view.roomCode ? (
                    <>Loading room <b className="font-mono tracking-widest text-foreground">{view.roomCode}</b>…</>
                  ) : (
                    'Initializing game session…'
                  )}
                </p>
              </div>
            </div>
          </div>

          <Skeleton className="h-9 w-36 rounded-full" />
        </div>

        <aside className="hidden shrink-0 flex-col gap-3 border-t border-border/70 p-3 lg:flex lg:w-80 lg:border-l lg:border-t-0">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </aside>
      </main>
    </section>
  );
}
