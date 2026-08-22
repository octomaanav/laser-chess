import type { Card, ModifierValue, NumberValue } from './types';

// Fisher-Yates.
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Standard 94-card deck: number cards 0-12 (0 and 1 have exactly 1 copy each,
// n has n copies for 2-12 => 79 cards), 5 flat modifiers + the single x2
// multiplier (6 cards), and 9 action cards (3 each of Freeze, Flip Three,
// Second Chance). Shuffled.
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (let value = 0; value <= 12; value++) {
    const count = value === 0 ? 1 : value;
    for (let i = 0; i < count; i++) deck.push({ kind: 'number', value: value as NumberValue });
  }
  const modifierValues: ModifierValue[] = [2, 4, 6, 8, 10];
  for (const value of modifierValues) deck.push({ kind: 'modifier', value });
  deck.push({ kind: 'multiplier' });
  for (let i = 0; i < 3; i++) deck.push({ kind: 'action', action: 'freeze' });
  for (let i = 0; i < 3; i++) deck.push({ kind: 'action', action: 'flip-three' });
  for (let i = 0; i < 3; i++) deck.push({ kind: 'action', action: 'second-chance' });
  return shuffle(deck);
}
