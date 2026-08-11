import { COLS, ROWS, legalActionsFor } from '../engine';
import type { Action, Color, GameState } from '../types';

// All legal actions for every piece `color` owns, flattened into one list.
// Thin wrapper over engine.ts's per-piece legalActionsFor — never duplicates
// rule logic.
export function enumerateActions(state: GameState, color: Color): Action[] {
  const actions: Action[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const piece = state.board[y][x];
      if (piece && piece.color === color) actions.push(...legalActionsFor(state.board, color, x, y));
    }
  }
  return actions;
}
