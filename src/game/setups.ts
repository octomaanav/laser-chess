// Starting positions as data (SetupDef = a list of placed pieces, both colours).
// The four built-in defaults are defined from Red's half (rows 0-3) and mirrored
// 180° into Silver so they're perfectly fair. The admin editor can override any
// of these or add new ones (see server/setupStore.ts) with full manual control.
//
// This module is isomorphic (no fs) - imported by the browser and the server.
import { COLS, ROWS, fireLaser, inBounds } from './engine';
import type { Board, Color, EditablePiece, GameState, PieceType, SetupDef } from './types';

interface RP {
  x: number;
  y: number;
  type: PieceType;
  orient: number;
}
const p = (x: number, y: number, type: PieceType, orient = 0): RP => ({ x, y, type, orient });

// Orientation reference (pyramid): 0 reflects S→E & W→N (faces NE), 1 faces SE,
// 2 faces SW, 3 faces NW. The red Sphinx sits at (0,0) firing South. Each setup
// is designed so the opening laser destroys nothing (verified by validateSetup).
const RED_TEMPLATES: Record<string, RP[]> = {
  Classic: [
    p(0, 0, 'sphinx', 2),
    p(4, 0, 'anubis', 2), p(5, 0, 'pharaoh'), p(6, 0, 'anubis', 2),
    p(0, 3, 'pyramid', 3),
    p(2, 1, 'pyramid', 1), p(7, 1, 'pyramid', 3),
    p(3, 2, 'pyramid', 0), p(6, 2, 'pyramid', 2),
    p(2, 3, 'pyramid', 1), p(7, 3, 'pyramid', 2),
    p(4, 3, 'scarab', 0), p(5, 3, 'scarab', 1),
  ],
  Imhotep: [
    p(0, 0, 'sphinx', 2),
    p(1, 0, 'anubis', 2), p(2, 0, 'pharaoh'), p(3, 0, 'anubis', 2),
    p(5, 0, 'pyramid', 2),
    p(6, 1, 'pyramid', 3), p(8, 1, 'pyramid', 1),
    p(4, 2, 'pyramid', 0), p(7, 2, 'pyramid', 3),
    p(1, 3, 'pyramid', 1), p(8, 3, 'pyramid', 2),
    p(5, 3, 'scarab', 0), p(6, 3, 'scarab', 1),
  ],
  Dynasty: [
    p(0, 0, 'sphinx', 2),
    p(6, 0, 'anubis', 2), p(7, 0, 'pharaoh'), p(8, 0, 'anubis', 2),
    p(0, 2, 'pyramid', 3),
    p(2, 0, 'pyramid', 2),
    p(4, 1, 'pyramid', 1), p(5, 1, 'pyramid', 0),
    p(1, 3, 'pyramid', 0), p(3, 3, 'pyramid', 1), p(8, 2, 'pyramid', 3),
    p(4, 3, 'scarab', 0), p(5, 3, 'scarab', 1),
  ],
  Ambush: [
    p(0, 0, 'sphinx', 2),
    p(4, 0, 'anubis', 2), p(5, 0, 'pharaoh'), p(6, 0, 'anubis', 2),
    p(1, 1, 'pyramid', 0), p(3, 1, 'pyramid', 2), p(7, 1, 'pyramid', 2), p(8, 1, 'pyramid', 3),
    p(2, 3, 'pyramid', 0), p(6, 3, 'pyramid', 1), p(8, 3, 'pyramid', 3),
    p(4, 2, 'scarab', 1), p(5, 2, 'scarab', 0),
  ],
};

function mirrorRP(pl: RP): RP {
  return { x: COLS - 1 - pl.x, y: ROWS - 1 - pl.y, type: pl.type, orient: (pl.orient + 2) % 4 };
}
function expand(name: string, red: RP[]): SetupDef {
  const pieces: EditablePiece[] = [];
  for (const r of red) {
    pieces.push({ ...r, color: 'red' });
    const m = mirrorRP(r);
    pieces.push({ ...m, color: 'silver' });
  }
  return { name, pieces };
}

export const DEFAULT_SETUPS: SetupDef[] = Object.entries(RED_TEMPLATES).map(([n, r]) => expand(n, r));
export const SETUP_NAMES = DEFAULT_SETUPS.map((s) => s.name);

let _id = 0;
const nextId = () => `p${_id++}`;

export function buildBoardFromDef(def: SetupDef): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array<null>(COLS).fill(null));
  for (const pc of def.pieces) {
    if (inBounds(pc.x, pc.y)) board[pc.y][pc.x] = { id: nextId(), type: pc.type, color: pc.color, orient: pc.orient };
  }
  return board;
}

export function createGameFromDef(def: SetupDef): GameState {
  return { setup: def.name, board: buildBoardFromDef(def), turn: 'silver', winner: null, moveCount: 0 };
}

// Mirror a set of pieces of one colour 180° into the other colour.
export function mirrorColor(pieces: EditablePiece[], from: Color): EditablePiece[] {
  const to: Color = from === 'red' ? 'silver' : 'red';
  const kept = pieces.filter((p) => p.color !== to);
  for (const p of pieces.filter((p) => p.color === from)) {
    kept.push({ x: COLS - 1 - p.x, y: ROWS - 1 - p.y, type: p.type, color: to, orient: (p.orient + 2) % 4 });
  }
  return kept;
}

export interface SetupValidation {
  errors: string[];
  warnings: string[];
  safe: boolean;
  redHit: string | null;
  silverHit: string | null;
  counts: { red: Record<string, number>; silver: Record<string, number> };
}

export function validateSetup(def: SetupDef): SetupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const counts = { red: {} as Record<string, number>, silver: {} as Record<string, number> };
  for (const pc of def.pieces) {
    if (!inBounds(pc.x, pc.y)) errors.push(`piece off the board at ${pc.x},${pc.y}`);
    const key = `${pc.x},${pc.y}`;
    if (seen.has(key)) errors.push(`two pieces on the same square (${key})`);
    seen.add(key);
    counts[pc.color][pc.type] = (counts[pc.color][pc.type] || 0) + 1;
  }
  for (const color of ['red', 'silver'] as Color[]) {
    const disp = color === 'silver' ? 'Teal' : 'Red';
    if ((counts[color].pharaoh || 0) !== 1) warnings.push(`${disp} should have exactly 1 Pharaoh`);
    if ((counts[color].sphinx || 0) !== 1) warnings.push(`${disp} should have exactly 1 Sphinx`);
  }
  const board = buildBoardFromDef(def);
  const rl = fireLaser(board, 'red');
  const sl = fireLaser(board, 'silver');
  const hs = (h: { x: number; y: number; piece: { color: string; type: string } } | null) =>
    h ? `${h.piece.color} ${h.piece.type} @ ${h.x},${h.y}` : null;
  const safe = !rl.hit && !sl.hit;
  if (!safe) warnings.push('the opening laser destroys a piece - a player would lose material without moving');
  return { errors, warnings, safe, redHit: hs(rl.hit), silverHit: hs(sl.hit), counts };
}
