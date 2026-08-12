import { cn } from '@/lib/utils';
import type { Character } from '@/game/coup/types';
import { CHARACTER_ACCENT } from './characterAccent';
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
}

const CARD_ART: Record<Character, () => React.ReactElement> = {
  duke: DukeCard,
  assassin: AssassinCard,
  captain: CaptainCard,
  ambassador: AmbassadorCard,
  contessa: ContessaCard,
};

// Card face is a full standalone SVG (icon + name + ability text baked in) —
// this component just handles face-down/revealed states and sizing.
export default function CharacterCard({ character, revealed = false, size = 'lg', className }: CharacterCardProps) {
  const dims = size === 'lg' ? 'w-24 h-32 lg:w-[170px] lg:h-[230px]' : 'w-14 h-20 lg:w-[110px] lg:h-[155px]';
  if (!character) {
    return (
      <div
        className={cn(dims, 'rounded-lg border border-[#262c36] bg-[#161b22]', className)}
        aria-label="face-down card"
      />
    );
  }

  const accent = CHARACTER_ACCENT[character];
  const Art = CARD_ART[character];

  return (
    <div
      className={cn(dims, 'relative overflow-hidden rounded-lg', className)}
      style={{ boxShadow: `0 0 0 1px ${accent}55${revealed ? '' : ', 0 0 12px ' + accent + '33'}` }}
    >
      <Art />
      {revealed && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[9px] font-semibold uppercase tracking-widest text-white/80">
          Revealed
        </div>
      )}
    </div>
  );
}
