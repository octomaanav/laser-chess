// src/game/ranking.test.ts
import { describe, expect, it } from 'vitest';
import { applyResult, DEFAULT_RATING, getRank, MAX_RATING, normalizeStars, starsToPromote, type RankProgress } from './ranking';

const at = (name: string, stars = 0): RankProgress => {
  for (let r = 0; r <= MAX_RATING; r++) if (getRank(r).name === name) return { rating: r, stars };
  throw new Error(`no rank ${name}`);
};
const named = (p: RankProgress) => ({ rank: getRank(p.rating).name, stars: p.stars });

describe('stars to promote', () => {
  it('grows by tier', () => {
    expect(starsToPromote(at('Bronze 2').rating)).toBe(1);
    expect(starsToPromote(at('Silver 1').rating)).toBe(2);
    expect(starsToPromote(at('Gold 3').rating)).toBe(3);
    expect(starsToPromote(at('Platinum 1').rating)).toBe(4);
    expect(starsToPromote(at('Diamond 3').rating)).toBe(5);
    expect(starsToPromote(MAX_RATING)).toBe(0);
  });
});

describe('applyResult', () => {
  it('adds a star per win and promotes on a full set', () => {
    expect(named(applyResult(at('Gold 1', 0), true))).toEqual({ rank: 'Gold 1', stars: 1 });
    expect(named(applyResult(at('Gold 1', 2), true))).toEqual({ rank: 'Gold 2', stars: 0 });
    expect(named(applyResult(at('Diamond 3', 4), true))).toEqual({ rank: 'Master', stars: 0 });
  });

  it('takes a star per loss and demotes when they run out', () => {
    expect(named(applyResult(at('Gold 1', 2), false))).toEqual({ rank: 'Gold 1', stars: 1 });
    expect(named(applyResult(at('Gold 1', 0), false))).toEqual({ rank: 'Silver 3', stars: 1 });
  });

  it('costs two stars per loss in Diamond', () => {
    expect(named(applyResult(at('Diamond 2', 3), false))).toEqual({ rank: 'Diamond 2', stars: 1 });
    expect(named(applyResult(at('Diamond 1', 1), false))).toEqual({ rank: 'Platinum 3', stars: 3 });
  });

  it('drops Master back into Diamond on a single loss', () => {
    expect(named(applyResult({ rating: MAX_RATING, stars: 0 }, false))).toEqual({ rank: 'Diamond 3', stars: 3 });
  });

  it('never drops below Bronze 1', () => {
    expect(named(applyResult(at('Bronze 1', 0), false))).toEqual({ rank: 'Bronze 1', stars: 0 });
  });

  it('takes 42 straight wins from the starting rank to Master', () => {
    let p: RankProgress = { rating: DEFAULT_RATING, stars: 0 };
    let wins = 0;
    while (p.rating < MAX_RATING) {
      p = applyResult(p, true);
      wins++;
    }
    expect(wins).toBe(42);
  });

  it('needs better than a 2-in-3 win rate to make progress in Diamond', () => {
    // win, win, loss repeated: +1 +1 -2 = no progress at all.
    let p = at('Diamond 2', 2);
    for (let i = 0; i < 10; i++) for (const won of [true, true, false]) p = applyResult(p, won);
    expect(named(p)).toEqual({ rank: 'Diamond 2', stars: 2 });
  });
});

describe('normalizeStars', () => {
  it('clamps legacy and out-of-range values', () => {
    expect(normalizeStars(at('Gold 1').rating, undefined)).toBe(0);
    expect(normalizeStars(at('Gold 1').rating, 7)).toBe(2);
    expect(normalizeStars(MAX_RATING, 3)).toBe(0);
    expect(normalizeStars(at('Gold 1').rating, -1)).toBe(0);
  });
});
