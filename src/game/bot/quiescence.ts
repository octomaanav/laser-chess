// src/game/bot/quiescence.ts
import { applyAction, opposite } from '../engine';
import type { Action, Color, GameState } from '../types';
import { enumerateActions } from './moveGen';
import { evaluate, type Weights } from './evaluate';

const QUIESCENCE_MAX_PLIES = 4;

interface CaptureMove {
  action: Action;
  next: GameState;
}

// Only the capture-producing subset of legal actions.
function captureMoves(state: GameState, color: Color): CaptureMove[] {
  const moves: CaptureMove[] = [];
  for (const action of enumerateActions(state, color)) {
    const result = applyAction(state, color, action);
    if (!result.ok || !result.removed) continue;
    moves.push({
      action,
      next: {
        ...state,
        board: result.board!,
        turn: result.turn!,
        winner: result.winner!,
        moveCount: state.moveCount + 1,
      },
    });
  }
  return moves;
}

// Extends search past the horizon at a leaf node by continuing to search
// capture-only lines until the position is quiet (no captures left) or
// `pliesLeft` runs out - fixes the horizon effect, where a static
// evaluate() call mid-capture-exchange can misjudge a position that's
// about to see further material change. Same TimedOut-threaded deadline
// pattern as minimax(), so a long capture chain can't blow the time budget.
export function quiescence(
  state: GameState,
  color: Color,
  toMove: Color,
  alpha: number,
  beta: number,
  deadline: number,
  timedOut: { timedOut: boolean },
  weights: Weights,
  pliesLeft: number = QUIESCENCE_MAX_PLIES,
): number {
  if (state.winner) return state.winner === color ? Infinity : -Infinity;

  const standPat = evaluate(state, color, weights);
  if (pliesLeft === 0 || Date.now() > deadline) {
    if (Date.now() > deadline) timedOut.timedOut = true;
    return standPat;
  }

  const maximizing = toMove === color;
  // "Stand pat": the side to move isn't forced to capture - if simply
  // stopping here already fails the search window, no capture line found
  // below can improve on that from this side's perspective.
  if (maximizing) {
    if (standPat >= beta) return standPat;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return standPat;
    beta = Math.min(beta, standPat);
  }

  const captures = captureMoves(state, toMove);
  if (captures.length === 0) return standPat;

  let best = standPat;
  for (const { next } of captures) {
    const score = quiescence(next, color, opposite(toMove), alpha, beta, deadline, timedOut, weights, pliesLeft - 1);
    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
    if (Date.now() > deadline) {
      timedOut.timedOut = true;
      break;
    }
  }
  return best;
}
