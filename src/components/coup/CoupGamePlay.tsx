// src/components/coup/CoupGamePlay.tsx
'use client';
import { useEffect, useState } from 'react';
import type { CoupController, CoupView } from '@/client/coupController';
import CoupTable from './CoupTable';
import ActionBar from './ActionBar';
import ResponseModal from './ResponseModal';

export default function CoupGamePlay({ controller, view }: { controller: CoupController; view: CoupView }) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  if (!view.state) {
    return <div className="p-6 text-sm text-[#8a909b]">Loading…</div>;
  }

  const responseDeadlineMsRemaining = view.responseDeadline ? Math.max(0, Math.round((view.responseDeadline - now) / 1000)) : 0;
  const stateWithCountdown = { ...view.state, responseDeadlineMsRemaining };

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

  return (
    <div className="relative flex h-full flex-col">
      <CoupTable state={stateWithCountdown} />
      <ActionBar state={stateWithCountdown} controller={controller} selectedTarget={selectedTarget} onSelectTarget={setSelectedTarget} />
      <ResponseModal state={stateWithCountdown} controller={controller} />
    </div>
  );
}
