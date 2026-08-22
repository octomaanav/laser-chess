// src/components/flip7/ActionBar.tsx
'use client';
import React, { useEffect } from 'react';
import { Snowflake, RotateCcw, ShieldPlus, ArrowDownToDot, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClientFlip7State } from '@/game/flip7/redact';
import type { Flip7Controller } from '@/client/flip7Controller';
import { computeHandScore } from '@/game/flip7/engine';
import { cn } from '@/lib/utils';

const KIND_LABEL = {
  freeze: 'Freeze',
  'flip-three': 'Flip Three',
  'second-chance': 'Second Chance',
} as const;

const KIND_ICON = {
  freeze: Snowflake,
  'flip-three': RotateCcw,
  'second-chance': ShieldPlus,
} as const;

export default function ActionBar({
  state,
  controller,
  className,
}: {
  state: ClientFlip7State;
  controller: Flip7Controller;
  className?: string;
}) {
  const you = state.players.find((p) => p.id === state.you);
  const activePlayer = state.players[state.turn];
  const yourTurn = activePlayer?.id === state.you;
  const canAct = yourTurn && you?.status === 'active' && state.phase === 'round_active';
  const currentHandScore = you ? computeHandScore(you.hand) : 0;

  // Keyboard shortcut listener (Space/Enter to Draw, S to Stay)
  useEffect(() => {
    if (!canAct) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        controller.hit();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        controller.stay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canAct, controller]);

  // 1. AWAITING TARGET CHOICE (Freeze, Flip Three, Second Chance)
  if (state.phase === 'awaiting_target' && state.pendingTarget) {
    const { drawerId, kind } = state.pendingTarget;
    const drawer = state.players.find((p) => p.id === drawerId);
    const Icon = KIND_ICON[kind];

    if (drawerId !== state.you) {
      return (
        <div
          className={cn(
            'flex h-full min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-[#121822]/90 p-4 text-center shadow-xl backdrop-blur-md',
            className
          )}
        >
          <Icon className="size-6 text-amber-400 animate-bounce" />
          <span className="text-xs font-medium text-slate-300">
            Waiting for <strong className="text-amber-300">{drawer?.name}</strong> to choose target…
          </span>
        </div>
      );
    }

    const eligible = state.players.filter((p) => {
      if (p.status !== 'active') return false;
      if (kind === 'second-chance') {
        return p.id !== drawerId && !p.hand.some((c) => c.kind === 'action' && c.action === 'second-chance');
      }
      return true;
    });

    const choose = (targetId: string) => {
      if (kind === 'freeze') controller.chooseFreezeTarget(targetId);
      else if (kind === 'flip-three') controller.chooseFlipThreeTarget(targetId);
      else controller.chooseSecondChanceRecipient(targetId);
    };

    return (
      <div
        className={cn(
          'flex h-full min-h-[140px] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-amber-400 bg-[#161e2a]/95 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in duration-200',
          className
        )}
      >
        <p className="flex items-center gap-1.5 text-xs font-black text-amber-300 text-center">
          <Icon className="size-4 shrink-0" />
          <span>
            {kind === 'second-chance' ? 'Give extra Shield to:' : `Select target for ${KIND_LABEL[kind]}:`}
          </span>
        </p>

        <div className="flex flex-wrap justify-center gap-1.5 max-h-24 overflow-y-auto">
          {eligible.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              onClick={() => choose(p.id)}
              className="flex items-center gap-1 rounded-xl border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-slate-100 hover:bg-amber-500/30"
            >
              <span>{p.name}</span>
              <span className="rounded bg-black/50 px-1 py-0.2 text-[9px] font-mono text-amber-300">
                {computeHandScore(p.hand)}p
              </span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // 2. FORCED DRAW (FLIP THREE) IN PROGRESS
  const activeForced = state.flipThreeQueue.find((f) => f.remaining > 0);
  if (activeForced && state.phase === 'round_active') {
    const target = state.players.find((p) => p.id === activeForced.targetId);
    return (
      <div
        className={cn(
          'flex h-full min-h-[140px] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-red-500/40 bg-red-950/35 p-4 text-center text-red-300 shadow-xl backdrop-blur-md animate-pulse',
          className
        )}
      >
        <RotateCcw className="size-6 animate-spin text-red-400" />
        <div className="text-sm font-black uppercase tracking-wider">Forced Draw</div>
        <p className="text-xs text-red-200">
          <strong>{target?.name}</strong> must flip {activeForced.remaining} more card{activeForced.remaining === 1 ? '' : 's'}!
        </p>
      </div>
    );
  }

  // 3. YOUR TURN: ACTIVE ACTION COMMAND CONSOLE BENTO BOX
  if (canAct) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[140px] flex-col justify-between rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-[#1c2432]/95 to-[#131a26]/95 p-3.5 shadow-xl backdrop-blur-md',
          className
        )}
      >
        {/* Command Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400">
            <Sparkles className="size-3.5" />
            <span>Decision Time</span>
          </div>
          <span className="rounded-full bg-amber-400/20 px-2 py-0.2 text-[10px] font-bold text-amber-300">
            {currentHandScore} pts in play
          </span>
        </div>

        {/* DRAW BUTTON */}
        <div className="flex items-center gap-2.5 my-auto">
          <Button
            size="lg"
            className="group relative flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-amber-300 bg-amber-400 px-3 py-3 text-xs sm:text-sm font-black text-slate-950 shadow-xl transition-all hover:scale-105 hover:bg-amber-300 active:scale-95"
            style={{
              boxShadow: '0 6px 18px rgba(255, 176, 32, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.4)',
            }}
            onClick={() => controller.hit()}
          >
            <ArrowDownToDot className="size-4 shrink-0 transition-transform group-hover:translate-y-0.5" />
            <span>DRAW</span>
            <span className="hidden sm:inline rounded bg-black/20 px-1 py-0.2 text-[9px] font-mono font-bold uppercase">
              Space
            </span>
          </Button>

          {/* STAY & BANK BUTTON */}
          <Button
            size="lg"
            variant="outline"
            className="group relative flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-400 bg-emerald-500/20 px-3 py-3 text-xs sm:text-sm font-black text-emerald-300 shadow-xl transition-all hover:scale-105 hover:bg-emerald-500/30 active:scale-95"
            style={{
              boxShadow: '0 6px 18px rgba(34, 197, 94, 0.25)',
            }}
            onClick={() => controller.stay()}
          >
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <span>STAY ({currentHandScore}P)</span>
            <span className="hidden sm:inline rounded bg-white/10 px-1 py-0.2 text-[9px] font-mono font-bold uppercase">
              S
            </span>
          </Button>
        </div>

        {/* Tip text */}
        <p className="text-[10px] text-slate-400 text-center">
          Draw for more points or bank your score safely.
        </p>
      </div>
    );
  }

  // 4. WAITING FOR OPPONENT / PASSIVE BENTO CONSOLE
  return (
    <div
      className={cn(
        'flex h-full min-h-[140px] flex-col justify-between rounded-2xl border border-white/10 bg-[#121822]/85 p-3.5 shadow-xl backdrop-blur-md',
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-2">
        <Clock className="size-3.5 text-amber-400" />
        <span>Table Action</span>
      </div>

      <div className="flex flex-col items-center justify-center my-auto text-center gap-1">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/30">
          <span className="size-2 rounded-full bg-amber-400 animate-ping" />
          <span>{activePlayer?.name}&apos;s Turn</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {activePlayer?.name} is deciding whether to Draw or Stay.
        </p>
      </div>

      <div className="text-[10px] text-slate-500 text-center border-t border-white/5 pt-1.5 font-mono">
        Race to 200 Points · Flip 7 Bonus = +15
      </div>
    </div>
  );
}
