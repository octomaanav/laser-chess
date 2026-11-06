// src/game/engine.test.ts
import { describe, expect, it } from 'vitest';
import {
  COLS,
  DIRS,
  ROWS,
  applyAction,
  applyMoveOnly,
  cloneBoard,
  findSphinx,
  fireLaser,
  inBounds,
  isGameOver,
  legalActionsFor,
  FIFTY_MOVE_PLIES,
  opposite,
} from './engine';
import type { Action, Board, Cell, Color, GameState, LaserPoint, Piece, PieceType } from './types';

// ---- helpers ---------------------------------------------------------------
const DIR_NAMES = ['N', 'E', 'S', 'W'];

const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));

function put(board: Board, x: number, y: number, type: PieceType, color: Color, orient = 0): Piece {
  const piece: Piece = { id: `${color}-${type}-${x}-${y}`, type, color, orient };
  board[y][x] = piece;
  return piece;
}

const stateOf = (board: Board, turn: Color = 'red'): GameState => ({
  setup: 'test',
  board,
  turn,
  winner: null,
  moveCount: 0,
});

// Applies an action that must succeed; narrows the result type for the caller.
function applyOk(state: GameState, color: Color, action: Action) {
  const r = applyAction(state, color, action);
  if (!r.ok) throw new Error(`expected action to be accepted, got "${r.error}"`);
  return r;
}

// Centre of a cell, as the laser path reports it.
const center = (x: number, y: number): LaserPoint => ({ x: x + 0.5, y: y + 0.5 });

// "x,y" strings of every cell a piece can move or swap to.
const targets = (actions: Action[]) =>
  actions.flatMap((a) => (a.type === 'move' ? [`${a.tx},${a.ty}`] : [])).sort();

// Red sphinx top-left firing east along row 0, silver sphinx bottom-right firing west along row 7.
function duel(): Board {
  const b = emptyBoard();
  put(b, 0, 0, 'sphinx', 'red', 1);
  put(b, 9, 7, 'sphinx', 'silver', 3);
  return b;
}

// ---- basic helpers ---------------------------------------------------------
describe('board helpers', () => {
  it('has a 10x8 board', () => {
    expect(COLS).toBe(10);
    expect(ROWS).toBe(8);
  });

  it('inBounds accepts exactly x 0..9 and y 0..7', () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(9, 7)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(0, -1)).toBe(false);
    expect(inBounds(10, 0)).toBe(false);
    expect(inBounds(0, 8)).toBe(false);
  });

  it('opposite flips the colour', () => {
    expect(opposite('red')).toBe('silver');
    expect(opposite('silver')).toBe('red');
  });

  it('cloneBoard is a deep copy', () => {
    const b = emptyBoard();
    put(b, 3, 3, 'pyramid', 'red', 1);
    const c = cloneBoard(b);
    expect(c).toEqual(b);
    c[3][3]!.orient = 2;
    c[0][0] = { id: 'x', type: 'scarab', color: 'red', orient: 0 };
    expect(b[3][3]!.orient).toBe(1);
    expect(b[0][0]).toBeNull();
  });

  it('findSphinx locates the sphinx of the requested colour only', () => {
    const b = duel();
    expect(findSphinx(b, 'red')).toMatchObject({ x: 0, y: 0 });
    expect(findSphinx(b, 'silver')).toMatchObject({ x: 9, y: 7 });
    expect(findSphinx(emptyBoard(), 'red')).toBeNull();
  });
});

// ---- move generation -------------------------------------------------------
describe('legalActionsFor - movement', () => {
  it('returns nothing for an empty cell or an opponent piece', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'pyramid', 'silver');
    expect(legalActionsFor(b, 'red', 2, 2)).toEqual([]);
    expect(legalActionsFor(b, 'red', 5, 4)).toEqual([]);
  });

  it('lets a pyramid step to all 8 neighbours and rotate both ways', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'pyramid', 'red', 2);
    const actions = legalActionsFor(b, 'red', 5, 4);
    expect(targets(actions)).toEqual(['4,3', '4,4', '4,5', '5,3', '5,5', '6,3', '6,4', '6,5']);
    expect(actions).toContainEqual({ type: 'rotate', x: 5, y: 4, orient: 3, spin: 1 });
    expect(actions).toContainEqual({ type: 'rotate', x: 5, y: 4, orient: 1, spin: -1 });
    expect(actions).toHaveLength(10);
  });

  it('wraps rotation around N/W', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'anubis', 'red', 3);
    const rotates = legalActionsFor(b, 'red', 5, 4).filter((a) => a.type === 'rotate');
    expect(rotates.map((a) => (a.type === 'rotate' ? a.orient : -1)).sort()).toEqual([0, 2]);
  });

  it('gives a pharaoh moves but no rotation', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'pharaoh', 'red');
    const actions = legalActionsFor(b, 'red', 5, 4);
    expect(actions).toHaveLength(8);
    expect(actions.every((a) => a.type === 'move')).toBe(true);
  });

  it('clips moves at the board edge', () => {
    const b = emptyBoard();
    put(b, 0, 0, 'pharaoh', 'red');
    expect(targets(legalActionsFor(b, 'red', 0, 0))).toEqual(['0,1', '1,0', '1,1']);
  });

  it('does not allow moving onto an occupied cell without swapping', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'pyramid', 'red');
    put(b, 6, 4, 'pyramid', 'red');
    put(b, 5, 3, 'anubis', 'silver');
    const t = targets(legalActionsFor(b, 'red', 5, 4));
    expect(t).not.toContain('6,4');
    expect(t).not.toContain('5,3');
    expect(t).toHaveLength(6);
  });

  it('keeps column 0 red-only', () => {
    const red = emptyBoard();
    put(red, 1, 3, 'pyramid', 'red');
    expect(targets(legalActionsFor(red, 'red', 1, 3))).toEqual(
      expect.arrayContaining(['0,2', '0,3', '0,4']),
    );

    const silver = emptyBoard();
    put(silver, 1, 3, 'pyramid', 'silver');
    const t = targets(legalActionsFor(silver, 'silver', 1, 3));
    expect(t.some((s) => s.startsWith('0,'))).toBe(false);
    expect(t).toHaveLength(5);
  });

  it('keeps the last column silver-only', () => {
    const silver = emptyBoard();
    put(silver, 8, 3, 'pyramid', 'silver');
    expect(targets(legalActionsFor(silver, 'silver', 8, 3))).toEqual(
      expect.arrayContaining(['9,2', '9,3', '9,4']),
    );

    const red = emptyBoard();
    put(red, 8, 3, 'pyramid', 'red');
    const t = targets(legalActionsFor(red, 'red', 8, 3));
    expect(t.some((s) => s.startsWith('9,'))).toBe(false);
    expect(t).toHaveLength(5);
  });
});

describe('legalActionsFor - scarab swaps', () => {
  it('lets a scarab swap with pyramids and anubis of either colour, flagged swap:true', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'scarab', 'silver');
    put(b, 6, 4, 'pyramid', 'red');
    put(b, 4, 4, 'anubis', 'silver');
    const actions = legalActionsFor(b, 'silver', 5, 4);
    expect(actions).toContainEqual({ type: 'move', x: 5, y: 4, tx: 6, ty: 4, swap: true });
    expect(actions).toContainEqual({ type: 'move', x: 5, y: 4, tx: 4, ty: 4, swap: true });
  });

  it('cannot swap with pharaoh, scarab or sphinx', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'scarab', 'silver');
    put(b, 5, 3, 'pharaoh', 'silver');
    put(b, 5, 5, 'scarab', 'red');
    put(b, 6, 5, 'sphinx', 'red');
    const t = targets(legalActionsFor(b, 'silver', 5, 4));
    expect(t).not.toContain('5,3');
    expect(t).not.toContain('5,5');
    expect(t).not.toContain('6,5');
  });

  it('non-scarab pieces never get swap moves', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'anubis', 'red');
    put(b, 6, 4, 'pyramid', 'red');
    expect(legalActionsFor(b, 'red', 5, 4).some((a) => a.type === 'move' && a.swap)).toBe(false);
  });

  it('still respects the colour-restricted end columns when swapping', () => {
    const left = emptyBoard();
    put(left, 1, 3, 'scarab', 'silver');
    put(left, 0, 3, 'pyramid', 'red');
    expect(targets(legalActionsFor(left, 'silver', 1, 3))).not.toContain('0,3');

    const right = emptyBoard();
    put(right, 8, 3, 'scarab', 'red');
    put(right, 9, 3, 'pyramid', 'silver');
    expect(targets(legalActionsFor(right, 'red', 8, 3))).not.toContain('9,3');
  });

  it('can still rotate', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'scarab', 'red', 0);
    const rotates = legalActionsFor(b, 'red', 5, 4).filter((a) => a.type === 'rotate');
    expect(rotates).toHaveLength(2);
  });
});

describe('legalActionsFor - sphinx', () => {
  it('can only rotate, and only toward directions that point into the board', () => {
    const b = emptyBoard();
    put(b, 0, 0, 'sphinx', 'red', 2); // top-left corner: S or E
    expect(legalActionsFor(b, 'red', 0, 0)).toEqual([{ type: 'rotate', x: 0, y: 0, orient: 1 }]);

    const c = emptyBoard();
    put(c, 9, 7, 'sphinx', 'silver', 0); // bottom-right corner: N or W
    expect(legalActionsFor(c, 'silver', 9, 7)).toEqual([{ type: 'rotate', x: 9, y: 7, orient: 3 }]);
  });

  it('has no actions on an edge cell when already pointing the only legal way', () => {
    const b = emptyBoard();
    put(b, 5, 7, 'sphinx', 'silver', 0); // bottom edge: only N
    expect(legalActionsFor(b, 'silver', 5, 7)).toEqual([]);
  });
});

// ---- applyMoveOnly ---------------------------------------------------------
describe('applyMoveOnly', () => {
  it('moves a piece to an empty cell', () => {
    const b = emptyBoard();
    const p = put(b, 5, 4, 'pyramid', 'red');
    const next = applyMoveOnly(b, { type: 'move', x: 5, y: 4, tx: 6, ty: 3 });
    expect(next[4][5]).toBeNull();
    expect(next[3][6]).toEqual(p);
  });

  it('swaps both pieces on a swap move', () => {
    const b = emptyBoard();
    const s = put(b, 5, 4, 'scarab', 'red');
    const p = put(b, 6, 4, 'pyramid', 'silver');
    const next = applyMoveOnly(b, { type: 'move', x: 5, y: 4, tx: 6, ty: 4, swap: true });
    expect(next[4][6]).toEqual(s);
    expect(next[4][5]).toEqual(p);
  });

  it('rotates a piece in place', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'pyramid', 'red', 0);
    const next = applyMoveOnly(b, { type: 'rotate', x: 5, y: 4, orient: 3, spin: -1 });
    expect(next[4][5]!.orient).toBe(3);
  });

  it('does not mutate the input board', () => {
    const b = emptyBoard();
    put(b, 5, 4, 'pyramid', 'red', 0);
    const snapshot = JSON.stringify(b);
    applyMoveOnly(b, { type: 'move', x: 5, y: 4, tx: 6, ty: 4 });
    applyMoveOnly(b, { type: 'rotate', x: 5, y: 4, orient: 1, spin: 1 });
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  it('is a no-op when the source cell is empty', () => {
    const b = emptyBoard();
    put(b, 1, 1, 'pyramid', 'red');
    const next = applyMoveOnly(b, { type: 'move', x: 5, y: 4, tx: 6, ty: 4 });
    expect(next).toEqual(b);
    expect(next).not.toBe(b);
  });
});

// ---- laser tracing ---------------------------------------------------------
describe('fireLaser - basics', () => {
  it('returns an empty path and no hit when the colour has no sphinx', () => {
    expect(fireLaser(emptyBoard(), 'red')).toEqual({ path: [], hit: null });
  });

  it('runs across an empty board and records the cell just past the edge', () => {
    const east = duel();
    expect(fireLaser(east, 'red')).toEqual({ path: [center(0, 0), { x: 10.5, y: 0.5 }], hit: null });

    const south = emptyBoard();
    put(south, 0, 0, 'sphinx', 'red', 2);
    expect(fireLaser(south, 'red')).toEqual({ path: [center(0, 0), { x: 0.5, y: 8.5 }], hit: null });
  });

  it('fires the sphinx of the requested colour', () => {
    const b = duel();
    expect(fireLaser(b, 'silver')).toEqual({ path: [center(9, 7), { x: -0.5, y: 7.5 }], hit: null });
  });

  it('only records cells where something is struck, not every empty cell passed', () => {
    const b = duel();
    put(b, 4, 0, 'pharaoh', 'silver');
    const { path } = fireLaser(b, 'red');
    expect(path).toEqual([center(0, 0), center(4, 0)]);
  });

  it('is blocked harmlessly by the opposing sphinx', () => {
    const b = emptyBoard();
    put(b, 0, 7, 'sphinx', 'red', 0);
    put(b, 0, 0, 'sphinx', 'silver', 2);
    expect(fireLaser(b, 'red')).toEqual({ path: [center(0, 7), center(0, 0)], hit: null });
  });
});

// Beam travelling `dir` hits a piece two cells away from a red sphinx; no other pieces on board.
const TARGET = { x: 5, y: 4 };
const EXIT_FROM_TARGET: Record<number, LaserPoint> = {
  0: { x: 5.5, y: -0.5 },
  1: { x: 10.5, y: 4.5 },
  2: { x: 5.5, y: 8.5 },
  3: { x: -0.5, y: 4.5 },
};
function beamInto(dir: number, type: PieceType, orient: number) {
  const board = emptyBoard();
  const sx = TARGET.x - 2 * DIRS[dir].x;
  const sy = TARGET.y - 2 * DIRS[dir].y;
  put(board, sx, sy, 'sphinx', 'red', dir);
  const piece = put(board, TARGET.x, TARGET.y, type, 'silver', orient);
  return { piece, start: center(sx, sy), ...fireLaser(board, 'red') };
}

// Pyramid orient 0 is a "\" mirror reflective on its N and E faces: a beam travelling S (it
// enters the N face) leaves E, a beam travelling W (it enters the E face) leaves N. Every other
// direction destroys it. Higher orientations are the same mirror turned clockwise by 90° each.
const PYRAMID_ORIENT0: Record<number, number> = { 2: 1, 3: 0 };
function expectedPyramidOut(orient: number, dir: number): number | undefined {
  const base = PYRAMID_ORIENT0[(dir + 4 - orient) % 4];
  return base === undefined ? undefined : (base + orient) % 4;
}

describe('fireLaser - pyramid', () => {
  for (let orient = 0; orient < 4; orient++) {
    for (let dir = 0; dir < 4; dir++) {
      const out = expectedPyramidOut(orient, dir);
      if (out === undefined) {
        it(`orient ${orient} is destroyed by a beam travelling ${DIR_NAMES[dir]}`, () => {
          const { piece, start, path, hit } = beamInto(dir, 'pyramid', orient);
          expect(hit).toEqual({ x: TARGET.x, y: TARGET.y, piece });
          expect(path).toEqual([start, center(TARGET.x, TARGET.y)]);
        });
      } else {
        it(`orient ${orient} turns a beam travelling ${DIR_NAMES[dir]} to ${DIR_NAMES[out]}`, () => {
          const { start, path, hit } = beamInto(dir, 'pyramid', orient);
          expect(hit).toBeNull();
          expect(path).toEqual([start, center(TARGET.x, TARGET.y), EXIT_FROM_TARGET[out]]);
        });
      }
    }
  }
});

// Scarab is a double-sided mirror: even orientations are "\" (N->W, E->S, S->E, W->N), odd are
// "/" (N->E, E->N, S->W, W->S). It reflects from every side and is never destroyed.
const SCARAB_BACKSLASH: Record<number, number> = { 0: 3, 1: 2, 2: 1, 3: 0 };
const SCARAB_SLASH: Record<number, number> = { 0: 1, 1: 0, 2: 3, 3: 2 };

describe('fireLaser - scarab', () => {
  for (let orient = 0; orient < 4; orient++) {
    for (let dir = 0; dir < 4; dir++) {
      const out = (orient % 2 === 0 ? SCARAB_BACKSLASH : SCARAB_SLASH)[dir];
      it(`orient ${orient} reflects a beam travelling ${DIR_NAMES[dir]} to ${DIR_NAMES[out]} without being hit`, () => {
        const { start, path, hit } = beamInto(dir, 'scarab', orient);
        expect(hit).toBeNull();
        expect(path).toEqual([start, center(TARGET.x, TARGET.y), EXIT_FROM_TARGET[out]]);
      });
    }
  }
});

// Anubis shields the face it points at (its orient): a beam travelling the opposite way strikes
// that face and stops. Every other side is vulnerable.
describe('fireLaser - anubis', () => {
  for (let orient = 0; orient < 4; orient++) {
    for (let dir = 0; dir < 4; dir++) {
      const shielded = dir === (orient + 2) % 4;
      it(`orient ${orient} ${shielded ? 'survives' : 'is destroyed by'} a beam travelling ${DIR_NAMES[dir]}`, () => {
        const { piece, start, path, hit } = beamInto(dir, 'anubis', orient);
        expect(path).toEqual([start, center(TARGET.x, TARGET.y)]);
        expect(hit).toEqual(shielded ? null : { x: TARGET.x, y: TARGET.y, piece });
      });
    }
  }
});

describe('fireLaser - pharaoh and chains', () => {
  it('hits a pharaoh from any direction', () => {
    for (let dir = 0; dir < 4; dir++) {
      const { piece, hit } = beamInto(dir, 'pharaoh', 0);
      expect(hit).toEqual({ x: TARGET.x, y: TARGET.y, piece });
    }
  });

  it('follows several bounces and reports the final hit', () => {
    const b = duel();
    put(b, 4, 0, 'pyramid', 'red', 2); // E -> S
    put(b, 4, 3, 'scarab', 'silver', 1); // "/" : S -> W
    const pharaoh = put(b, 1, 3, 'pharaoh', 'silver');
    const { path, hit } = fireLaser(b, 'red');
    expect(path).toEqual([center(0, 0), center(4, 0), center(4, 3), center(1, 3)]);
    expect(hit).toEqual({ x: 1, y: 3, piece: pharaoh });
  });

  it('does not mutate the board, even when it strikes a piece', () => {
    const b = duel();
    put(b, 4, 0, 'pyramid', 'silver', 0);
    const snapshot = JSON.stringify(b);
    const { hit } = fireLaser(b, 'red');
    expect(hit).not.toBeNull();
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  it('exits a different way when the scarab in the chain has the other orientation', () => {
    const b = duel();
    put(b, 4, 0, 'pyramid', 'red', 2); // E -> S
    put(b, 4, 3, 'scarab', 'silver', 0); // "\" : S -> E, so the beam misses the pharaoh
    put(b, 1, 3, 'pharaoh', 'silver');
    const { path, hit } = fireLaser(b, 'red');
    expect(hit).toBeNull();
    expect(path).toEqual([center(0, 0), center(4, 0), center(4, 3), { x: 10.5, y: 3.5 }]);
  });
});

// ---- applyAction -----------------------------------------------------------
describe('applyAction - validation', () => {
  const setup = (): Board => {
    const b = duel();
    put(b, 5, 5, 'pyramid', 'red', 0);
    put(b, 6, 5, 'anubis', 'red', 0);
    put(b, 5, 4, 'pharaoh', 'red');
    put(b, 5, 2, 'pyramid', 'silver', 0);
    put(b, 8, 3, 'pyramid', 'red', 0);
    put(b, 2, 7, 'pyramid', 'red', 0);
    return b;
  };

  const illegal: [string, Action][] = [
    ["moving the opponent's piece", { type: 'move', x: 5, y: 2, tx: 5, ty: 3 }],
    ['moving from an empty cell', { type: 'move', x: 2, y: 2, tx: 2, ty: 3 }],
    ['moving two cells', { type: 'move', x: 5, y: 5, tx: 5, ty: 7 }],
    ['moving onto an occupied cell', { type: 'move', x: 5, y: 5, tx: 6, ty: 5 }],
    ['moving off the board', { type: 'move', x: 2, y: 7, tx: 2, ty: 8 }],
    ["moving into the silver-only column", { type: 'move', x: 8, y: 3, tx: 9, ty: 3 }],
    ['rotating 180 degrees', { type: 'rotate', x: 5, y: 5, orient: 2 }],
    ['rotating to the current orientation', { type: 'rotate', x: 5, y: 5, orient: 0 }],
    ['rotating a pharaoh', { type: 'rotate', x: 5, y: 4, orient: 1 }],
    ['moving a sphinx', { type: 'move', x: 0, y: 0, tx: 1, ty: 0 }],
    ['pointing the sphinx out of the board', { type: 'rotate', x: 0, y: 0, orient: 0 }],
  ];

  it.each(illegal)('rejects %s', (_label, action) => {
    expect(applyAction(stateOf(setup()), 'red', action)).toEqual({ ok: false, error: 'illegal' });
  });

  it('rejects an action from the colour whose turn it is not', () => {
    const state = stateOf(setup(), 'red');
    expect(applyAction(state, 'silver', { type: 'rotate', x: 5, y: 2, orient: 1, spin: 1 })).toEqual({
      ok: false,
      error: 'not-your-turn',
    });
  });

  it('checks the turn before legality', () => {
    // Silver acts on red's turn with an action that is also illegal (red's piece, not silver's).
    const state = stateOf(setup(), 'red');
    expect(applyAction(state, 'silver', { type: 'move', x: 5, y: 5, tx: 5, ty: 6 })).toEqual({
      ok: false,
      error: 'not-your-turn',
    });
  });

  it('rejects everything once there is a winner, even out of turn', () => {
    const state: GameState = { ...stateOf(setup(), 'red'), winner: 'red' };
    const action: Action = { type: 'rotate', x: 5, y: 5, orient: 1, spin: 1 };
    expect(applyAction(state, 'red', action)).toEqual({ ok: false, error: 'game-over' });
    expect(applyAction(state, 'silver', action)).toEqual({ ok: false, error: 'game-over' });
  });

  it('does not modify the state it was given', () => {
    const state = stateOf(setup());
    const snapshot = JSON.stringify(state);
    applyAction(state, 'red', { type: 'rotate', x: 5, y: 5, orient: 1, spin: 1 });
    applyAction(state, 'red', { type: 'move', x: 5, y: 5, tx: 6, ty: 6 });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('applyAction - a normal turn', () => {
  it('applies a rotation, fires the mover\'s laser and passes the turn', () => {
    const b = duel();
    put(b, 5, 5, 'pyramid', 'red', 0);
    const res = applyOk(stateOf(b, 'red'), 'red', { type: 'rotate', x: 5, y: 5, orient: 1, spin: 1 });
    expect(res.board[5][5]!.orient).toBe(1);
    expect(res.laser).toEqual([center(0, 0), { x: 10.5, y: 0.5 }]);
    expect(res.removed).toBeNull();
    expect(res.winner).toBeNull();
    expect(res.turn).toBe('silver');
  });

  it('fires silver\'s laser when silver moves', () => {
    const b = duel();
    put(b, 5, 2, 'pyramid', 'silver', 0);
    const res = applyOk(stateOf(b, 'silver'), 'silver', { type: 'move', x: 5, y: 2, tx: 5, ty: 3 });
    expect(res.board[3][5]).toMatchObject({ type: 'pyramid', color: 'silver' });
    expect(res.board[2][5]).toBeNull();
    expect(res.laser).toEqual([center(9, 7), { x: -0.5, y: 7.5 }]);
    expect(res.turn).toBe('red');
  });

  it('applies a scarab swap', () => {
    const b = duel();
    put(b, 5, 4, 'scarab', 'red');
    put(b, 6, 4, 'pyramid', 'silver');
    const res = applyOk(stateOf(b, 'red'), 'red', { type: 'move', x: 5, y: 4, tx: 6, ty: 4, swap: true });
    expect(res.board[4][6]).toMatchObject({ type: 'scarab' });
    expect(res.board[4][5]).toMatchObject({ type: 'pyramid' });
  });

  it('applies the move before tracing the laser', () => {
    const b = duel();
    put(b, 3, 1, 'scarab', 'red', 0);
    // Stepping up into the beam row turns it south down column 3. Without the move it would
    // run straight off the east edge.
    const res = applyOk(stateOf(b, 'red'), 'red', { type: 'move', x: 3, y: 1, tx: 3, ty: 0 });
    expect(res.laser).toEqual([center(0, 0), center(3, 0), { x: 3.5, y: 8.5 }]);
    expect(res.removed).toBeNull();
  });

  it('applies a sphinx rotation before firing', () => {
    const b = emptyBoard();
    put(b, 0, 0, 'sphinx', 'red', 2);
    const res = applyOk(stateOf(b, 'red'), 'red', { type: 'rotate', x: 0, y: 0, orient: 1 });
    expect(res.laser).toEqual([center(0, 0), { x: 10.5, y: 0.5 }]);
  });
});

describe('applyAction - captures', () => {
  // A harmless red pyramid that can rotate while the beam does the work.
  const withMover = (b: Board) => {
    put(b, 5, 5, 'pyramid', 'red', 0);
    return b;
  };
  const spin: Action = { type: 'rotate', x: 5, y: 5, orient: 1, spin: 1 };

  it('removes an unshielded enemy piece the beam strikes', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'pyramid', 'silver', 0);
    const res = applyOk(stateOf(b, 'red'), 'red', spin);
    expect(res.removed).toMatchObject({ x: 4, y: 0, piece: { type: 'pyramid', color: 'silver' } });
    expect(res.board[0][4]).toBeNull();
    expect(res.laser).toEqual([center(0, 0), center(4, 0)]);
    expect(res.winner).toBeNull();
    expect(res.turn).toBe('silver');
  });

  it('removes the mover\'s own piece too (friendly fire)', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'anubis', 'red', 0);
    const res = applyOk(stateOf(b, 'red'), 'red', spin);
    expect(res.removed).toMatchObject({ x: 4, y: 0, piece: { type: 'anubis', color: 'red' } });
    expect(res.board[0][4]).toBeNull();
    expect(res.winner).toBeNull();
  });

  it('leaves a shielded anubis standing', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'anubis', 'silver', 3); // faces west, toward the incoming beam
    const res = applyOk(stateOf(b, 'red'), 'red', spin);
    expect(res.removed).toBeNull();
    expect(res.board[0][4]).toMatchObject({ type: 'anubis' });
    expect(res.turn).toBe('silver');
  });

  it('leaves scarabs standing', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'scarab', 'silver', 0);
    const res = applyOk(stateOf(b, 'red'), 'red', spin);
    expect(res.removed).toBeNull();
    expect(res.board[0][4]).toMatchObject({ type: 'scarab' });
  });

  it('does not touch the original board', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'pyramid', 'silver', 0);
    const state = stateOf(b, 'red');
    const res = applyOk(state, 'red', spin);
    expect(state.board[0][4]).not.toBeNull();
    expect(res.board).not.toBe(state.board);
  });

  it('ignores the opponent\'s laser line on your turn', () => {
    const b = withMover(duel());
    put(b, 4, 7, 'pharaoh', 'silver'); // sits in silver's beam row, not red's
    const res = applyOk(stateOf(b, 'red'), 'red', spin);
    expect(res.removed).toBeNull();
    expect(res.winner).toBeNull();
    expect(res.board[7][4]).toMatchObject({ type: 'pharaoh' });
  });
});

describe('applyAction - win check', () => {
  const withMover = (b: Board) => {
    put(b, 5, 5, 'pyramid', 'red', 0);
    return b;
  };
  const spin: Action = { type: 'rotate', x: 5, y: 5, orient: 1, spin: 1 };

  it('awards the game to red when its beam hits the silver pharaoh', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'pharaoh', 'silver');
    const res = applyOk(stateOf(b, 'red'), 'red', spin);
    expect(res.winner).toBe('red');
    expect(res.removed).toMatchObject({ x: 4, y: 0, piece: { type: 'pharaoh', color: 'silver' } });
    expect(res.board[0][4]).toBeNull();
    expect(res.turn).toBe('red'); // turn does not pass once the game is decided
  });

  it('awards the game to silver when its beam hits the red pharaoh', () => {
    const b = duel();
    put(b, 5, 2, 'pyramid', 'silver', 0);
    put(b, 4, 7, 'pharaoh', 'red');
    const res = applyOk(stateOf(b, 'silver'), 'silver', { type: 'rotate', x: 5, y: 2, orient: 1, spin: 1 });
    expect(res.winner).toBe('silver');
    expect(res.turn).toBe('silver');
  });

  it('loses the game for the mover who shoots their own pharaoh', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'pharaoh', 'red');
    const res = applyOk(stateOf(b, 'red'), 'red', spin);
    expect(res.winner).toBe('silver');
    expect(res.removed).toMatchObject({ piece: { type: 'pharaoh', color: 'red' } });
  });

  it('wins through reflections', () => {
    const b = emptyBoard();
    put(b, 0, 0, 'sphinx', 'red', 2); // pointing down the wall until rotated
    put(b, 4, 0, 'pyramid', 'silver', 2); // E -> S
    put(b, 4, 3, 'scarab', 'silver', 1); // S -> W
    put(b, 1, 3, 'pharaoh', 'silver');
    const res = applyOk(stateOf(b, 'red'), 'red', { type: 'rotate', x: 0, y: 0, orient: 1 });
    expect(res.winner).toBe('red');
    expect(res.laser).toEqual([center(0, 0), center(4, 0), center(4, 3), center(1, 3)]);
  });

  it('does not end the game when a non-pharaoh dies', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'pyramid', 'silver', 0);
    put(b, 8, 4, 'pharaoh', 'silver');
    expect(applyOk(stateOf(b, 'red'), 'red', spin).winner).toBeNull();
  });

  it('refuses any further action once the result is committed', () => {
    const b = withMover(duel());
    put(b, 4, 0, 'pharaoh', 'silver');
    const state = stateOf(b, 'red');
    const res = applyOk(state, 'red', spin);
    const finished: GameState = { ...state, board: res.board, turn: res.turn, winner: res.winner };
    expect(applyAction(finished, 'red', { type: 'rotate', x: 5, y: 5, orient: 2, spin: 1 })).toEqual({
      ok: false,
      error: 'game-over',
    });
  });
});


// ---- draws: fifty-move rule, stalemate, agreed draw ------------------------
describe('draws', () => {
  const piece = (type: Piece['type'], color: Piece['color'], orient = 0): Piece => ({ id: `${color}-${type}-${orient}`, type, color, orient });

  function emptyBoard(): Board {
    return Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => null));
  }

  // Silver sphinx in the bottom-right corner firing north up column 9; each side
  // keeps a pharaoh far from the beam so no test ends in a win by accident.
  function baseBoard(): Board {
    const b = emptyBoard();
    b[7][9] = piece('sphinx', 'silver', 0);
    b[7][4] = piece('pharaoh', 'silver');
    b[0][4] = piece('pharaoh', 'red');
    b[5][5] = piece('scarab', 'silver');
    b[2][2] = piece('scarab', 'red');
    return b;
  }

  const state = (board: Board, quietPlies = 0): GameState => ({ setup: 'test', board, turn: 'silver', winner: null, quietPlies, moveCount: quietPlies });
  const quietMove: Action = { type: 'move', x: 5, y: 5, tx: 5, ty: 4 };

  describe('fifty-move rule', () => {
    it('counts plies without a capture', () => {
      const r = applyAction(state(baseBoard(), 10), 'silver', quietMove);
      expect(r.ok && r.quietPlies).toBe(11);
      expect(r.ok && r.draw).toBeNull();
    });

    it('draws on the 100th quiet ply', () => {
      const r = applyAction(state(baseBoard(), FIFTY_MOVE_PLIES - 1), 'silver', quietMove);
      expect(r.ok && r.draw).toBe('fifty-move');
      expect(r.ok && r.winner).toBeNull();
    });

    it('resets when the laser destroys a piece', () => {
      const b = baseBoard();
      b[2][9] = piece('anubis', 'red', 0); // unshielded from the south: destroyed by the beam
      const r = applyAction(state(b, FIFTY_MOVE_PLIES - 1), 'silver', quietMove);
      expect(r.ok && r.removed?.piece.type).toBe('anubis');
      expect(r.ok && r.quietPlies).toBe(0);
      expect(r.ok && r.draw).toBeNull();
    });
  });

  describe('stalemate', () => {
    it('draws when the side to move has no legal action', () => {
      const b = emptyBoard();
      b[7][9] = piece('sphinx', 'silver', 0);
      b[7][4] = piece('pharaoh', 'silver');
      // Red has only a pharaoh, boxed into the corner - it can't move and can't rotate.
      b[0][0] = piece('pharaoh', 'red');
      b[0][1] = piece('scarab', 'silver');
      b[1][0] = piece('scarab', 'silver');
      b[1][1] = piece('scarab', 'silver');
      const r = applyAction(state(b), 'silver', { type: 'rotate', x: 1, y: 1, orient: 1, spin: 1 });
      expect(r.ok && r.draw).toBe('stalemate');
      expect(r.ok && r.turn).toBe('red'); // the side left without a move
    });

    it('is not a stalemate while any piece can still rotate', () => {
      const r = applyAction(state(baseBoard()), 'silver', quietMove);
      expect(r.ok && r.draw).toBeNull();
    });
  });

  describe('game over', () => {
    it('rejects actions after a draw', () => {
      const drawn = { ...state(baseBoard()), draw: 'agreement' as const };
      expect(isGameOver(drawn)).toBe(true);
      expect(applyAction(drawn, 'silver', quietMove)).toEqual({ ok: false, error: 'game-over' });
    });
  });

});
