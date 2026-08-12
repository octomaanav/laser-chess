import { cn } from '@/lib/utils';
import type { Character } from '@/game/coup/types';
import { CHARACTER_ABILITY_TEXT, CHARACTER_ACCENT, CHARACTER_LABEL } from './characterAccent';

interface CharacterCardProps {
  character: Character | null; // null = face-down, unknown to this viewer
  revealed?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
}

// HUD-style card: corner brackets, glowing accent name, gradient frame.
// Portrait area is a solid accent-tinted placeholder until real art exists —
// swapping in an <img> there later needs no layout change.
export default function CharacterCard({ character, revealed = false, size = 'lg', className }: CharacterCardProps) {
  const dims = size === 'lg' ? 'w-24 h-32' : 'w-14 h-20';
  if (!character) {
    return (
      <div
        className={cn(dims, 'rounded-lg border border-[#262c36] bg-[#161b22]', className)}
        aria-label="face-down card"
      />
    );
  }

  const accent = CHARACTER_ACCENT[character];
  const label = CHARACTER_LABEL[character];

  return (
    <div
      className={cn(dims, 'relative overflow-hidden rounded-lg', className)}
      style={{
        background: `linear-gradient(150deg, ${accent}22, #0d1117)`,
        boxShadow: `0 0 0 1px ${accent}55${revealed ? '' : ', 0 0 12px ' + accent + '33'}`,
      }}
    >
      <div className="absolute left-1.5 top-1.5 h-2.5 w-2.5 border-l-2 border-t-2 opacity-80" style={{ borderColor: accent }} />
      <div className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b-2 border-r-2 opacity-80" style={{ borderColor: accent }} />
      <div className="absolute inset-x-0 bottom-0 p-1.5">
        <div
          className="mb-1 text-[10px] font-bold uppercase tracking-wide"
          style={{ color: accent, textShadow: `0 0 6px ${accent}` }}
        >
          {label}
        </div>
        {size === 'lg' && (
          <div className="space-y-0.5 text-[8px] uppercase leading-tight text-white/60">
            {CHARACTER_ABILITY_TEXT[character].map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}
      </div>
      {revealed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[9px] font-semibold uppercase tracking-widest text-white/80">
          Revealed
        </div>
      )}
    </div>
  );
}
