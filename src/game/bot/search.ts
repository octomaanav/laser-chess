import { applyAction, opposite } from '../engine';
import type { Action, Color, GameState } from '../types';
import { enumerateActions } from './moveGen';
import { evaluate, DEFAULT_WEIGHTS, type Weights } from './evaluate';
import { computeHash } from './zobrist';
import { quiescence } from './quiescence';
import { createTable, ttLookup, ttStore, type TranspositionTable, type TTFlag } from './transpositionTable';

export interface SearchResult {
  action: Action;
  depthReached: number;
}

const CAPTURE_ORDER_BONUS = 1000;
// Searched before even captures - a transposition table hit's stored best
// move (from a prior search of this exact position) is a stronger ordering
// signal than "this move captures something."
const TT_MOVE_ORDER_BONUS = 2000;

// Applies each action to get its resulting state, tagging capture-producing
// actions so they're searched first - this tightens alpha-beta pruning a lot
// given laser-chess's branching factor (every piece has up to 8 moves + 2
// rotations, plus prism swaps). `preferredAction` (a transposition table
// hit's stored best move, or the previous iterative-deepening depth's best
// move at the root) is searched before even captures.
function orderActions(
  state: GameState,
  color: Color,
  actions: Action[],
  preferredAction?: Action,
): { action: Action; next: GameState }[] {
  const preferredKey = preferredAction ? JSON.stringify(preferredAction) : null;
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
    let priority = result.removed ? CAPTURE_ORDER_BONUS : 0;
    if (preferredKey !== null && JSON.stringify(action) === preferredKey) priority += TT_MOVE_ORDER_BONUS;
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

// Mutable signal threaded through the recursion so a deadline hit anywhere
// in the subtree (not just "was the deadline already past when this root
// action started") is visible back at the root - see the iterative
// deepening comment below. Also gates transposition-table stores: an entry
// computed while any descendant hit the deadline used a fallback evaluate()
// somewhere in its subtree, so it isn't trustworthy to cache.
interface TimedOut {
  timedOut: boolean;
}

function minimax(
  state: GameState,
  color: Color, // whose perspective evaluate() scores from - fixed for the whole search
  toMove: Color,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
  timedOut: TimedOut,
  weights: Weights,
  table: TranspositionTable,
): number {
  if (state.winner) return state.winner === color ? Infinity : -Infinity;

  const hash = computeHash(state);
  const cached = ttLookup(table, hash);
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') return cached.score;
    if (cached.flag === 'lower') alpha = Math.max(alpha, cached.score);
    else beta = Math.min(beta, cached.score);
    if (alpha >= beta) return cached.score;
  }
  // Window actually searched (after TT narrowing); flags are derived against it.
  const searchAlpha = alpha;
  const searchBeta = beta;

  if (depth === 0) {
    // quiescence() returns window-dependent fail-soft bounds, so derive the
    // flag against the exact window it was given, and skip the store if a
    // deadline truncated it.
    const score = quiescence(state, color, toMove, searchAlpha, searchBeta, deadline, timedOut, weights);
    if (!timedOut.timedOut) {
      const flag: TTFlag = score <= searchAlpha ? 'upper' : score >= searchBeta ? 'lower' : 'exact';
      ttStore(table, hash, { depth, score, flag });
    }
    return score;
  }
  if (Date.now() > deadline) {
    timedOut.timedOut = true;
    return evaluate(state, color, weights);
  }

  const ordered = orderActions(state, toMove, enumerateActions(state, toMove), cached?.bestAction);
  if (ordered.length === 0) return evaluate(state, color, weights);

  const maximizing = toMove === color;
  let best = maximizing ? -Infinity : Infinity;
  let bestAction = ordered[0].action;
  for (const { action, next } of ordered) {
    const score = minimax(next, color, opposite(toMove), depth - 1, alpha, beta, deadline, timedOut, weights, table);
    if (maximizing ? score > best : score < best) {
      best = score;
      bestAction = action;
    }
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) break;
    if (Date.now() > deadline) {
      timedOut.timedOut = true;
      break;
    }
  }

  if (!timedOut.timedOut) {
    const flag: TTFlag = best <= searchAlpha ? 'upper' : best >= searchBeta ? 'lower' : 'exact';
    ttStore(table, hash, { depth, score: best, flag, bestAction });
  }
  return best;
}

// Iterative deepening: search depth 1, 2, 3, ... committing each depth's
// result only if that whole depth finished before `deadline` - a partially
// searched depth's root scores aren't comparable (some branches got a
// shallower look than others), so a partial depth is discarded, not
// committed. "Finished" means no deadline truncation happened anywhere in
// the depth's recursion, tracked via the `timedOut` signal above - not
// merely that the deadline hadn't yet passed when the next root action
// started.
//
// `maxDepth` optionally caps how deep iterative deepening goes, independent
// of the time budget - used to give difficulty tiers a real, hardware-
// independent depth ceiling (see bot.ts) since depth cost grows so fast per
// ply that the time budget alone barely separates the tiers.
//
// A fresh transposition table is created per search() call (never persisted
// across moves) and threaded through the whole minimax recursion.
export function search(
  state: GameState,
  color: Color,
  deadline: number,
  noise = 0,
  maxDepth = Infinity,
  weights: Weights = DEFAULT_WEIGHTS,
): SearchResult {
  const table = createTable();
  const initialActions = orderActions(state, color, enumerateActions(state, color));
  if (initialActions.length === 0) throw new Error('no legal actions for bot');

  let best: Action = initialActions[0].action;
  let depthReached = 0;

  for (let depth = 1; depth <= maxDepth && Date.now() < deadline; depth++) {
    let bestScoreThisDepth = -Infinity;
    let bestActionThisDepth = best;
    let completed = true;
    const timedOut: TimedOut = { timedOut: false };

    // Re-order root actions each depth, trying the previous depth's best
    // move first - a shallower depth's best move is usually still strong
    // at the next depth, and trying it first tightens alpha-beta the most.
    const rootActions = orderActions(state, color, enumerateActions(state, color), best);

    for (const { action, next } of rootActions) {
      if (Date.now() > deadline) {
        completed = false;
        break;
      }
      const score = minimax(next, color, opposite(color), depth - 1, -Infinity, Infinity, deadline, timedOut, weights, table);
      // Noise is applied once per root candidate here, not per leaf inside
      // minimax - jittering every leaf and taking the max/min over many
      // noisy samples systematically inflates scores (grows with subtree
      // size) instead of just weakening play. Jittering the final root
      // score keeps the internal search fully deterministic and correct
      // while still occasionally preferring a slightly-worse-but-plausible
      // move.
      const scoreWithNoise = score + jitter(noise);
      if (scoreWithNoise > bestScoreThisDepth) {
        bestScoreThisDepth = scoreWithNoise;
        bestActionThisDepth = action;
      }
    }

    if (timedOut.timedOut) completed = false;
    if (!completed) break;
    best = bestActionThisDepth;
    depthReached = depth;
    if (bestScoreThisDepth === Infinity) break; // found a forced win - no need to search deeper
  }

  return { action: best, depthReached };
}
