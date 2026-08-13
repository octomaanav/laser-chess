// src/components/coup/CoupApp.tsx
'use client';
import { useEffect } from 'react';
import { useCoupController } from '@/client/useCoupController';
import CoupLobby from './CoupLobby';
import CoupGamePlay from './CoupGamePlay';

export default function CoupApp({ initialRoomCode }: { initialRoomCode: string | null }) {
  const { controller, view } = useCoupController();

  useEffect(() => {
    if (initialRoomCode) controller.start({ code: initialRoomCode });
  }, [controller, initialRoomCode]);

  // Don't force the game screen just because a room code is in the URL —
  // pre-join/pre-start that leaves `view.state` null forever, which showed a
  // permanent "Loading…" for anyone arriving via a shared link. The lobby
  // (with its Start button once seated) is correct until the server actually
  // reports screen === 'game'; the join itself still happens via the
  // useEffect above.
  const showGame = view.screen === 'game';
  return (
    <div data-game="coup" className="flex min-h-dvh flex-col" style={{ background: 'var(--coup-table-bg)', color: 'var(--coup-text)' }}>
      {showGame ? <CoupGamePlay controller={controller} view={view} /> : <CoupLobby controller={controller} view={view} />}
    </div>
  );
}
