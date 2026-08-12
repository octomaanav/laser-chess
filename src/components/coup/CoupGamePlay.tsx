// src/components/coup/CoupGamePlay.tsx
'use client';
import { useEffect, useState } from 'react';
import type { CoupController, CoupView } from '@/client/coupController';
import CoupTable from './CoupTable';
import ActionBar from './ActionBar';
import ResponseModal from './ResponseModal';
import { VariantSetupPicker, RevealPicker, ExchangePicker } from './PhasePickers';

export default function CoupGamePlay({ controller, view }: { controller: CoupController; view: CoupView }) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Only tick while a response deadline is actually pending — no point
  // re-rendering every 200ms outside a response window.
  useEffect(() => {
    if (view.responseDeadline == null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [view.responseDeadline]);

  if (!view.state) {
    return <div className="p-6 text-sm text-[#8a909b]">Loading…</div>;
  }

  if (view.state.winner) {
    const winner = view.state.players.find((p) => p.id === view.state!.winner);
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <h2 className="text-lg font-bold" style={{ color: '#c8155e' }}>
          {winner?.name} wins!
        </h2>
        <button className="rounded bg-[#c8155e] px-4 py-2 text-sm font-semibold text-white" onClick={() => controller.rematch()}>
          Rematch
        </button>
      </div>
    );
  }

  // variant-setup (2-player only) has no server-side timeout and blocks move
  // zero of every 2p game until both players draft a starting character — it
  // needs its own full-screen picker rather than the normal table/action-bar
  // layout, since players don't have real hands yet.
  if (view.state.phase === 'variant-setup') {
    return <VariantSetupPicker state={view.state} controller={controller} />;
  }

  const responseSecondsRemaining = view.responseDeadline ? Math.max(0, Math.round((view.responseDeadline - now) / 1000)) : 0;
  const stateWithCountdown = { ...view.state, responseSecondsRemaining };

  return (
    <div className="relative flex h-full flex-col">
      <CoupTable state={stateWithCountdown} />
      <ActionBar state={stateWithCountdown} controller={controller} selectedTarget={selectedTarget} onSelectTarget={setSelectedTarget} />
      <ResponseModal state={stateWithCountdown} controller={controller} />
      {/* awaiting_reveal and exchange_choice also have no server-side
          timeout — these overlays are the only way out of those phases. */}
      <RevealPicker state={view.state} controller={controller} />
      <ExchangePicker state={view.state} controller={controller} />
    </div>
  );
}
