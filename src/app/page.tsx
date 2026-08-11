'use client';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useController } from '@/client/useController';
import Lobby from '@/components/Lobby';
import GamePlay from '@/components/GamePlay';

export default function Page() {
  const { controller, view } = useController();

  // Bridge the controller's toast events (delivered via the view snapshot) to sonner.
  const lastToast = useRef(0);
  useEffect(() => {
    if (view.toast && view.toast.id !== lastToast.current) {
      lastToast.current = view.toast.id;
      toast(view.toast.text);
    }
  }, [view.toast]);

  // Auto-start game session immediately if loading a room link (?game=CODE)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const g = (params.get('game') || '').toUpperCase().trim();
      if (g) {
        controller.start({ code: g });
      }
    }
  }, [controller]);

  const hasGameParam = typeof window !== 'undefined' && !!new URLSearchParams(window.location.search).get('game');
  const showGameScreen = view.screen === 'game' || hasGameParam;

  return showGameScreen ? <GamePlay controller={controller} view={view} /> : <Lobby controller={controller} view={view} />;
}
