// src/components/flip7/Flip7GamePlay.tsx
'use client';
import { LogOut, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Flip7Controller, Flip7View } from '@/client/flip7Controller';
import Flip7Table from './Flip7Table';
import ActionBar from './ActionBar';
import GameLog from './GameLog';
import Navbar from '../Navbar';

function GameHeader() {
  const leave = () => (window.location.href = window.location.pathname);
  return (
    <Navbar
      game="flip7"
      className="px-2.5 py-2 lg:px-4 lg:py-2.5"
      rightContent={
        <Button variant="outline" size="sm" onClick={leave} className="h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm shrink-0">
          <LogOut className="size-3.5 sm:size-4" /> <span className="hidden sm:inline">Leave</span>
        </Button>
      }
    />
  );
}

export default function Flip7GamePlay({ controller, view }: { controller: Flip7Controller; view: Flip7View }) {
  if (!view.state) {
    return (
      <>
        <GameHeader />
        <div className="p-6 text-sm" style={{ color: 'var(--flip7-text-muted)' }}>
          Loading…
        </div>
      </>
    );
  }
  const state = view.state;

  if (state.phase === 'game_over') {
    const winner = state.players.find((p) => p.id === state.winner);
    const youWon = winner?.id === state.you;
    const standings = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
    const totalPlayers = state.players.length;
    const votes = view.rematchVotes.length;
    const youVoted = view.rematchVotes.includes(state.you);

    return (
      <>
        <GameHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-16 items-center justify-center rounded-full border-2" style={{ borderColor: 'var(--flip7-amber)', background: 'color-mix(in oklab, var(--flip7-amber) 18%, transparent)' }}>
              <Trophy className="size-8" style={{ color: 'var(--flip7-amber)' }} />
            </div>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--flip7-amber)' }}>
              {youWon ? 'You win!' : `${winner?.name} wins!`}
            </h2>
            <p className="text-sm" style={{ color: 'var(--flip7-text-muted)' }}>
              {winner ? `${winner.name} reached ${winner.totalScore} points.` : 'Game over.'}
            </p>
          </div>

          <div className="flex w-full max-w-xs flex-col gap-1.5">
            {standings.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: p.id === winner?.id ? 'var(--flip7-amber)' : 'var(--flip7-panel-border)',
                  background: 'var(--flip7-panel-bg)',
                  color: 'var(--flip7-text)',
                }}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {p.id === winner?.id && <Trophy className="size-3.5 shrink-0" style={{ color: 'var(--flip7-amber)' }} />}
                  {p.name}
                  {p.id === state.you && ' (you)'}
                </span>
                <span className="text-xs" style={{ color: 'var(--flip7-text-muted)' }}>
                  {p.totalScore} pts
                </span>
              </div>
            ))}
          </div>

          {youVoted ? (
            <div className="flex flex-col items-center gap-1.5">
              <Button size="lg" disabled className="font-semibold" style={{ background: 'var(--flip7-amber)', color: '#1c1420' }}>
                Rematch
              </Button>
              <p className="text-xs" style={{ color: 'var(--flip7-text-muted)' }}>
                Waiting for {totalPlayers - votes} more player{totalPlayers - votes === 1 ? '' : 's'} ({votes}/{totalPlayers} ready)…
              </p>
            </div>
          ) : (
            <Button size="lg" className="font-semibold" style={{ background: 'var(--flip7-amber)', color: '#1c1420' }} onClick={() => controller.rematch()}>
              Rematch{votes > 0 ? ` (${votes}/${totalPlayers} ready)` : ''}
            </Button>
          )}
        </div>
      </>
    );
  }

  if (state.phase === 'round_over') {
    const standings = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
    return (
      <>
        <GameHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--flip7-amber)' }}>
              Round {state.round} complete
            </h2>
            <p className="text-sm" style={{ color: 'var(--flip7-text-muted)' }}>
              Scores are banked. First to 200 wins the game.
            </p>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-1.5">
            {standings.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--flip7-panel-border)', background: 'var(--flip7-panel-bg)', color: 'var(--flip7-text)' }}>
                <span className="font-medium">
                  {p.name}
                  {p.id === state.you && ' (you)'}
                </span>
                <span className="font-bold" style={{ color: 'var(--flip7-amber)' }}>
                  {p.totalScore} pts
                </span>
              </div>
            ))}
          </div>

          <Button size="lg" className="font-semibold" style={{ background: 'var(--flip7-amber)', color: '#1c1420' }} onClick={() => controller.startNextRound()}>
            Start round {state.round + 1}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <GameHeader />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Flip7Table state={state} />
        <div className="flex-1" />
        <ActionBar state={state} controller={controller} />
        <GameLog entries={state.log} />
      </div>
    </>
  );
}
