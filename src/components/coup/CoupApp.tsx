// src/components/coup/CoupApp.tsx
'use client';
import { useEffect } from 'react';
import { useCoupController } from '@/client/useCoupController';
import CoupLobby from './CoupLobby';
import CoupGamePlay from './CoupGamePlay';

export default function CoupApp({ initialRoomCode }: { initialRoomCode: string | null }) {
  const { controller, view } = useCoupController();

  useEffect(() => {
    // Only auto-rejoin silently if this browser was already seated in this
    // room before (e.g. a refresh mid-game). A brand-new visitor arriving via
    // a shared link should land on the pre-join screen so they can set their
    // name first, instead of being auto-joined under a stale/default name.
    if (initialRoomCode && controller.wasInRoom(initialRoomCode)) controller.start({ code: initialRoomCode });
  }, [controller, initialRoomCode]);

  // Don't force the game screen just because a room code is in the URL -
  // pre-join/pre-start that leaves `view.state` null forever, which showed a
  // permanent "Loading…" for anyone arriving via a shared link. The lobby
  // (with its Start button once seated) is correct until the server actually
  // reports screen === 'game'; the join itself still happens via the
  // useEffect above.
  const showGame = view.screen === 'game';
  return (
    <div
      data-game="coup"
      className={showGame ? 'flex h-dvh flex-col overflow-hidden' : 'flex min-h-dvh flex-col'}
      style={{
        background: 'var(--coup-table-bg)',
        color: 'var(--coup-text)',
        // Faint radial glow + grid, matching Laser Chess's backdrop treatment
        // (--app-backdrop) - applied app-wide, subtle enough to sit behind the
        // table felt without competing with cards/pieces.
        backgroundImage: 'var(--coup-backdrop)',
        backgroundSize: '100% 100%, 100% 100%, 44px 44px, 44px 44px',
      }}
    >
      {showGame ? (
        <CoupGamePlay controller={controller} view={view} />
      ) : (
        <CoupLobby controller={controller} view={view} initialRoomCode={initialRoomCode} />
      )}
    </div>
  );
}
