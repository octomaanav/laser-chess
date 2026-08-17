import { cn } from '@/lib/utils';
import type { Character } from '@/game/coup/types';
import { CHARACTER_ACCENT } from './characterAccent';
import CardBack from './art/CardBack';
import CoupCard from './art/CoupCard';
import { CARDS } from './art/coupCardData';

interface CharacterCardProps {
  character: Character | null; // null = face-down, unknown to this viewer
  revealed?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
  // See CardFace: index of the ability line dragging this card would claim.
  // Only meaningful (and only passed) for your own playable hand cards.
  activeAbilityIndex?: number;
}

const CARD_DATA: Record<Character, (typeof CARDS)[number]> = Object.fromEntries(
  CARDS.map((c) => [c.key, c])
) as Record<Character, (typeof CARDS)[number]>;

// Card face is a full standalone SVG (icon + name + ability text baked in) -
// this component just handles face-down/revealed states and sizing.
// Fluid, viewport-HEIGHT-driven sizing (clamp, not a width breakpoint) so
// cards actually shrink on a short-but-wide window instead of staying
// pinned at the desktop pixel size and forcing a scroll.
//
// Height comes from `aspect-ratio` rather than a second clamp: two
// independent clamps drift out of the art's 300x420 ratio at the ends of
// their ranges (the old lg max, 170x230, was 0.739 against the art's
// 0.714). The SVG then letterboxed inside the box, leaving the visible
// card smaller than the element CardTilt measures - so the tilt and sheen
// responded to dead space around a face-down card.
const CARD_ASPECT = '300 / 420';

// The art's own corner radius (rx="22" against the 300-wide viewBox) scales
// with the card, so a fixed container radius can't match it: at a rendered
// 170px the art rounds at ~12.5px while `rounded-lg` clips at 8px, and the
// table shows through where the art's tighter corner pulls away from the
// clip. Deriving the container radius from the same ratio keeps the clip,
// the art, and the face-up accent ring on exactly the same curve.
export const CARD_RADIUS_RATIO = 22 / 300;

const SIZE_WIDTHS: Record<'sm' | 'lg', string> = {
  lg: 'clamp(84px, 15vh, 170px)',
  sm: 'clamp(50px, 9vh, 110px)',
};

// Anything drawing an edge around a card - an outline, a focus ring, the
// tilt sheen - has to use this rather than a fixed radius, or it drifts off
// the card's curve as the card scales.
export function cardRadius(size: 'sm' | 'lg' = 'lg') {
  return `calc(${SIZE_WIDTHS[size]} * ${CARD_RADIUS_RATIO})`;
}

function sizeStyle(size: 'sm' | 'lg') {
  return {
    width: SIZE_WIDTHS[size],
    aspectRatio: CARD_ASPECT,
    borderRadius: cardRadius(size),
  };
}

export default function CharacterCard({ character, revealed = false, size = 'lg', className, activeAbilityIndex }: CharacterCardProps) {
  const dims = sizeStyle(size);
  if (!character) {
    return (
      <div className={cn('overflow-hidden', className)} style={dims}>
        <CardBack />
      </div>
    );
  }

  const accent = CHARACTER_ACCENT[character];
  const data = CARD_DATA[character];

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ ...dims, boxShadow: `0 0 0 1px ${accent}55${revealed ? '' : ', 0 0 12px ' + accent + '33'}` }}
    >
      <div className={cn(revealed && 'grayscale')}>
        <CoupCard {...data} activeAbilityIndex={activeAbilityIndex} />
      </div>
      {revealed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 pb-[22%] text-white/80">
          <svg
            viewBox="0 0 24 24"
            className="h-2/5 w-2/5 opacity-80"
            style={{ stroke: 'var(--coup-danger)' }}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
          <span className="text-[9px] font-semibold uppercase tracking-widest">Revealed</span>
        </div>
      )}
    </div>
  );
}
