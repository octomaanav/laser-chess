// src/components/flip7/GameLog.tsx
'use client';
import React, { useState } from 'react';
import { ScrollText, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { LogEntry } from '@/game/flip7/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function GameLog({
  entries,
  className,
}: {
  entries: LogEntry[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const latest = entries[entries.length - 1];

  return (
    <div className={cn('relative z-30 select-none', className)}>
      {/* Trigger Button / Ticker Pill */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex max-w-[280px] sm:max-w-xs items-center gap-2 rounded-full border border-amber-500/25 bg-[#141c26]/90 px-3 py-1 text-xs text-slate-300 shadow-md backdrop-blur-md transition-all hover:border-amber-400 hover:bg-[#182330]"
      >
        <ScrollText className="size-3.5 shrink-0 text-amber-400" />
        <span className="truncate text-left font-medium text-slate-200">
          {latest?.text ?? 'Game started.'}
        </span>
        {open ? (
          <ChevronUp className="size-3.5 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
        )}
      </button>

      {/* Expanded History Modal / Popover */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-amber-500/30 bg-[#121822]/98 p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <ScrollText className="size-3.5" />
              <span>Game History</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="size-6 p-0 text-slate-400 hover:text-white"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto pr-1 text-xs">
            {entries.length === 0 ? (
              <p className="py-3 text-center text-slate-500">No events yet.</p>
            ) : (
              [...entries].reverse().map((e) => (
                <div
                  key={e.id}
                  className="rounded-lg border border-white/5 bg-black/25 px-2.5 py-1.5 text-slate-300 leading-relaxed font-sans"
                >
                  {e.text}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
