'use client';
import { getRank } from '@/game/ranking';
import { cn } from '@/lib/utils';

interface Props {
  rating: number | null;
  size?: 'sm' | 'md';
}

export default function RankBadge({ rating, size = 'md' }: Props) {
  if (rating == null) return null;
  const { name, emoji, color } = getRank(rating);
  const isPremium = name.includes('Diamond') || name.includes('Master');
  const compact = size === 'sm';
  
  return (
    <span
      className={cn(
        'group inline-flex items-center gap-2 rounded-2xl border px-3 py-2 font-semibold leading-none transition-all duration-300',
        compact ? 'min-h-10 min-w-0' : 'min-h-14 min-w-44',
      )}
      style={{
        borderColor: `${color}55`,
        background: isPremium
          ? `linear-gradient(135deg, color-mix(in oklab, ${color} 18%, var(--card)), color-mix(in oklab, ${color} 32%, var(--card)))`
          : `linear-gradient(135deg, color-mix(in oklab, ${color} 10%, var(--card)), color-mix(in oklab, ${color} 18%, var(--card)))`,
        color,
        boxShadow: isPremium
          ? `0 10px 28px color-mix(in oklab, ${color} 20%, transparent), inset 0 1px 0 color-mix(in oklab, ${color} 38%, transparent)`
          : `0 8px 20px color-mix(in oklab, ${color} 10%, transparent), inset 0 1px 0 color-mix(in oklab, ${color} 24%, transparent)`
      }}
      title={`${name} rank`}
    >
      <span className={cn('relative grid shrink-0 place-items-center rounded-full border', compact ? 'size-7' : 'size-9')} style={{ borderColor: `${color}55` }}>
        <span
          aria-hidden
          className="absolute inset-0 rounded-full opacity-70 blur-md"
          style={{ background: `radial-gradient(circle, ${color}40, transparent 68%)` }}
        />
        <span className="relative text-sm drop-shadow-sm" style={{ filter: isPremium ? `drop-shadow(0 0 5px ${color}88)` : undefined }}>
          {emoji}
        </span>
      </span>
      <span className={cn('flex min-w-0 flex-col text-left', compact ? 'gap-0.5' : 'gap-1')}>
        <span className={cn('text-[10px] uppercase tracking-[0.24em] text-muted-foreground', isPremium && 'text-current/70')}>
          Ranked
        </span>
        <span className={cn('truncate text-foreground', compact ? 'text-sm' : 'text-base')}>{name}</span>
      </span>
    </span>
  );
}
