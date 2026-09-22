// src/game/bot/zobrist.ts
import type { Board, Color, GameState, PieceType } from '../types';

// Zobrist hashing: a random key per (square, pieceType, color, orient),
// XORed together for every occupied square, plus one key for side-to-move.
// Piece `id` is excluded - two same-type/color/orient pieces on the same
// square are equivalent for search purposes. Represented as a pair of
// unsigned 32-bit numbers (not a single JS number or BigInt) to keep
// collision risk negligible without needing real 64-bit integers.
export interface ZobristHash {
  hi: number;
  lo: number;
}

const PIECE_TYPES: PieceType[] = ['keystone', 'mirror', 'prism', 'shield', 'source'];
const COLORS: Color[] = ['red', 'silver'];
const ORIENTS = [0, 1, 2, 3];
const ROWS = 8;
const COLS = 10;

function randomUint32(): number {
  return (Math.random() * 0x100000000) >>> 0;
}

function randomKey(): ZobristHash {
  return { hi: randomUint32(), lo: randomUint32() };
}

// squareKeys[y][x][pieceTypeIndex][colorIndex][orient]
const squareKeys: ZobristHash[][][][][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => PIECE_TYPES.map(() => COLORS.map(() => ORIENTS.map(() => randomKey())))),
);
const sideToMoveKey = randomKey();

function pieceTypeIndex(type: PieceType): number {
  return PIECE_TYPES.indexOf(type);
}
function colorIndex(color: Color): number {
  return COLORS.indexOf(color);
}

export function computeHash(state: GameState): ZobristHash {
  let hi = 0;
  let lo = 0;
  const board: Board = state.board;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const piece = board[y][x];
      if (!piece) continue;
      const key = squareKeys[y][x][pieceTypeIndex(piece.type)][colorIndex(piece.color)][piece.orient];
      hi = (hi ^ key.hi) >>> 0;
      lo = (lo ^ key.lo) >>> 0;
    }
  }
  if (state.turn === 'silver') {
    hi = (hi ^ sideToMoveKey.hi) >>> 0;
    lo = (lo ^ sideToMoveKey.lo) >>> 0;
  }
  return { hi, lo };
}

export function hashKey(hash: ZobristHash): string {
  return `${hash.hi}:${hash.lo}`;
}
