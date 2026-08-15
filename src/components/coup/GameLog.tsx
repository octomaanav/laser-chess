// src/components/coup/GameLog.tsx
'use client';
import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import type { LogEntry } from '@/game/coup/types';

// Floats over the table instead of docking in-flow at the bottom of the
// column - that made it compete for the same limited vertical space as the
// hand cards, and easy to miss entirely. Collapsed, it's just a small
// latest-line pill in the corner; expanded, it's a short scrollable panel
// that overlays the table without pushing anything else around.
export default function GameLog({ entries }: { entries: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const latest = entries[entries.length - 1];

  return (
    <div className="absolute bottom-3 left-3 z-20 flex max-w-[min(90vw,320px)] flex-col-reverse lg:bottom-4 lg:left-4">
      <button
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs shadow-lg backdrop-blur"
        style={{
          borderColor: 'var(--coup-panel-border)',
          background: 'color-mix(in oklab, var(--coup-panel-bg) 90%, transparent)',
          color: 'var(--coup-text-muted)',
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <ScrollText className="size-3.5 shrink-0" />
        <span className="truncate">{latest?.text ?? 'Game started.'}</span>
      </button>
      {expanded && (
        <div
          className="mb-2 flex max-h-52 flex-col-reverse gap-1 overflow-y-auto rounded-lg border p-2.5 text-xs shadow-lg backdrop-blur"
          style={{
            borderColor: 'var(--coup-panel-border)',
            background: 'color-mix(in oklab, var(--coup-panel-bg) 94%, transparent)',
            color: 'var(--coup-text-muted)',
          }}
        >
          {[...entries].reverse().map((e) => (
            <div key={e.id}>{e.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
