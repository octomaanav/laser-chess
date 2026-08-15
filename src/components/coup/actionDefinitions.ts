// src/components/coup/actionDefinitions.ts
import { Coins, HandCoins, Crown, Shuffle, Hand, Skull, Swords, type LucideIcon } from 'lucide-react';
import type { ActionType } from '@/game/coup/types';

export interface ActionDef {
  type: ActionType;
  label: string;
  icon: LucideIcon;
  needsTarget: boolean;
  minCoins: number;
  accentVar: string;
}

export const ACTIONS: ActionDef[] = [
  { type: 'income', label: 'Income (+1)', icon: Coins, needsTarget: false, minCoins: 0, accentVar: 'var(--coup-gold)' },
  { type: 'foreign-aid', label: 'Foreign Aid (+2)', icon: HandCoins, needsTarget: false, minCoins: 0, accentVar: 'var(--coup-gold)' },
  { type: 'tax', label: 'Tax: Duke (+3)', icon: Crown, needsTarget: false, minCoins: 0, accentVar: 'var(--coup-duke)' },
  { type: 'exchange', label: 'Exchange: Ambassador', icon: Shuffle, needsTarget: false, minCoins: 0, accentVar: 'var(--coup-ambassador)' },
  { type: 'steal', label: 'Steal: Captain', icon: Hand, needsTarget: true, minCoins: 0, accentVar: 'var(--coup-captain)' },
  { type: 'assassinate', label: 'Assassinate: Assassin (3)', icon: Skull, needsTarget: true, minCoins: 3, accentVar: 'var(--coup-assassin)' },
  { type: 'coup', label: 'Coup (7)', icon: Swords, needsTarget: true, minCoins: 7, accentVar: 'var(--coup-gold)' },
];
