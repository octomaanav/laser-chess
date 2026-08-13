// src/components/coup/CoupGamePlay.tsx
'use client';
import { useEffect, useState } from 'react';
import { LogOut, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CoupController, CoupView } from '@/client/coupController';
import CoupTable from './CoupTable';
import ActionBar from './ActionBar';
import ActionRail from './ActionRail';
import ResponseModal from './ResponseModal';
import GameLog from './GameLog';
import MomentBanner from './MomentBanner';
import CoupLogoMark from './CoupLogoMark';
import ThemeToggle from '../ThemeToggle';
import { VariantSetupPicker, RevealPicker, ExchangePicker } from './PhasePickers';
import { useTurnAttention } from './useTurnAttention';
import FitToScreen from './FitToScreen';

function GameHeader() {
  const leave = () => (window.location.href = window.location.pathname);
  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b px-3 py-2 lg:px-4 lg:py-2.5"
      style={{ borderColor: 'var(--coup-panel-border)' }}
    >
      <a href="/games/coup" className="flex items-center gap-2" style={{ color: 'var(--coup-text)' }}>
        <CoupLogoMark size={22} />
        <span className="hidden font-display text-sm font-semibold tracking-tight sm:inline">Coup</span>
      </a>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={leave} className="shrink-0">
          <LogOut className="size-4" /> Leave
        </Button>
      </div>
    </header>
  );
}

export default function CoupGamePlay({ controller, view }: { controller: CoupController; view: CoupView }) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (view.responseDeadline == null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [view.responseDeadline]);

  const isYourTurn = !!view.state && view.state.players[view.state.turn]?.id === view.state.you && !view.state.winner;
  useTurnAttention(isYourTurn);

  if (!view.state) {
    return (
      <>
        <GameHeader />
        <div className="p-6 text-sm" style={{ color: 'var(--coup-text-muted)' }}>
          Loading…
        </div>
      </>
    );
  }

  if (view.state.winner) {
    const winner = view.state.players.find((p) => p.id === view.state!.winner);
    const youWon = winner?.id === view.state.you;
    const standings = [...view.state.players].sort((a, b) => Number(a.eliminated) - Number(b.eliminated));
    return (
      <>
        <GameHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex size-16 items-center justify-center rounded-full border-2"
              style={{ borderColor: 'var(--coup-gold)', background: 'color-mix(in oklab, var(--coup-gold) 18%, transparent)' }}
            >
              <Crown className="size-8" style={{ color: 'var(--coup-gold)' }} />
            </div>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--coup-gold)' }}>
              {youWon ? 'You win!' : `${winner?.name} wins!`}
            </h2>
            <p className="text-sm" style={{ color: 'var(--coup-text-muted)' }}>
              {youWon ? 'Every other influence at the table is gone.' : `${winner?.name} is the last one standing.`}
            </p>
          </div>

          <div className="flex w-full max-w-xs flex-col gap-1.5">
            {standings.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: p.id === winner?.id ? 'var(--coup-gold)' : 'var(--coup-panel-border)',
                  background: 'var(--coup-panel-bg)',
                  color: p.eliminated ? 'var(--coup-text-muted)' : 'var(--coup-text)',
                }}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {p.id === winner?.id && <Crown className="size-3.5 shrink-0" style={{ color: 'var(--coup-gold)' }} />}
                  {p.name}
                  {p.id === view.state!.you && ' (you)'}
                </span>
                <span className="text-xs" style={{ color: 'var(--coup-text-muted)' }}>
                  {p.eliminated ? 'Eliminated' : 'Winner'}
                </span>
              </div>
            ))}
          </div>

          {(() => {
            const totalPlayers = view.state!.players.length;
            const votes = view.rematchVotes.length;
            const youVoted = view.rematchVotes.includes(view.state!.you);
            return youVoted ? (
              <div className="flex flex-col items-center gap-1.5">
                <Button size="lg" disabled className="font-semibold" style={{ background: 'var(--coup-gold)', color: '#1c1420' }}>
                  Rematch
                </Button>
                <p className="text-xs" style={{ color: 'var(--coup-text-muted)' }}>
                  Waiting for {totalPlayers - votes} more player{totalPlayers - votes === 1 ? '' : 's'} ({votes}/{totalPlayers} ready)…
                </p>
              </div>
            ) : (
              <Button
                size="lg"
                className="font-semibold"
                style={{ background: 'var(--coup-gold)', color: '#1c1420' }}
                onClick={() => controller.rematch()}
              >
                Rematch{votes > 0 ? ` (${votes}/${totalPlayers} ready)` : ''}
              </Button>
            );
          })()}
        </div>
      </>
    );
  }

  if (view.state.phase === 'variant-setup') {
    return (
      <>
        <GameHeader />
        <VariantSetupPicker state={view.state} controller={controller} />
      </>
    );
  }

  const responseSecondsRemaining = view.responseDeadline ? Math.max(0, Math.round((view.responseDeadline - now) / 1000)) : 0;
  const stateWithCountdown = { ...view.state, responseSecondsRemaining };

  return (
    <>
      <GameHeader />
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* This inner box is exactly the gameboard's own footprint (viewport
            minus the docked ActionRail) — every overlay below anchors to
            it, not the outer row, so a countdown/decision card centers over
            the board itself instead of the whole page including the
            sidebar. */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <FitToScreen>
            <div className="flex flex-col">
              <CoupTable state={stateWithCountdown} controller={controller} selectedTarget={selectedTarget} />
              <ActionBar state={stateWithCountdown} controller={controller} selectedTarget={selectedTarget} onSelectTarget={setSelectedTarget} />
            </div>
          </FitToScreen>
          <MomentBanner state={stateWithCountdown} />
          <GameLog entries={view.state.log} />
          <ResponseModal state={stateWithCountdown} controller={controller} />
          {/* awaiting_reveal and exchange_choice also have no server-side
              timeout — these overlays are the only way out of those phases. */}
          <RevealPicker state={view.state} controller={controller} />
          <ExchangePicker state={view.state} controller={controller} />
        </div>
        <ActionRail state={stateWithCountdown} controller={controller} selectedTarget={selectedTarget} onSelectTarget={setSelectedTarget} />
      </div>
    </>
  );
}
