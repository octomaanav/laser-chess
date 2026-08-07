'use client';
import { useController } from '@/client/useController';
import Lobby from '@/components/Lobby';
import GamePlay from '@/components/GamePlay';
import Toast from '@/components/Toast';

export default function Page() {
  const { controller, view } = useController();
  return (
    <>
      {view.screen === 'lobby' ? <Lobby controller={controller} view={view} /> : <GamePlay controller={controller} view={view} />}
      <Toast toast={view.toast} />
    </>
  );
}
