// src/components/flip7/Flip7GamePlay.tsx
'use client';
import React from 'react';
import { LogOut, Trophy, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Flip7Controller, Flip7View } from '@/client/flip7Controller';
import Flip7Table from './Flip7Table';
import Navbar from '../Navbar';

function GameHeader() {
  const leave = () => (window.location.href = window.location.pathname);
  return (
    <Navbar
      game="flip7"
      className="px-2.5 py-2 lg:px-4 lg:py-2.5"
      rightContent={
        <Button
          variant="outline"
          size="sm"
          onClick={leave}
          className="h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm shrink-0 border-white/10 hover:border-amber-400"
        >
          <LogOut className="size-3.5 sm:size-4" /> <span className="hidden sm:inline">Leave</span>
        </Button>
      }
    />
  );
}

export default function Flip7GamePlay({
  controller,
  view,
}: {
  controller: Flip7Controller;
  view: Flip7View;
}) {
  if (!view.state) {
    return (
      <>
        <GameHeader />
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-400">
          Loading game…
        </div>
      </>
    );
  }

  const state = view.state;
  const standings = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const winner = state.players.find((p) => p.id === state.winner);
  const youWon = winner?.id === state.you;
  const totalPlayers = state.players.length;
  const votes = view.rematchVotes.length;
  const youVoted = view.rematchVotes.includes(state.you);

  return (
    <>
      <GameHeader />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Main Table view */}
        <Flip7Table state={state} controller={controller} />

        {/* 1. ROUND OVER MODAL OVERLAY */}
        {state.phase === 'round_over' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border-2 border-amber-400/40 bg-[#141a24] p-6 shadow-2xl">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="flex size-14 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/20 shadow-[0_0_20px_rgba(255,176,32,0.4)]">
                  <Sparkles className="size-7 text-amber-400" />
                </div>
                <h2 className="text-2xl font-black text-amber-400">
                  Round {state.round} Complete!
                </h2>
                <p className="text-xs text-slate-400">
                  Scores banked. First to 200 points wins the game.
                </p>
              </div>

              {/* Standings table */}
              <div className="flex w-full flex-col gap-1.5">
                {standings.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 font-medium text-slate-200">
                      <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                      <span>{p.name}</span>
                      {p.id === state.you && (
                        <span className="text-xs text-amber-400 font-bold">(you)</span>
                      )}
                    </span>
                    <span className="font-bold text-amber-400 font-mono">
                      {p.totalScore} pts
                    </span>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="w-full font-black shadow-xl flex items-center justify-center gap-2 rounded-2xl bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95"
                onClick={() => controller.startNextRound()}
              >
                <span>Start Round {state.round + 1}</span>
                <ArrowRight className="size-4.5" />
              </Button>
            </div>
          </div>
        )}

        {/* 2. GAME OVER MODAL OVERLAY */}
        {state.phase === 'game_over' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border-2 border-amber-400/60 bg-[#141a24] p-6 shadow-2xl">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/25 shadow-[0_0_30px_rgba(255,176,32,0.5)]">
                  <Trophy className="size-8 text-amber-400" />
                </div>
                <h2 className="text-3xl font-black text-amber-400">
                  {youWon ? 'You Win!' : `${winner?.name} Wins!`}
                </h2>
                <p className="text-sm text-slate-300">
                  {winner ? `${winner.name} reached ${winner.totalScore} points.` : 'Game over.'}
                </p>
              </div>

              <div className="flex w-full flex-col gap-1.5">
                {standings.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border px-3.5 py-2 text-sm"
                    style={{
                      borderColor: p.id === winner?.id ? 'var(--flip7-amber)' : 'rgba(255,255,255,0.1)',
                      background: p.id === winner?.id ? 'rgba(255,176,32,0.15)' : 'rgba(0,0,0,0.4)',
                    }}
                  >
                    <span className="flex items-center gap-2 font-medium text-slate-200">
                      {p.id === winner?.id && (
                        <Trophy className="size-4 text-amber-400 shrink-0" />
                      )}
                      <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                      <span>{p.name}</span>
                      {p.id === state.you && <span className="text-xs text-amber-400 font-bold">(you)</span>}
                    </span>
                    <span className="font-bold text-amber-400 font-mono">
                      {p.totalScore} pts
                    </span>
                  </div>
                ))}
              </div>

              {youVoted ? (
                <div className="flex flex-col items-center gap-2 w-full">
                  <Button
                    size="lg"
                    disabled
                    className="w-full font-bold opacity-75 rounded-2xl bg-amber-400 text-slate-950"
                  >
                    Ready for Rematch
                  </Button>
                  <p className="text-xs text-slate-400">
                    Waiting for {totalPlayers - votes} more ({votes}/{totalPlayers} ready)…
                  </p>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full font-black shadow-xl flex items-center justify-center gap-2 rounded-2xl bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95"
                  onClick={() => controller.rematch()}
                >
                  <RotateCcw className="size-4.5" />
                  <span>Rematch{votes > 0 ? ` (${votes}/${totalPlayers} ready)` : ''}</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
