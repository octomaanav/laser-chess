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

  const showGame = view.screen === 'game' || initialRoomCode != null;
  return showGame ? <CoupGamePlay controller={controller} view={view} /> : <CoupLobby controller={controller} view={view} />;
}
