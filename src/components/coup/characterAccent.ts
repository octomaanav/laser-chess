import type { Character } from '@/game/coup/types';

export const CHARACTER_ACCENT: Record<Character, string> = {
  duke: '#d088c8',
  assassin: '#9aa0a8',
  captain: '#5db8e8',
  ambassador: '#6aad7c',
  contessa: '#e8a848',
};

export const CHARACTER_LABEL: Record<Character, string> = {
  duke: 'Duke',
  assassin: 'Assassin',
  captain: 'Captain',
  ambassador: 'Ambassador',
  contessa: 'Contessa',
};

export const CHARACTER_ABILITY_TEXT: Record<Character, string[]> = {
  duke: ['Take 3 coins', 'Blocks foreign aid'],
  assassin: ['Pay 3 coins to assassinate'],
  captain: ['Steal 2 coins', 'Blocks stealing'],
  ambassador: ['Exchange cards', 'Blocks stealing'],
  contessa: ['Blocks assassination'],
};
