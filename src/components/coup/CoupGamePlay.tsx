// src/components/coup/CoupGamePlay.tsx
'use client';
import { useEffect, useState } from 'react';
import type { CoupController, CoupView } from '@/client/coupController';
import CoupTable from './CoupTable';
import ActionBar from './ActionBar';
import ResponseModal from './ResponseModal';
import GameLog from './GameLog';
import { VariantSetupPicker, RevealPicker, ExchangePicker } from './PhasePickers';

export default function CoupGamePlay({ controller, view }: { controller: CoupController; view: CoupView }) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (view.responseDeadline == null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [view.responseDeadline]);

  if (!view.state) {
    return <div className="p-6 text-sm" style={{ color: 'var(--coup-text-muted)' }}>Loading…</div>;
  }

  if (view.state.winner) {
    const winner = view.state.players.find((p) => p.id === view.state!.winner);
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <h2 className="text-lg font-bold" style={{ color: 'var(--coup-gold)' }}>
          {winner?.name} wins!
        </h2>
        <button
          className="rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ background: 'var(--coup-gold)' }}
          onClick={() => controller.rematch()}
        >
          Rematch
        </button>
      </div>
    );
  }

  if (view.state.phase === 'variant-setup') {
    return <VariantSetupPicker state={view.state} controller={controller} />;
  }

  const responseSecondsRemaining = view.responseDeadline ? Math.max(0, Math.round((view.responseDeadline - now) / 1000)) : 0;
  const stateWithCountdown = { ...view.state, responseSecondsRemaining };

  return (
    <div className="relative flex h-full flex-col">
      <CoupTable state={stateWithCountdown} />
      <ActionBar state={stateWithCountdown} controller={controller} selectedTarget={selectedTarget} onSelectTarget={setSelectedTarget} />
      <GameLog entries={view.state.log} />
      <ResponseModal state={stateWithCountdown} controller={controller} />
      <RevealPicker state={view.state} controller={controller} />
      <ExchangePicker state={view.state} controller={controller} />
    </div>
  );
}
