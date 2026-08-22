// src/components/flip7/CenterDeckArea.tsx
'use client';
import React from 'react';
import { Layers, ShieldCheck, Flame, AlertTriangle, Snowflake, RotateCcw, Sparkles } from 'lucide-react';
import type { ClientFlip7State } from '@/game/flip7/redact';
import type { Flip7Controller } from '@/client/flip7Controller';
import Flip7Card from './art/Flip7Card';
import Flip7CardBack from './art/Flip7CardBack';
import { cn } from '@/lib/utils';

export default function CenterDeckArea({
  state,
  controller,
  className,
}: {
  state: ClientFlip7State;
  controller: Flip7Controller;
  className?: string;
}) {
  const isYourTurn = state.phase === 'round_active' && state.players[state.turn]?.id === state.you;
  const you = state.players.find((p) => p.id === state.you);
  const hasForcedDraw = state.flipThreeQueue.some((f) => f.remaining > 0);
  const canHit = isYourTurn && you?.status === 'active' && !hasForcedDraw;

  const lastDraw = state.lastDraw;

  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center justify-center rounded-2xl border border-amber-500/30 p-4 sm:p-6 shadow-2xl backdrop-blur-md',
        className
      )}
      style={{
        background: 'var(--flip7-felt-bg)',
        boxShadow: 'inset 0 0 35px rgba(0, 0, 0, 0.6), 0 16px 40px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Subtle Felt Border Rim Line */}
      <div className="pointer-events-none absolute inset-2 rounded-xl border border-amber-400/20 border-dashed" />

      {/* Main Table Stage: Draw Deck | Center Spotlight | Discard Pile */}
      <div className="relative z-10 flex w-full items-center justify-around gap-3 sm:gap-8">
        {/* 1. DRAW DECK PILE */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300">
            <Layers className="size-3 sm:size-3.5 text-amber-400" />
            <span>Deck</span>
          </div>

          <div
            onClick={() => {
              if (canHit) controller.hit();
            }}
            className={cn(
              'group relative cursor-pointer select-none transition-all duration-300',
              canHit
                ? 'hover:scale-105 active:scale-95'
                : 'cursor-default opacity-90'
            )}
            title={canHit ? 'Click to Draw Card (Space / Enter)' : undefined}
          >
            {/* 3D isometric stack shadow */}
            <div className="absolute top-2 left-2 size-full rounded-lg bg-black/70 blur-xs" />
            <div className="absolute top-1 left-1 size-full rounded-lg border border-amber-500/20 bg-[#0d131a]" />
            <div className="absolute top-0.5 left-0.5 size-full rounded-lg border border-amber-500/20 bg-[#121b24]" />

            {/* Top Deck Card — always md size */}
            <div
              className={cn(
                'relative z-10 transition-all duration-300',
                canHit &&
                  'rounded-lg ring-2 sm:ring-3 ring-amber-400 ring-offset-2 ring-offset-[#0d1622] shadow-[0_0_24px_rgba(255,176,32,0.6)]'
              )}
            >
              <Flip7CardBack size="md" />

              {canHit && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-black/40 backdrop-blur-[1px] transition-opacity group-hover:bg-black/20">
                  <span className="animate-bounce rounded-full bg-amber-400 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-xl border border-white">
                    DRAW
                  </span>
                </div>
              )}
            </div>
          </div>

          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] sm:text-xs font-mono font-bold text-amber-300 border border-white/5">
            {state.deckCount} cards
          </span>
        </div>

        {/* 2. CENTER SPOTLIGHT (The Card in Play) */}
        <div className="flex flex-1 min-w-0 max-w-xs flex-col items-center justify-center rounded-xl border border-amber-400/30 bg-black/45 p-3 sm:p-4 shadow-inner">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-400">
            <Sparkles className="size-3 sm:size-3.5 text-amber-400" />
            <span>Card in Play</span>
          </div>

          {lastDraw ? (
            <div className="flex w-full flex-col items-center gap-2 animate-[flip7-card-flip_400ms_ease-out]">
              <div className="max-w-full truncate rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] sm:text-xs text-slate-200 border border-amber-500/30 font-medium">
                <strong className="text-amber-300 font-bold">{lastDraw.playerName}</strong> pulled:
              </div>

              {/* Cartoon Card — always md size */}
              <div className="relative transform transition-transform hover:scale-105">
                <Flip7Card
                  card={lastDraw.card}
                  size="md"
                  isBust={lastDraw.outcome === 'duplicate_bust'}
                  isNew
                />
              </div>

              {/* Outcome Banner */}
              <div className="flex max-w-full flex-col items-center text-center">
                {lastDraw.outcome === 'duplicate_bust' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-white shadow-lg border border-red-300 animate-[flip7-shake_500ms_ease-in-out]">
                    <AlertTriangle className="size-3 shrink-0" />
                    DUPLICATE BUST!
                  </span>
                )}

                {lastDraw.outcome === 'second_chance_saved' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-white shadow-lg border border-emerald-300">
                    <ShieldCheck className="size-3 shrink-0" />
                    SHIELD SAVED!
                  </span>
                )}

                {lastDraw.outcome === 'flip_seven' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-3 py-0.5 text-[10px] sm:text-xs font-black text-slate-950 shadow-xl border border-white animate-bounce">
                    <Flame className="size-3.5 shrink-0 text-red-600" />
                    FLIP 7 BONUS (+15)!
                  </span>
                )}

                {lastDraw.outcome === 'freeze' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-slate-950 shadow-md border border-white">
                    <Snowflake className="size-3 shrink-0" />
                    FREEZE
                  </span>
                )}

                {lastDraw.outcome === 'flip_three' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-white shadow-md border border-white">
                    <RotateCcw className="size-3 shrink-0" />
                    FLIP 3
                  </span>
                )}

                {lastDraw.outcome === 'second_chance_kept' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-white shadow-md border border-emerald-300">
                    <ShieldCheck className="size-3 shrink-0" />
                    SHIELD
                  </span>
                )}

                {lastDraw.outcome === 'second_chance_giveaway' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] sm:text-xs font-black text-slate-950 shadow-md border border-white">
                    GIVE SHIELD
                  </span>
                )}

                {lastDraw.outcome === 'added' && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-emerald-400 font-semibold truncate">
                    Added to hand
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-5 sm:py-7 text-center text-xs text-slate-400">
              <p className="font-semibold text-slate-300 text-xs sm:text-sm">Draw pile ready</p>
              <p className="mt-1 text-[10px] sm:text-xs text-slate-500">Draw to flip card</p>
            </div>
          )}
        </div>

        {/* 3. DISCARD PILE */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
            Discard
          </div>

          <div className="relative">
            {state.topDiscard ? (
              <div className="relative rotate-2 transition-transform hover:rotate-0">
                <Flip7Card card={state.topDiscard} size="md" isDimmed />
              </div>
            ) : (
              <div className="flex h-20 w-14 items-center justify-center rounded-lg border-2 border-dashed border-white/15 bg-black/30 text-center text-[10px] sm:text-xs font-medium text-slate-500">
                Empty
              </div>
            )}
          </div>

          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] sm:text-xs font-mono font-bold text-slate-400 border border-white/5">
            {state.discardCount} cards
          </span>
        </div>
      </div>
    </div>
  );
}
