// src/components/flip7/Flip7Table.tsx
'use client';
import React from 'react';
import type { ClientFlip7State } from '@/game/flip7/redact';
import type { Flip7Controller } from '@/client/flip7Controller';
import PlayerHand from './PlayerHand';
import CenterDeckArea from './CenterDeckArea';
import ActionBar from './ActionBar';
import GameLog from './GameLog';
import { Trophy, Crown, Users } from 'lucide-react';

export default function Flip7Table({
  state,
  controller,
}: {
  state: ClientFlip7State;
  controller: Flip7Controller;
}) {
  const you = state.players.find((p) => p.id === state.you);
  const opponents = state.players.filter((p) => p.id !== state.you);
  const standings = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const dealer = state.players[state.dealerIndex];

  return (
    <div className="flex flex-col items-stretch gap-3 sm:gap-4 p-3 sm:p-5 w-full max-w-[1100px] mx-auto">
      {/* 1. TOP HEADER STATUS BENTO BAR */}
      <div className="relative z-40 flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#121822]/90 px-3.5 py-2 text-xs shadow-md backdrop-blur-md">
        {/* Round & Dealer */}
        <div className="flex items-center gap-2 font-medium text-slate-300">
          <span className="rounded-md bg-amber-400/15 px-2.5 py-0.5 font-bold text-amber-300 border border-amber-400/30 text-[11px] sm:text-xs shrink-0">
            Round {state.round}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] sm:text-xs">
            <Crown className="size-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-400 hidden sm:inline">Dealer:</span>
            <strong className="text-slate-200 truncate max-w-[110px] sm:max-w-none">{dealer?.name}</strong>
          </span>
        </div>

        {/* Standings Leaderboard */}
        <div className="hidden lg:flex items-center gap-3 text-slate-400">
          <div className="flex items-center gap-1 font-bold text-amber-400">
            <Trophy className="size-3.5" />
            <span>Race to 200:</span>
          </div>
          <div className="flex items-center gap-2">
            {standings.slice(0, 3).map((p, rank) => (
              <span key={p.id} className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-500 font-mono">#{rank + 1}</span>
                <span className="font-semibold text-slate-200">{p.name}</span>
                <span className="font-bold text-amber-400 font-mono">({p.totalScore})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Game History Log Pill */}
        <GameLog entries={state.log} />
      </div>

      {/* 2. TOP BENTO ROW: OPPONENTS BOX + CENTER ARENA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch w-full">
        {/* OPPONENTS BENTO TILE */}
        {opponents.length > 0 ? (
          <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121824]/90 p-3 sm:p-3.5 shadow-xl backdrop-blur-md">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Users className="size-3.5 text-amber-400" />
                <span>Opponents ({opponents.length})</span>
              </div>
              <span className="text-[10px] text-slate-400">
                {opponents.filter((p) => p.status === 'active').length} active
              </span>
            </div>

            {/* Opponents List */}
            <div className="flex flex-1 flex-col justify-around gap-2.5">
              {opponents.map((p) => {
                const playerIndex = state.players.findIndex((x) => x.id === p.id);
                return (
                  <PlayerHand
                    key={p.id}
                    player={p}
                    isYou={false}
                    isTurn={playerIndex === state.turn && state.phase === 'round_active'}
                    isDealer={playerIndex === state.dealerIndex}
                    variant="opponent"
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex lg:col-span-4 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#121824]/60 p-4 text-center text-xs text-slate-500">
            Waiting for other players to join the table…
          </div>
        )}

        {/* CENTER TABLE FELT BENTO TILE */}
        <div className={opponents.length > 0 ? 'lg:col-span-8 flex' : 'lg:col-span-8 flex'}>
          <CenterDeckArea state={state} controller={controller} className="h-full w-full" />
        </div>
      </div>

      {/* 3. BOTTOM BENTO ROW: YOUR HAND TILE + ACTION COMMAND CONSOLE TILE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch w-full">
        {/* YOUR HERO HAND BENTO TILE */}
        <div className="lg:col-span-8 flex">
          {you && (
            <PlayerHand
              player={you}
              isYou={true}
              isTurn={state.players[state.turn]?.id === you.id && state.phase === 'round_active'}
              isDealer={state.players[state.dealerIndex]?.id === you.id}
              variant="hero"
              className="h-full w-full"
            />
          )}
        </div>

        {/* ACTION COMMAND CONSOLE BENTO TILE */}
        <div className="lg:col-span-4 flex">
          <ActionBar state={state} controller={controller} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
