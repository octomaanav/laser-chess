'use client';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useController } from '@/client/useController';
import Lobby from '@/components/Lobby';
import GamePlay from '@/components/GamePlay';

// Client shell for the app. `initialGameCode` is resolved on the server from the
// ?game= query param, so the very first paint already knows whether to render the
// game (skeleton) or the lobby — no homepage flash, no hydration mismatch.
export default function GameApp({ initialGameCode }: { initialGameCode: string | null }) {
  const { controller, view } = useController();

  // Bridge the controller's toast events (delivered via the view snapshot) to sonner.
  const lastToast = useRef(0);
  useEffect(() => {
    if (view.toast && view.toast.id !== lastToast.current) {
      lastToast.current = view.toast.id;
      toast(view.toast.text);
    }
  }, [view.toast]);

  // Auto-start the game session immediately when arriving on a room link (?game=CODE).
  useEffect(() => {
    if (initialGameCode) controller.start({ code: initialGameCode });
  }, [controller, initialGameCode]);

  // A game link goes straight to GamePlay (which shows its own loading skeleton
  // until the socket connects and the first state arrives).
  const showGameScreen = view.screen === 'game' || initialGameCode != null;

  return showGameScreen ? <GamePlay controller={controller} view={view} /> : <Lobby controller={controller} view={view} />;
}
