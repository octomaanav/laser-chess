// src/components/flip7/Flip7App.tsx
'use client';
import { useEffect } from 'react';
import { useFlip7Controller } from '@/client/useFlip7Controller';
import Flip7Lobby from './Flip7Lobby';
import Flip7GamePlay from './Flip7GamePlay';

export default function Flip7App({ initialRoomCode }: { initialRoomCode: string | null }) {
  const { controller, view } = useFlip7Controller();

  useEffect(() => {
    // Only auto-rejoin silently if this browser was already seated in this
    // room before (e.g. a refresh mid-game). A brand-new visitor arriving via
    // a shared link should land on the pre-join screen so they can set their
    // name first.
    if (initialRoomCode && controller.wasInRoom(initialRoomCode)) controller.start({ code: initialRoomCode });
  }, [controller, initialRoomCode]);

  const showGame = view.screen === 'game';
  return (
    <div
      data-game="flip7"
      className="flex min-h-dvh flex-col w-full overflow-x-hidden"
      style={{
        background: 'var(--flip7-table-bg)',
        color: 'var(--flip7-text)',
        backgroundImage: 'var(--flip7-backdrop)',
        backgroundSize: '100% 100%, 100% 100%, 44px 44px, 44px 44px',
      }}
    >
      {showGame ? (
        <Flip7GamePlay controller={controller} view={view} />
      ) : (
        <Flip7Lobby controller={controller} view={view} initialRoomCode={initialRoomCode} />
      )}
    </div>
  );
}
