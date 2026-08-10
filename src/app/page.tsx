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

  return view.screen === 'lobby' ? <Lobby controller={controller} view={view} /> : <GamePlay controller={controller} view={view} />;
}
