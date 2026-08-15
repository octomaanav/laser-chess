import { search } from './search';
import type { Difficulty } from './types';
import type { Action, Color, GameState } from '../types';

// All three tiers run the identical search/eval code (search.ts) - the time
// budget, eval noise, and max search depth differ. Easy adds noise so it
// doesn't always play the objectively-best move (reads as "beatable," not
// "broken"). A time budget alone barely separates the tiers in practice -
// depth cost grows roughly 83x per ply in this game, so a shared time budget
// alone mostly lands at the same depth on typical hardware. An explicit
// per-tier depth cap makes the tiers meaningfully distinct regardless of
// hardware speed; hard is left uncapped (limited only by its time budget).
const BUDGET_MS: Record<Difficulty, number> = {
  easy: 300,
  medium: 1000,
  hard: 6000,
};
const NOISE: Record<Difficulty, number> = {
  easy: 15,
  medium: 0,
  hard: 0,
};
const MAX_DEPTH: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: Infinity,
};

export function chooseMove(state: GameState, color: Color, difficulty: Difficulty): Action {
  const deadline = Date.now() + BUDGET_MS[difficulty];
  const { action } = search(state, color, deadline, NOISE[difficulty], MAX_DEPTH[difficulty]);
  return action;
}
