// src/components/coup/CoinFlights.tsx
'use client';
import { useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TableEvent } from './tableEvents';
import { CoupCoinGlyph } from './CoupCoin';

interface FlightSpec {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
}

// Coins moving between seats/treasury read very differently as "a coin
// visibly crosses the table" versus a number quietly changing in place -
// this measures the real DOM position of both endpoints (a seat, or the
// treasury pile) and animates small coin dots along that exact path.
// Purely additive: CoinChips/Treasury still do their own shake/count-update
// on the same event.
export default function CoinFlights({
  events,
  containerRef,
  seatRefs,
  treasuryRef,
}: {
  events: TableEvent[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  seatRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
  treasuryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const stolen = events.filter((e): e is Extract<TableEvent, { kind: 'coins-stolen' }> => e.kind === 'coins-stolen');
  const gained = events.filter((e): e is Extract<TableEvent, { kind: 'coins-gained' }> => e.kind === 'coins-gained');
  const paid = events.filter((e): e is Extract<TableEvent, { kind: 'treasury-paid' }> => e.kind === 'treasury-paid');
  const dependencyKey = [...stolen, ...gained, ...paid].map((e) => e.id).join(',');
  const [flights, setFlights] = useState<FlightSpec[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || (stolen.length === 0 && gained.length === 0 && paid.length === 0)) return;
    const containerRect = container.getBoundingClientRect();
    const centerOf = (el: HTMLDivElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 - containerRect.left, y: r.top + r.height / 2 - containerRect.top };
    };

    const next: FlightSpec[] = [];

    for (const event of stolen) {
      const fromEl = seatRefs.current[event.fromId];
      const toEl = seatRefs.current[event.toId];
      if (!fromEl || !toEl) continue;
      const a = centerOf(fromEl);
      const b = centerOf(toEl);
      next.push({ id: event.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, delay: 0 });
    }

    const treasuryEl = treasuryRef.current;
    if (treasuryEl) {
      const t = centerOf(treasuryEl);
      for (const event of gained) {
        const toEl = seatRefs.current[event.playerId];
        if (!toEl) continue;
        const b = centerOf(toEl);
        // A handful of coins arriving in sequence reads better than one dot
        // for +2/+3 gains, capped so a big gain doesn't spawn a swarm.
        const coinCount = Math.min(event.amount, 3);
        for (let i = 0; i < coinCount; i++) {
          next.push({ id: `${event.id}-${i}`, x1: t.x, y1: t.y, x2: b.x, y2: b.y, delay: i * 0.08 });
        }
      }
      for (const event of paid) {
        const fromEl = seatRefs.current[event.playerId];
        if (!fromEl) continue;
        const a = centerOf(fromEl);
        const coinCount = Math.min(event.amount, 3);
        for (let i = 0; i < coinCount; i++) {
          next.push({ id: `${event.id}-${i}`, x1: a.x, y1: a.y, x2: t.x, y2: t.y, delay: i * 0.08 });
        }
      }
    }

    setFlights(next);
    // Only recompute when the actual set of coin events changes - not on
    // every unrelated re-render (e.g. the response countdown ticking).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencyKey]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <AnimatePresence>
        {flights.map((f) => (
          <motion.svg
            key={f.id}
            viewBox="0 0 48 48"
            className="absolute size-4 lg:size-6"
            initial={{ x: f.x1 - 8, y: f.y1 - 8, opacity: 0, scale: 0.8 }}
            animate={{ x: f.x2 - 8, y: f.y2 - 8, opacity: [0, 1, 1, 0], scale: [0.8, 0.8, 1.15, 0.9] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, delay: f.delay, ease: 'easeInOut', times: [0, 0.05, 0.85, 1] }}
          >
            <CoupCoinGlyph />
          </motion.svg>
        ))}
      </AnimatePresence>
    </div>
  );
}
