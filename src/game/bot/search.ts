import { applyAction, opposite } from '../engine';
import type { Action, Color, GameState } from '../types';
import { enumerateActions } from './moveGen';
import { evaluate } from './evaluate';

export interface SearchResult {
  action: Action;
  depthReached: number;
}

const CAPTURE_ORDER_BONUS = 1000;

// Applies each action to get its resulting state, tagging capture-producing
// actions so they're searched first — this tightens alpha-beta pruning a lot
// given laser-chess's branching factor (every piece has up to 8 moves + 2
// rotations, plus scarab swaps).
function orderActions(state: GameState, color: Color, actions: Action[]): { action: Action; next: GameState }[] {
  const scored = actions.map((action) => {
    const result = applyAction(state, color, action);
    if (!result.ok) return null;
    const next: GameState = {
      ...state,
      board: result.board!,
      turn: result.turn!,
      winner: result.winner!,
      moveCount: state.moveCount + 1,
    };
    const priority = result.removed ? CAPTURE_ORDER_BONUS : 0;
    return { action, next, priority };
  });
  return scored
    .filter((s): s is { action: Action; next: GameState; priority: number } => s !== null)
    .sort((a, b) => b.priority - a.priority)
    .map(({ action, next }) => ({ action, next }));
}

function jitter(noise: number): number {
  return noise ? (Math.random() * 2 - 1) * noise : 0;
}

function minimax(
  state: GameState,
  color: Color, // whose perspective evaluate() scores from — fixed for the whole search
  toMove: Color,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
  noise: number,
): number {
  if (state.winner) return state.winner === color ? Infinity : -Infinity;
  if (depth === 0 || Date.now() > deadline) return evaluate(state, color) + jitter(noise);

  const ordered = orderActions(state, toMove, enumerateActions(state, toMove));
  if (ordered.length === 0) return evaluate(state, color) + jitter(noise);

  const maximizing = toMove === color;
  let best = maximizing ? -Infinity : Infinity;
  for (const { next } of ordered) {
    const score = minimax(next, color, opposite(toMove), depth - 1, alpha, beta, deadline, noise);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
    if (Date.now() > deadline) break;
  }
  return best;
}

// Iterative deepening: search depth 1, 2, 3, ... committing each depth's
// result only if that whole depth finished before `deadline` — a partially
// searched depth's root scores aren't comparable (some branches got a
// shallower look than others), so a partial depth is discarded, not committed.
export function search(state: GameState, color: Color, deadline: number, noise = 0): SearchResult {
  const rootActions = orderActions(state, color, enumerateActions(state, color));
  if (rootActions.length === 0) throw new Error('no legal actions for bot');

  let best: Action = rootActions[0].action;
  let depthReached = 0;

  for (let depth = 1; Date.now() < deadline; depth++) {
    let bestScoreThisDepth = -Infinity;
    let bestActionThisDepth = best;
    let completed = true;

    for (const { action, next } of rootActions) {
      if (Date.now() > deadline) {
        completed = false;
        break;
      }
      const score = minimax(next, color, opposite(color), depth - 1, -Infinity, Infinity, deadline, noise);
      if (score > bestScoreThisDepth) {
        bestScoreThisDepth = score;
        bestActionThisDepth = action;
      }
    }

    if (!completed) break;
    best = bestActionThisDepth;
    depthReached = depth;
    if (bestScoreThisDepth === Infinity) break; // found a forced win — no need to search deeper
  }

  return { action: best, depthReached };
}
