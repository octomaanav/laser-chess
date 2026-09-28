import { search, type SearchOptions } from './search';
import type { Difficulty } from './types';
import type { Action, Color, GameState } from '../types';

// All tiers run the same search/eval code (search.ts) - what differs is the
// time budget, eval noise, max depth, and which search extensions are on.
//
// - easy: one ply with noise, so it doesn't always play the objectively-best
//   move (reads as "beatable," not "broken").
// - medium: two plies - sees your direct reply to its move.
// - hard: plain alpha-beta, as deep as 3s allows (typically 4 plies).
// - extreme: everything on, no depth cap, long think. Quiescence follows laser
//   captures past the horizon (it won't walk into a shot, or miss one it
//   has); late-move reductions spend the time on the lines that matter. Each
//   was kept only after beating the search without it in self-play.
//
// Depth cost grows roughly 83x per ply in this game, so a time budget alone
// barely separates tiers on fast hardware - the explicit depth caps keep
// easy and medium where they are regardless of the machine.
export interface TierConfig {
  budgetMs: number;
  noise: number;
  maxDepth: number;
  options: SearchOptions;
}

export const TIERS: Record<Difficulty, TierConfig> = {
  easy: { budgetMs: 300, noise: 15, maxDepth: 1, options: {} },
  medium: { budgetMs: 1000, noise: 0, maxDepth: 2, options: {} },
  hard: { budgetMs: 3000, noise: 0, maxDepth: Infinity, options: {} },
  extreme: { budgetMs: 10_000, noise: 0, maxDepth: Infinity, options: { quiescence: true, lmr: true } },
};

export function chooseMove(state: GameState, color: Color, difficulty: Difficulty): Action {
  const tier = TIERS[difficulty];
  const deadline = Date.now() + tier.budgetMs;
  return search(state, color, deadline, tier.noise, tier.maxDepth, undefined, tier.options).action;
}
