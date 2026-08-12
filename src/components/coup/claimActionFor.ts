// src/components/coup/claimActionFor.ts
import type { ActionType, Character } from '@/game/coup/types';

// Which action dragging a hand card declares. Contessa has no entry — she
// has no action of her own (only blocks assassination), so her card in
// hand isn't draggable-to-declare; CoupTable renders it as a plain
// CharacterCard instead of a DraggableCard.
export const CLAIM_ACTION_FOR: Partial<Record<Character, ActionType>> = {
  duke: 'tax',
  captain: 'steal',
  assassin: 'assassinate',
  ambassador: 'exchange',
};
