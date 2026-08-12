// src/components/coup/GameLog.tsx
import type { LogEntry } from '@/game/coup/types';

export default function GameLog({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="flex h-full flex-col-reverse gap-1 overflow-y-auto p-2 text-xs text-[#8a909b]">
      {[...entries].reverse().map((e) => (
        <div key={e.id}>{e.text}</div>
      ))}
    </div>
  );
}
