// src/components/coup/GameLog.tsx
'use client';
import { useState } from 'react';
import type { LogEntry } from '@/game/coup/types';

export default function GameLog({ entries }: { entries: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const latest = entries[entries.length - 1];

  return (
    <div className="border-t text-xs" style={{ borderColor: 'var(--coup-panel-border)', background: 'var(--coup-panel-bg)' }}>
      <button
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left"
        style={{ color: 'var(--coup-text-muted)' }}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="truncate">{latest?.text ?? 'Game started.'}</span>
        <span className="shrink-0">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div
          className="flex max-h-40 flex-col-reverse gap-1 overflow-y-auto border-t px-3 py-2"
          style={{ borderColor: 'var(--coup-panel-border)', color: 'var(--coup-text-muted)' }}
        >
          {[...entries].reverse().map((e) => (
            <div key={e.id}>{e.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
