'use client';
import { getRank } from '@/game/ranking';

interface Props {
  rating: number | null;
  size?: 'sm' | 'md';
}

export default function RankBadge({ rating, size = 'md' }: Props) {
  if (rating == null) return null;
  const { name, emoji, color } = getRank(rating);
  const isPremium = name.includes('Diamond') || name.includes('Master');
  const px = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-3 py-1 text-sm';
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold leading-none ${px} transition-all duration-300`}
      style={{ 
        borderColor: `${color}88`, 
        background: isPremium ? `linear-gradient(135deg, ${color}10, ${color}33)` : `${color}18`, 
        color,
        boxShadow: isPremium ? `0 0 12px ${color}40, inset 0 0 8px ${color}20` : `0 0 6px ${color}20`
      }}
      title={`${name} rank`}
    >
      <span className="drop-shadow-md" style={{ filter: isPremium ? `drop-shadow(0 0 4px ${color}80)` : undefined }}>{emoji}</span>
      <span style={{ textShadow: isPremium ? `0 0 8px ${color}60` : undefined }}>{name}</span>
    </span>
  );
}
