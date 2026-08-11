import { search } from './search';
import type { Difficulty } from './types';
import type { Action, Color, GameState } from '../types';

// All three tiers run the identical search/eval code (search.ts) — only the
// time budget and eval noise differ. Easy adds noise so it doesn't always
// play the objectively-best move (reads as "beatable," not "broken").
const BUDGET_MS: Record<Difficulty, number> = {
  easy: 300,
  medium: 1000,
  hard: 3000,
};
const NOISE: Record<Difficulty, number> = {
  easy: 15,
  medium: 0,
  hard: 0,
};

export function chooseMove(state: GameState, color: Color, difficulty: Difficulty): Action {
  const deadline = Date.now() + BUDGET_MS[difficulty];
  const { action } = search(state, color, deadline, NOISE[difficulty]);
  return action;
}
