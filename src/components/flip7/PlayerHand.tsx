// src/components/flip7/PlayerHand.tsx
import React from 'react';
import { Crown, ShieldPlus, Sparkles, WifiOff } from 'lucide-react';
import type { Player } from '@/game/flip7/types';
import { computeHandScore } from '@/game/flip7/engine';
import Flip7Card from './art/Flip7Card';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<Player['status'], string> = {
  active: 'Active',
  stayed: 'Stayed',
  busted: 'Busted',
  frozen: 'Frozen',
  forfeited: 'Left',
};

const STATUS_COLOR: Record<Player['status'], string> = {
  active: 'var(--flip7-amber)',
  stayed: 'var(--flip7-green)',
  busted: 'var(--flip7-danger)',
  frozen: '#38bdf8',
  forfeited: 'var(--flip7-text-muted)',
};

export default function PlayerHand({
  player,
  isYou,
  isTurn,
  isDealer,
  variant = 'opponent',
  className,
}: {
  player: Player;
  isYou: boolean;
  isTurn: boolean;
  isDealer: boolean;
  variant?: 'opponent' | 'hero';
  className?: string;
}) {
  const score = computeHandScore(player.hand);
  const numberCards = player.hand.filter((c) => c.kind === 'number');
  const uniqueNumbers = numberCards.length;
  const hasSecondChance = player.hand.some((c) => c.kind === 'action' && c.action === 'second-chance');
  const hasMultiplier = player.hand.some((c) => c.kind === 'multiplier');

  const displayCards =
    player.status === 'busted' && player.bustedHand && player.bustedHand.length > 0
      ? player.bustedHand
      : player.hand;

  let duplicateVal: number | null = null;
  if (player.status === 'busted' && player.bustedHand) {
    const counts = new Map<number, number>();
    for (const c of player.bustedHand) {
      if (c.kind === 'number') {
        counts.set(c.value, (counts.get(c.value) ?? 0) + 1);
        if ((counts.get(c.value) ?? 0) > 1) {
          duplicateVal = c.value;
        }
      }
    }
  }

  // HERO (YOU) LAYOUT
  if (variant === 'hero') {
    return (
      <div
        className={cn(
          'relative flex w-full h-full flex-col justify-between gap-3 rounded-2xl border-2 p-3.5 sm:p-5 transition-all shadow-xl backdrop-blur-md',
          isTurn
            ? 'border-amber-400 bg-gradient-to-b from-[#1c2432]/95 to-[#131a26]/95 shadow-[0_0_24px_rgba(255,176,32,0.25)]'
            : 'border-white/10 bg-[#121824]/90',
          player.status === 'busted' && 'border-red-500/40 bg-red-950/20',
          className
        )}
      >
        {isTurn && (
          <span className="absolute -top-2.5 left-4 rounded-full bg-amber-400 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md border border-white">
            YOUR TURN
          </span>
        )}

        {/* Hero Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {isDealer && (
              <span title="Dealer">
                <Crown className="size-4 text-amber-400" />
              </span>
            )}
            <span className="text-sm sm:text-base font-black text-slate-100">
              {player.name} <span className="text-[10px] sm:text-xs text-amber-400 font-bold">(You)</span>
            </span>
          </div>

          {/* Flip 7 Progress Bar */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-xs">
            <span className="font-extrabold uppercase text-amber-400 text-[10px]">Flip 7:</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-1.5 w-2.5 sm:h-2 sm:w-3.5 rounded-full transition-all duration-300',
                    idx < uniqueNumbers
                      ? uniqueNumbers >= 7
                        ? 'bg-amber-400 shadow-[0_0_8px_rgba(255,176,32,1)]'
                        : 'bg-emerald-400'
                      : 'bg-white/15'
                  )}
                />
              ))}
            </div>
            <span className="font-mono font-bold text-slate-200 text-[10px] sm:text-xs">{uniqueNumbers}/7</span>
          </div>

          {/* Status & Badges */}
          <div className="flex items-center gap-1.5">
            {hasSecondChance && (
              <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] sm:text-xs font-black text-emerald-300 border border-emerald-500/40">
                <ShieldPlus className="size-3" /> Shield
              </span>
            )}
            {hasMultiplier && (
              <span className="flex items-center gap-0.5 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] sm:text-xs font-black text-amber-300 border border-amber-500/40">
                <Sparkles className="size-3" /> ×2
              </span>
            )}
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider"
              style={{
                borderColor: STATUS_COLOR[player.status],
                color: STATUS_COLOR[player.status],
                background: `color-mix(in oklab, ${STATUS_COLOR[player.status]} 15%, transparent)`,
              }}
            >
              {STATUS_LABEL[player.status]}
            </span>
          </div>
        </div>

        {/* Hero Cards Strip */}
        <div className="flex flex-1 min-h-[76px] flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-black/40 p-2.5 sm:p-3 shadow-inner">
          {displayCards.length === 0 ? (
            <span className="w-full text-center text-xs text-slate-500 py-3">
              No cards yet this round. Draw your first card!
            </span>
          ) : (
            displayCards.map((c, i) => {
              const isDup =
                player.status === 'busted' &&
                c.kind === 'number' &&
                c.value === duplicateVal;

              return (
                <div key={i} className="transform transition-transform hover:-translate-y-1">
                  <Flip7Card
                    card={c}
                    size="sm"
                    isDuplicate={isDup}
                    isDimmed={player.status === 'busted' && !isDup}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Hero Footer Score Bar */}
        <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
          <span className="text-slate-400">
            Round Potential:{' '}
            <strong
              className={cn(
                'text-xs sm:text-sm font-black',
                player.status === 'busted'
                  ? 'text-red-400 line-through'
                  : 'text-amber-400 font-mono'
              )}
            >
              {player.status === 'busted' ? 0 : score} pts
            </strong>
          </span>
          <span className="text-slate-400">
            Total Banked:{' '}
            <strong className="text-xs sm:text-sm font-black text-slate-100 font-mono">
              {player.totalScore} pts
            </strong>
          </span>
        </div>
      </div>
    );
  }

  // OPPONENT COMPACT SEATING PODIUM
  return (
    <div
      className={cn(
        'relative flex flex-1 min-w-0 flex-col justify-between gap-2 rounded-xl border p-3 transition-all backdrop-blur-sm',
        isTurn
          ? 'border-amber-400/80 bg-[#192230]/90 shadow-lg ring-2 ring-amber-400/50'
          : 'border-white/10 bg-[#121822]/80',
        player.status === 'busted' && 'border-red-500/30 bg-red-950/15 opacity-80',
        player.status === 'forfeited' && 'opacity-40',
        className
      )}
    >
      {isTurn && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-amber-400 px-2 py-0.2 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-950 shadow border border-white">
          Active Turn
        </span>
      )}

      {/* Opponent Header */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5 truncate">
          {isDealer && (
            <span title="Dealer">
              <Crown className="size-3.5 text-amber-400 shrink-0" />
            </span>
          )}
          <span className="truncate text-xs font-bold text-slate-200">
            {player.name}
          </span>
          {!player.connected && player.status !== 'forfeited' && (
            <WifiOff className="size-3 text-red-400 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasSecondChance && (
            <span title="Has Second Chance Shield">
              <ShieldPlus className="size-3.5 text-emerald-400" />
            </span>
          )}
          {hasMultiplier && (
            <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">
              ×2
            </span>
          )}
          <span
            className="rounded-full border px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider"
            style={{
              borderColor: STATUS_COLOR[player.status],
              color: STATUS_COLOR[player.status],
            }}
          >
            {STATUS_LABEL[player.status]}
          </span>
        </div>
      </div>

      {/* Opponent Progress & Score */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Cards: <strong className="text-slate-200 font-mono">{uniqueNumbers}/7</strong>
        </span>
        <span>
          Banked: <strong className="text-amber-400 font-mono font-bold">{player.totalScore}</strong>
        </span>
      </div>

      {/* Opponent Hand of Cards */}
      <div className="flex flex-1 min-h-[50px] flex-wrap items-center gap-1 rounded-lg border border-white/5 bg-black/30 p-1.5">
        {displayCards.length === 0 ? (
          <span className="w-full text-center text-[10px] text-slate-500 py-1">
            No cards
          </span>
        ) : (
          displayCards.map((c, i) => {
            const isDup =
              player.status === 'busted' &&
              c.kind === 'number' &&
              c.value === duplicateVal;

            return (
              <Flip7Card
                key={i}
                card={c}
                size="sm"
                isDuplicate={isDup}
                isDimmed={player.status === 'busted' && !isDup}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
