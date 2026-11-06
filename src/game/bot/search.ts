import { COLS, opposite, resolveAction, ROWS } from '../engine';
import type { Action, Board, Color, GameState, PieceType } from '../types';
import { enumerateActions } from './moveGen';
import { evaluate, DEFAULT_WEIGHTS, type Weights } from './evaluate';

export interface SearchResult {
  action: Action;
  depthReached: number;
  score: number; // from the searching side's view; ±(MATE - plies) for a forced result
}

export interface SearchOptions {
  // Keep searching laser captures past the nominal depth, so the bot doesn't
  // stop reading one move before a piece (or its pharaoh) gets shot.
  quiescence?: boolean;
  // Search quiet moves that come late in the ordering one ply shallower, and
  // only re-search them at full depth if that reduced look says they're good.
  lmr?: boolean;
}

// Wins are scored MATE minus the ply they happen on, so the search prefers the
// fastest win and, when every line loses, the one that holds out longest -
// rather than treating all forced results as equal and picking arbitrarily.
export const MATE = 1_000_000;
const MATE_BOUND = MATE - 10_000;
const isMateScore = (s: number) => Math.abs(s) >= MATE_BOUND;

// Only laser captures are followed, and only this many plies past the horizon.
const MAX_QUIESCENCE_PLIES = 4;
// The transposition table lives for one search (one worker per move); this
// just bounds its memory on a very long think.
const MAX_TT_ENTRIES = 2_000_000;

const PIECE_VALUE: Record<PieceType, number> = { pharaoh: 1000, scarab: 30, anubis: 20, pyramid: 10, sphinx: 0 };

// ---- Zobrist hashing ----------------------------------------------------------
// Two 32-bit halves folded into one 53-bit number (a safe Map key). Seeded so
// hashes are stable across runs.
const PIECE_KINDS: PieceType[] = ['pharaoh', 'pyramid', 'scarab', 'anubis', 'sphinx'];
const KIND_INDEX = Object.fromEntries(PIECE_KINDS.map((k, i) => [k, i])) as Record<PieceType, number>;
const VARIANTS = PIECE_KINDS.length * 2 * 4; // kind × color × orientation

let seed = 0x9e3779b9;
function rand32(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
}
const Z_LO = Uint32Array.from({ length: ROWS * COLS * VARIANTS }, rand32);
const Z_HI = Uint32Array.from({ length: ROWS * COLS * VARIANTS }, rand32);
const SIDE_LO = rand32();
const SIDE_HI = rand32();

function hashPosition(board: Board, toMove: Color): number {
  let lo = toMove === 'red' ? SIDE_LO : 0;
  let hi = toMove === 'red' ? SIDE_HI : 0;
  for (let y = 0; y < ROWS; y++) {
    const row = board[y];
    for (let x = 0; x < COLS; x++) {
      const p = row[x];
      if (!p) continue;
      const i = (y * COLS + x) * VARIANTS + KIND_INDEX[p.type] * 8 + (p.color === 'red' ? 4 : 0) + p.orient;
      lo ^= Z_LO[i];
      hi ^= Z_HI[i];
    }
  }
  return (hi & 0x1fffff) * 0x100000000 + (lo >>> 0);
}

function actionKey(a: Action): string {
  return a.type === 'move' ? `m${a.x}${a.y}${a.tx}${a.ty}` : `r${a.x}${a.y}${a.orient}`;
}

// ---- search state ---------------------------------------------------------------
const EXACT = 0,
  LOWER = 1,
  UPPER = 2;
interface TTEntry {
  depth: number;
  score: number;
  flag: number;
  move: string | null;
}

interface Ctx {
  root: Color; // evaluate() always scores from the root side's point of view
  deadline: number;
  weights: Weights;
  quiescence: boolean;
  lmr: boolean;
  // Set once the deadline hits anywhere in the tree, so the root can throw away
  // a partially searched depth instead of committing a biased result.
  timedOut: boolean;
  nodes: number;
  tt: Map<number, TTEntry>;
  killers: (string | null)[][]; // two quiet moves per ply that caused a cutoff
  history: Map<string, number>; // quiet moves (per side) that keep causing cutoffs, anywhere
}

interface Child {
  action: Action;
  key: string;
  next: GameState;
  capture: number; // value destroyed from the opponent (negative: we shot our own piece)
  order: number;
}

function outOfTime(ctx: Ctx): boolean {
  // Date.now() is cheap but not free; checking every 256 nodes is plenty.
  if ((++ctx.nodes & 255) === 0 && Date.now() > ctx.deadline) ctx.timedOut = true;
  return ctx.timedOut;
}

function children(ctx: Ctx, state: GameState, toMove: Color, ply: number, ttMove: string | null, capturesOnly = false): Child[] {
  const out: Child[] = [];
  const killers = ctx.killers[ply];
  for (const action of enumerateActions(state, toMove)) {
    const r = resolveAction(state, toMove, action);
    const hit = r.removed?.piece;
    const capture = !hit ? 0 : hit.color === toMove ? -PIECE_VALUE[hit.type] : PIECE_VALUE[hit.type];
    if (capturesOnly && capture <= 0 && r.winner !== toMove) continue;
    const key = actionKey(action);
    let order: number;
    if (key === ttMove) order = 1e9;
    else if (r.winner === toMove) order = 1e8;
    else if (capture > 0) order = 1e7 + capture;
    else if (capture < 0) order = -1e7 + capture; // friendly fire last
    else if (killers && (killers[0] === key || killers[1] === key)) order = 1e6;
    else order = ctx.history.get(toMove + key) ?? 0;
    out.push({
      action,
      key,
      capture,
      order,
      next: {
        ...state,
        board: r.board,
        turn: r.turn,
        winner: r.winner,
        draw: r.draw,
        quietPlies: r.quietPlies,
        moveCount: state.moveCount + 1,
      },
    });
  }
  return out.sort((a, b) => b.order - a.order);
}

function terminalScore(ctx: Ctx, state: GameState, ply: number): number | null {
  if (state.winner) return state.winner === ctx.root ? MATE - ply : -(MATE - ply);
  if (state.draw) return 0;
  return null;
}

// Mate scores are stored relative to the node, not the root, so a TT hit at a
// different ply still reports the right distance to mate.
const toTT = (score: number, ply: number) => (score >= MATE_BOUND ? score + ply : score <= -MATE_BOUND ? score - ply : score);
const fromTT = (score: number, ply: number) => (score >= MATE_BOUND ? score - ply : score <= -MATE_BOUND ? score + ply : score);

// Past the nominal depth: the side to move may "stand pat" on the static
// evaluation or try a laser capture, so a leaf is never scored in the middle of
// an exchange (or one move before its own pharaoh is shot).
function quiesce(ctx: Ctx, state: GameState, toMove: Color, ply: number, alpha: number, beta: number, qPly: number): number {
  const terminal = terminalScore(ctx, state, ply);
  if (terminal != null) return terminal;
  const standPat = evaluate(state, ctx.root, ctx.weights);
  if (qPly >= MAX_QUIESCENCE_PLIES || outOfTime(ctx)) return standPat;

  const maximizing = toMove === ctx.root;
  let best = standPat;
  if (maximizing) {
    if (best >= beta) return best;
    alpha = Math.max(alpha, best);
  } else {
    if (best <= alpha) return best;
    beta = Math.min(beta, best);
  }

  for (const child of children(ctx, state, toMove, ply, null, true)) {
    const score = quiesce(ctx, child.next, opposite(toMove), ply + 1, alpha, beta, qPly + 1);
    if (ctx.timedOut) return best;
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

const LMR_MIN_DEPTH = 3;
const LMR_FULL_MOVES = 4; // this many moves are always searched at full depth
// Null-move pruning was tried and lost clearly in self-play: in laser chess an
// unanswered laser threat is exactly what "passing" hides.
//
// A null window around one bound. Scores are fractional, so "one point" is
// just a small step - enough to ask "is it above/below this bound?".
const WINDOW = 0.01;

function alphaBeta(
  ctx: Ctx,
  state: GameState,
  toMove: Color,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
): number {
  const terminal = terminalScore(ctx, state, ply);
  if (terminal != null) return terminal;
  if (outOfTime(ctx)) return evaluate(state, ctx.root, ctx.weights);
  if (depth <= 0) {
    return ctx.quiescence ? quiesce(ctx, state, toMove, ply, alpha, beta, 0) : evaluate(state, ctx.root, ctx.weights);
  }

  const hash = hashPosition(state.board, toMove);
  const entry = ctx.tt.get(hash);
  if (entry && entry.depth >= depth) {
    const score = fromTT(entry.score, ply);
    if (entry.flag === EXACT) return score;
    if (entry.flag === LOWER && score >= beta) return score;
    if (entry.flag === UPPER && score <= alpha) return score;
  }

  const maximizing = toMove === ctx.root;

  const kids = children(ctx, state, toMove, ply, entry?.move ?? null);
  if (kids.length === 0) return 0; // no legal action: stalemate

  const alphaIn = alpha,
    betaIn = beta;
  let best = maximizing ? -Infinity : Infinity;
  let bestMove: string | null = null;

  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    let score: number;
    const reduce = ctx.lmr && depth >= LMR_MIN_DEPTH && i >= LMR_FULL_MOVES && child.capture === 0 && child.order < 1e6;
    if (reduce) {
      // Only ask whether the move beats the current best, one ply shallower.
      score = maximizing
        ? alphaBeta(ctx, child.next, opposite(toMove), depth - 2, ply + 1, alpha, Number.isFinite(alpha) ? alpha + WINDOW : beta)
        : alphaBeta(ctx, child.next, opposite(toMove), depth - 2, ply + 1, Number.isFinite(beta) ? beta - WINDOW : alpha, beta);
      const promising = maximizing ? score > alpha : score < beta;
      if (promising && !ctx.timedOut) score = alphaBeta(ctx, child.next, opposite(toMove), depth - 1, ply + 1, alpha, beta);
    } else {
      score = alphaBeta(ctx, child.next, opposite(toMove), depth - 1, ply + 1, alpha, beta);
    }
    if (ctx.timedOut) return best === Infinity || best === -Infinity ? score : best;
    if (maximizing ? score > best : score < best) {
      best = score;
      bestMove = child.key;
    }
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (alpha >= beta) {
      if (child.capture === 0) {
        const k = (ctx.killers[ply] ??= [null, null]);
        if (k[0] !== child.key) {
          k[1] = k[0];
          k[0] = child.key;
        }
        const h = toMove + child.key;
        ctx.history.set(h, (ctx.history.get(h) ?? 0) + depth * depth);
      }
      break;
    }
  }

  if (ctx.tt.size >= MAX_TT_ENTRIES) ctx.tt.clear();
  ctx.tt.set(hash, {
    depth,
    score: toTT(best, ply),
    flag: best <= alphaIn ? UPPER : best >= betaIn ? LOWER : EXACT,
    move: bestMove,
  });
  return best;
}

function jitter(noise: number): number {
  return noise ? (Math.random() * 2 - 1) * noise : 0;
}

// Iterative deepening: search depth 1, 2, 3, ... committing each depth's
// result only if that whole depth finished before `deadline` - a partially
// searched depth's root scores aren't comparable (some branches got a
// shallower look than others), so a partial depth is discarded, not
// committed. Each finished depth leaves its best line in the transposition
// table, which is searched first on the next pass - that ordering is what
// makes the deeper passes affordable.
//
// `maxDepth` optionally caps how deep iterative deepening goes, independent
// of the time budget - used to give difficulty tiers a real, hardware-
// independent depth ceiling (see bot.ts) since depth cost grows so fast
// per ply that the time budget alone barely separates the tiers.
export function search(
  state: GameState,
  color: Color,
  deadline: number,
  noise = 0,
  maxDepth = Infinity,
  weights: Weights = DEFAULT_WEIGHTS,
  options: SearchOptions = {},
): SearchResult {
  const ctx: Ctx = {
    root: color,
    deadline,
    weights,
    quiescence: !!options.quiescence,
    lmr: !!options.lmr,
    timedOut: false,
    nodes: 0,
    tt: new Map(),
    killers: [],
    history: new Map(),
  };
  let rootKids = children(ctx, state, color, 0, null);
  if (rootKids.length === 0) throw new Error('no legal actions for bot');

  let best: Action = rootKids[0].action;
  let bestScore = -Infinity;
  let depthReached = 0;

  for (let depth = 1; depth <= maxDepth && Date.now() < deadline; depth++) {
    let alpha = -Infinity;
    let bestThisDepth = rootKids[0];
    const scores = new Map<Child, number>();

    for (const child of rootKids) {
      // With noise every root move needs its true score for the jitter to be
      // fair, so only a noiseless search narrows the window at the root.
      const score = alphaBeta(ctx, child.next, opposite(color), depth - 1, 1, noise ? -Infinity : alpha, Infinity);
      if (ctx.timedOut) break;
      // Noise is applied once per root candidate, not per leaf - jittering
      // leaves and taking the max/min over many noisy samples systematically
      // inflates scores instead of just weakening play. Forced results are
      // never jittered, so even the easy bot takes a win in one.
      const noisy = isMateScore(score) ? score : score + jitter(noise);
      scores.set(child, noisy);
      if (noisy > alpha) {
        alpha = noisy;
        bestThisDepth = child;
      }
    }

    if (ctx.timedOut) break;
    best = bestThisDepth.action;
    bestScore = alpha;
    depthReached = depth;
    if (alpha >= MATE_BOUND) break; // forced win found - searching deeper can't improve on it
    // Search the next depth's root moves best-first.
    rootKids = [...rootKids].sort((a, b) => (scores.get(b) ?? -Infinity) - (scores.get(a) ?? -Infinity));
  }

  return { action: best, depthReached, score: bestScore };
}
