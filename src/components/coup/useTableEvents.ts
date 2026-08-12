'use client';
import { useEffect, useRef, useState } from 'react';
import type { ClientCoupState } from '@/game/coup/redact';
import { deriveTableEvents, type TableEvent } from './tableEvents';

const EVENT_LIFETIME_MS = 1200;

// Returns the events derived from the *most recent* state transition, each
// auto-expiring EVENT_LIFETIME_MS after it appears — long enough for a CSS
// animation to play once, short enough not to re-trigger on unrelated
// re-renders (e.g. the countdown tick in CoupGamePlay).
export function useTableEvents(state: ClientCoupState): TableEvent[] {
  const prevRef = useRef<ClientCoupState | null>(null);
  const [active, setActive] = useState<TableEvent[]>([]);

  useEffect(() => {
    const events = deriveTableEvents(prevRef.current, state);
    prevRef.current = state;
    if (events.length === 0) return;

    setActive((current) => [...current, ...events]);
    const timers = events.map((event) =>
      setTimeout(() => {
        setActive((current) => current.filter((e) => e.id !== event.id));
      }, EVENT_LIFETIME_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [state]);

  return active;
}
