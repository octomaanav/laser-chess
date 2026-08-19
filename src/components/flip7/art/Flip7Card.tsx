import { Snowflake, RotateCcw, ShieldPlus } from 'lucide-react';
import type { Card } from '@/game/flip7/types';
import { cn } from '@/lib/utils';

// Original card face illustration for Flip 7 - flat, code-drawn, no assets.
// Deliberately not reusing Coup's vector-character system (art/CoupCard.tsx):
// number cards get a bold numeral, modifiers/multiplier get their symbol,
// and the three action cards get a distinct icon + label.
export default function Flip7Card({ card, size = 'md' }: { card: Card; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-14 w-10 text-lg' : 'h-20 w-14 text-2xl';

  if (card.kind === 'number') {
    return (
      <div
        className={cn(
          dims,
          'flex items-center justify-center rounded-lg border-2 font-display font-extrabold shadow-sm',
        )}
        style={{ borderColor: 'var(--flip7-panel-border)', background: 'var(--flip7-panel-bg)', color: 'var(--flip7-text)' }}
      >
        {card.value}
      </div>
    );
  }

  if (card.kind === 'modifier') {
    return (
      <div
        className={cn(dims, 'flex items-center justify-center rounded-lg border-2 font-display font-extrabold shadow-sm')}
        style={{ borderColor: 'var(--flip7-green)', background: 'color-mix(in oklab, var(--flip7-green) 16%, transparent)', color: 'var(--flip7-green)' }}
      >
        +{card.value}
      </div>
    );
  }

  if (card.kind === 'multiplier') {
    return (
      <div
        className={cn(dims, 'flex items-center justify-center rounded-lg border-2 font-display font-extrabold shadow-sm')}
        style={{ borderColor: 'var(--flip7-amber)', background: 'color-mix(in oklab, var(--flip7-amber) 18%, transparent)', color: 'var(--flip7-amber)' }}
      >
        x2
      </div>
    );
  }

  // action card
  const cfg = {
    freeze: { Icon: Snowflake, label: 'Freeze', color: '#7dd3fc' },
    'flip-three': { Icon: RotateCcw, label: 'Flip 3', color: 'var(--flip7-danger)' },
    'second-chance': { Icon: ShieldPlus, label: '2nd', color: 'var(--flip7-green)' },
  }[card.action];

  return (
    <div
      className={cn(dims, 'flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 shadow-sm')}
      style={{ borderColor: cfg.color, background: `color-mix(in oklab, ${cfg.color} 16%, transparent)`, color: cfg.color }}
    >
      <cfg.Icon className={size === 'sm' ? 'size-4' : 'size-6'} />
      <span className="text-[9px] font-bold uppercase tracking-wide leading-none">{cfg.label}</span>
    </div>
  );
}
