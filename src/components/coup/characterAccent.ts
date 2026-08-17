import type { Character } from '@/game/coup/types';

export const CHARACTER_ACCENT: Record<Character, string> = {
  chair: '#d088c8',
  fixer: '#9aa0a8',
  auditor: '#5db8e8',
  broker: '#6aad7c',
  counsel: '#e8a848',
};

export const CHARACTER_LABEL: Record<Character, string> = {
  chair: 'Chair',
  fixer: 'Fixer',
  auditor: 'Auditor',
  broker: 'Broker',
  counsel: 'Counsel',
};

export const CHARACTER_ABILITY_TEXT: Record<Character, string[]> = {
  chair: ['Take 3 coins', 'Blocks foreign aid'],
  fixer: ['Pay 3 coins to assassinate'],
  auditor: ['Steal 2 coins', 'Blocks stealing'],
  broker: ['Exchange cards', 'Blocks stealing'],
  counsel: ['Blocks assassination'],
};
