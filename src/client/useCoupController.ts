'use client';
import { useEffect, useRef, useState } from 'react';
import { CoupController, type CoupView } from './coupController';

export function useCoupController() {
  const ref = useRef<CoupController | null>(null);
  if (!ref.current) ref.current = new CoupController();
  const [view, setView] = useState<CoupView>(() => ({
    screen: 'lobby',
    code: null,
    playerId: null,
    lobby: null,
    state: null,
    responseDeadline: null,
    error: null,
  }));

  useEffect(() => ref.current!.subscribe(setView), []);

  return { controller: ref.current, view };
}
