import { ALL_CHARACTERS, type Character } from './types';

// Fisher-Yates. Used for the court deck and the 2-player variant's third pool.
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Standard 15-card deck: 3 of each character, shuffled.
export function buildDeck(): Character[] {
  const deck: Character[] = [];
  for (const c of ALL_CHARACTERS) for (let i = 0; i < 3; i++) deck.push(c);
  return shuffle(deck);
}

// 2-player variant per the rulebook: divide the 15 cards into 3 sets of 5
// (each set has one of each character). Returns the 3 pools in a fixed,
// unshuffled order - the caller assigns pools[0]/pools[1] to the two
// players (each secretly keeps 1 card from their pool) and shuffles
// pools[2] to become the court deck once both have chosen.
export function buildVariantPools(): [Character[], Character[], Character[]] {
  return [ALL_CHARACTERS.slice(), ALL_CHARACTERS.slice(), ALL_CHARACTERS.slice()];
}
