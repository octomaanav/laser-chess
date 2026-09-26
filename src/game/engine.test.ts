// src/game/engine.test.ts
import { describe, expect, it } from 'vitest';
import { applyAction, FIFTY_MOVE_PLIES, isGameOver } from './engine';
import type { Action, Board, GameState, Piece } from './types';

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
