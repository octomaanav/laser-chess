import { cn } from '@/lib/utils';
import type { Character } from '@/game/coup/types';
import { CHARACTER_ACCENT } from './characterAccent';
import CardBack from './art/CardBack';
import DukeCard from './art/DukeCard';
import AssassinCard from './art/AssassinCard';
import CaptainCard from './art/CaptainCard';
import AmbassadorCard from './art/AmbassadorCard';
import ContessaCard from './art/ContessaCard';

interface CharacterCardProps {
  character: Character | null; // null = face-down, unknown to this viewer
  revealed?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
  // See CardFace: index of the ability line dragging this card would claim.
  // Only meaningful (and only passed) for your own playable hand cards.
  activeAbilityIndex?: number;
}

const CARD_ART: Record<Character, (props: { activeAbilityIndex?: number }) => React.ReactElement> = {
  duke: DukeCard,
  assassin: AssassinCard,
  captain: CaptainCard,
  ambassador: AmbassadorCard,
  contessa: ContessaCard,
};

// Card face is a full standalone SVG (icon + name + ability text baked in) —
// this component just handles face-down/revealed states and sizing.
// Fluid, viewport-HEIGHT-driven sizing (clamp, not a width breakpoint) so
// cards actually shrink on a short-but-wide window instead of staying
// pinned at the desktop pixel size and forcing a scroll. Aspect ratio
// (~0.71) matches the card art's 300x420 viewBox at every size.
const SIZE_DIMS: Record<'sm' | 'lg', { width: string; height: string }> = {
  lg: { width: 'clamp(84px, 15vh, 170px)', height: 'clamp(118px, 21vh, 230px)' },
  sm: { width: 'clamp(50px, 9vh, 110px)', height: 'clamp(70px, 13vh, 155px)' },
};

export default function CharacterCard({ character, revealed = false, size = 'lg', className, activeAbilityIndex }: CharacterCardProps) {
  const dims = SIZE_DIMS[size];
  if (!character) {
    return (
      <div className={cn('overflow-hidden rounded-lg', className)} style={dims}>
        <CardBack />
      </div>
    );
  }

  const accent = CHARACTER_ACCENT[character];
  const Art = CARD_ART[character];

  return (
    <div
      className={cn('relative overflow-hidden rounded-lg', className)}
      style={{ ...dims, boxShadow: `0 0 0 1px ${accent}55${revealed ? '' : ', 0 0 12px ' + accent + '33'}` }}
    >
      <Art activeAbilityIndex={activeAbilityIndex} />
      {revealed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[9px] font-semibold uppercase tracking-widest text-white/80">
          Revealed
        </div>
      )}
    </div>
  );
}
