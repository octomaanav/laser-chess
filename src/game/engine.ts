// Laser Chess engine — shared by the Node server (authoritative) and the browser.
// Pure, dependency-free, so the rules can never drift between the two.
//
// Coordinate system:  board[y][x]   x = column 0..9 (left→right),  y = row 0..7 (top→bottom)
// Directions:         0=N 1=E 2=S 3=W   (index into DIRS)
// Colors:             'red' (top of board) and 'silver' (bottom)
import type { Action, Board, Color, GameState, Hit, LaserPoint, Piece } from './types';

export const COLS = 10;
export const ROWS = 8;

export const DIRS = [
  { x: 0, y: -1 }, // 0 N
  { x: 1, y: 0 }, //  1 E
  { x: 0, y: 1 }, //  2 S
  { x: -1, y: 0 }, // 3 W
];

export const opposite = (c: Color): Color => (c === 'red' ? 'silver' : 'red');

// ---- Reflection tables (keyed by the laser's *travel* direction) -----------
// Pyramid: single mirror. Maps travel-dir → new travel-dir, or undefined = destroyed.
const PYRAMID: Record<number, number>[] = [
  { 2: 1, 3: 0 }, // orient 0 : mirror "\" , reflective on N & E faces
  { 3: 2, 0: 1 }, // orient 1
  { 0: 3, 1: 2 }, // orient 2
  { 1: 0, 2: 3 }, // orient 3
];

// Scarab (Djed): double mirror, reflects from every side, never destroyed.
const SCARAB_BACK: Record<number, number> = { 0: 3, 1: 2, 2: 1, 3: 0 }; // "\"  (orient even)
const SCARAB_FWD: Record<number, number> = { 0: 1, 1: 0, 2: 3, 3: 2 }; //  "/"  (orient odd)

// Legal sphinx firing directions per corner (which two point into the board).
function sphinxLegalOrients(x: number, y: number): number[] {
  const top = y === 0,
    bottom = y === ROWS - 1,
    left = x === 0,
    right = x === COLS - 1;
  const out: number[] = [];
  if (top) out.push(2);
  if (bottom) out.push(0);
  if (left) out.push(1);
  if (right) out.push(3);
  return out.length ? out : [2, 0];
}

// ---------------------------------------------------------------------------
export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((c) => (c ? { ...c } : null)));
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

export function findSphinx(board: Board, color: Color): { x: number; y: number; piece: Piece } | null {
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const p = board[y][x];
      if (p && p.type === 'sphinx' && p.color === color) return { x, y, piece: p };
    }
  return null;
}

// ---- Laser tracing ---------------------------------------------------------
export function fireLaser(board: Board, color: Color): { path: LaserPoint[]; hit: Hit | null } {
  const s = findSphinx(board, color);
  const path: LaserPoint[] = [];
  if (!s) return { path, hit: null };
  let { x, y } = s;
  let dir = s.piece.orient;
  path.push({ x: x + 0.5, y: y + 0.5 });

  for (let steps = 0; steps < 200; steps++) {
    const nx = x + DIRS[dir].x;
    const ny = y + DIRS[dir].y;
    if (!inBounds(nx, ny)) {
      path.push({ x: nx + 0.5, y: ny + 0.5 }); // exit the board edge
      return { path, hit: null };
    }
    const p = board[ny][nx];
    if (!p) {
      x = nx;
      y = ny;
      continue;
    }

    path.push({ x: nx + 0.5, y: ny + 0.5 });

    if (p.type === 'pyramid') {
      const out = PYRAMID[p.orient][dir];
      if (out === undefined) return { path, hit: { x: nx, y: ny, piece: p } };
      dir = out;
      x = nx;
      y = ny;
      continue;
    }
    if (p.type === 'scarab') {
      dir = (p.orient % 2 === 0 ? SCARAB_BACK : SCARAB_FWD)[dir];
      x = nx;
      y = ny;
      continue;
    }
    if (p.type === 'anubis') {
      if (dir === (p.orient + 2) % 4) return { path, hit: null }; // struck on the shielded front
      return { path, hit: { x: nx, y: ny, piece: p } };
    }
    if (p.type === 'pharaoh') return { path, hit: { x: nx, y: ny, piece: p } };
    // sphinx: blocks harmlessly
    return { path, hit: null };
  }
  return { path, hit: null };
}

// ---- Move generation -------------------------------------------------------
const canSwap = (t: string) => t === 'pyramid' || t === 'anubis';

// All legal actions for the piece at (x,y). Empty list if it isn't `color`'s piece.
export function legalActionsFor(board: Board, color: Color, x: number, y: number): Action[] {
  const p = board[y][x];
  const actions: Action[] = [];
  if (!p || p.color !== color) return actions;

  if (p.type === 'sphinx') {
    const orients = sphinxLegalOrients(x, y).filter((o) => o !== p.orient);
    for (const o of orients) actions.push({ type: 'rotate', x, y, orient: o });
    return actions;
  }

  // 8-directional single-step moves (and scarab swaps).
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const tx = x + dx,
        ty = y + dy;
      if (!inBounds(tx, ty)) continue;
      // End columns are colour-restricted: col 0 = red only, col COLS-1 = silver only.
      if (tx === 0 && color !== 'red') continue;
      if (tx === COLS - 1 && color !== 'silver') continue;
      const target = board[ty][tx];
      if (!target) actions.push({ type: 'move', x, y, tx, ty });
      else if (p.type === 'scarab' && canSwap(target.type)) actions.push({ type: 'move', x, y, tx, ty, swap: true });
    }

  // Rotations (both directions). Pharaoh has no orientation, so skip it.
  if (p.type !== 'pharaoh') {
    actions.push({ type: 'rotate', x, y, orient: (p.orient + 1) % 4, spin: 1 });
    actions.push({ type: 'rotate', x, y, orient: (p.orient + 3) % 4, spin: -1 });
  }
  return actions;
}

function actionAllowed(board: Board, color: Color, action: Action): boolean {
  const list = legalActionsFor(board, color, action.x, action.y);
  return list.some((a) => {
    if (a.type !== action.type) return false;
    if (a.type === 'move' && action.type === 'move') return a.tx === action.tx && a.ty === action.ty;
    if (a.type === 'rotate' && action.type === 'rotate') return a.orient === action.orient;
    return false;
  });
}

// Apply the move/rotate only (no laser). Returns a fresh board.
export function applyMoveOnly(board: Board, action: Action): Board {
  const b = cloneBoard(board);
  const p = b[action.y][action.x];
  if (!p) return b;
  if (action.type === 'rotate') {
    p.orient = action.orient;
  } else {
    const target = b[action.ty][action.tx];
    b[action.ty][action.tx] = p;
    b[action.y][action.x] = target || null; // swap leaves the other piece behind
  }
  return b;
}

// Full authoritative turn: validate → move → fire laser → remove → detect win.
export function applyAction(state: GameState, color: Color, action: Action) {
  if (state.winner) return { ok: false as const, error: 'game-over' };
  if (state.turn !== color) return { ok: false as const, error: 'not-your-turn' };
  if (!actionAllowed(state.board, color, action)) return { ok: false as const, error: 'illegal' };

  const preLaser = applyMoveOnly(state.board, action);
  const { path, hit } = fireLaser(preLaser, color);

  let removed: Hit | null = null;
  const resolved = cloneBoard(preLaser);
  if (hit) {
    removed = { x: hit.x, y: hit.y, piece: hit.piece };
    resolved[hit.y][hit.x] = null;
  }

  let winner: Color | null = null;
  if (hit && hit.piece.type === 'pharaoh') winner = opposite(hit.piece.color);

  return {
    ok: true as const,
    board: resolved,
    laser: path,
    removed,
    winner,
    turn: winner ? state.turn : opposite(color),
  };
}
