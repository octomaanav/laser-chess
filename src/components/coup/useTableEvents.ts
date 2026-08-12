// src/components/coup/useTableEvents.ts
'use client';
import { useEffect, useRef, useState } from 'react';
import type { ClientCoupState } from '@/game/coup/redact';
import { deriveTableEvents, type TableEvent } from './tableEvents';

const EVENT_LIFETIME_MS = 1200;

// Returns the events derived from the *most recent* state transition, each
// auto-expiring EVENT_LIFETIME_MS after it appears — long enough for a CSS
// animation to play once, short enough not to re-trigger on unrelated
// re-renders (e.g. the countdown tick in CoupGamePlay).
//
// Timer ids live in a ref and are only cleared on unmount, not on every
// `state` identity change. CoupGamePlay rebuilds its state object on every
// render (including every 200ms countdown tick), so clearing timers in this
// effect's own cleanup would cancel a just-registered timer before it ever
// fires — the event would never expire.
export function useTableEvents(state: ClientCoupState): TableEvent[] {
  const prevRef = useRef<ClientCoupState | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const [active, setActive] = useState<TableEvent[]>([]);

  useEffect(() => {
    const events = deriveTableEvents(prevRef.current, state);
    prevRef.current = state;
    if (events.length === 0) return;

    setActive((current) => [...current, ...events]);
    for (const event of events) {
      const id = setTimeout(() => {
        timersRef.current.delete(id);
        setActive((current) => current.filter((e) => e.id !== event.id));
      }, EVENT_LIFETIME_MS);
      timersRef.current.add(id);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, []);

  return active;
}
