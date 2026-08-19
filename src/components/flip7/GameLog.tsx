// src/components/flip7/GameLog.tsx
'use client';
import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import type { LogEntry } from '@/game/flip7/types';

// Floats over the table instead of docking in-flow - collapsed, it's a
// small latest-line pill; expanded, a short scrollable panel that overlays
// the table without pushing anything else around.
export default function GameLog({ entries }: { entries: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const latest = entries[entries.length - 1];

  return (
    <div className="absolute bottom-3 left-3 z-20 flex max-w-[min(90vw,320px)] flex-col-reverse lg:bottom-4 lg:left-4">
      <button
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs shadow-lg backdrop-blur"
        style={{
          borderColor: 'var(--flip7-panel-border)',
          background: 'color-mix(in oklab, var(--flip7-panel-bg) 90%, transparent)',
          color: 'var(--flip7-text-muted)',
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
            borderColor: 'var(--flip7-panel-border)',
            background: 'color-mix(in oklab, var(--flip7-panel-bg) 94%, transparent)',
            color: 'var(--flip7-text-muted)',
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
