// src/game/bot/search.test.ts
import { describe, expect, it } from 'vitest';
import { applyAction, countLegalActions, resolveAction } from '../engine';
import { createGameFromDef, DEFAULT_SETUPS } from '../setups';
import type { Action, Board, Color, GameState, Piece } from '../types';
import { TIERS } from './bot';
import { enumerateActions } from './moveGen';
import { MATE, search } from './search';
import type { Difficulty } from './types';

const piece = (type: Piece['type'], color: Piece['color'], orient = 0): Piece => ({ id: `${color}-${type}-${orient}`, type, color, orient });
const emptyBoard = (): Board => Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => null));
const stateWith = (board: Board): GameState => ({ setup: 'test', board, turn: 'silver', winner: null, moveCount: 0 });
function play(st: GameState, color: Color, action: Action) {
  const r = applyAction(st, color, action);
  if (!r.ok) throw new Error(`illegal action ${JSON.stringify(action)}: ${r.error}`);
  return r;
}

// Deterministic random walk from the Classic opening, for positions past move one.
function randomPositions(count: number, plies: number): GameState[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out: GameState[] = [];
  for (let g = 0; g < count; g++) {
    let st = createGameFromDef(DEFAULT_SETUPS[g % DEFAULT_SETUPS.length]);
    for (let i = 0; i < plies; i++) {
      const actions = enumerateActions(st, st.turn);
      const r = applyAction(st, st.turn, actions[(rnd() * actions.length) | 0]);
      if (!r.ok || r.winner || r.draw) break;
      st = { ...st, board: r.board, turn: r.turn, quietPlies: r.quietPlies, moveCount: st.moveCount + 1 };
      out.push(st);
    }
  }
  return out;
}

describe('engine fast paths used by the search', () => {
  it('countLegalActions matches the generated action lists', () => {
    for (const st of randomPositions(8, 40)) {
      for (const c of ['red', 'silver'] as const) expect(countLegalActions(st.board, c)).toBe(enumerateActions(st, c).length);
    }
  });

  it('resolveAction never mutates the board it was given', () => {
    for (const st of randomPositions(4, 20)) {
      const before = JSON.stringify(st.board);
      for (const a of enumerateActions(st, st.turn)) resolveAction(st, st.turn, a);
      expect(JSON.stringify(st.board)).toBe(before);
    }
  });
});

describe('search', () => {
  it('takes a win in one at every tier, even with noise', () => {
    const b = emptyBoard();
    b[0][0] = piece('sphinx', 'silver', 1); // fires east along row 0...
    b[0][9] = piece('pharaoh', 'red'); // ...straight into red's pharaoh
    b[7][0] = piece('sphinx', 'red', 0);
    b[5][5] = piece('pyramid', 'silver');
    b[7][5] = piece('pharaoh', 'silver');
    for (const d of Object.keys(TIERS) as Difficulty[]) {
      const t = TIERS[d];
      const res = search(stateWith(b), 'silver', Date.now() + 200, t.noise, t.maxDepth, undefined, t.options);
      expect(play(stateWith(b), 'silver', res.action).winner, d).toBe('silver');
      expect(res.score).toBe(MATE - 1);
    }
  });

  it('defends against a laser aimed at its pharaoh', () => {
    // Red's beam runs east along row 0 into a red pyramid that turns it south,
    // down column 5 - onto silver's pharaoh. Whatever red plays next fires it.
    // Stepping the pharaoh aside doesn't help (the pyramid can slide over and
    // re-aim), so the only save is the anubis stepping into the beam shield-up.
    const b = emptyBoard();
    b[0][0] = piece('sphinx', 'red', 1);
    b[0][5] = piece('pyramid', 'red', 2);
    b[2][2] = piece('pharaoh', 'red');
    b[4][5] = piece('pharaoh', 'silver');
    b[2][4] = piece('anubis', 'silver', 0);
    b[7][9] = piece('sphinx', 'silver', 3);
    const st = stateWith(b);
    for (const d of ['medium', 'hard', 'extreme'] as Difficulty[]) {
      const t = TIERS[d];
      const { action } = search(st, 'silver', Date.now() + 500, t.noise, t.maxDepth, undefined, t.options);
      const next: GameState = { ...st, board: play(st, 'silver', action).board, turn: 'red' };
      const redCanWin = enumerateActions(next, 'red').some((a) => play(next, 'red', a).winner === 'red');
      expect(redCanWin, `${d} left its pharaoh in the beam`).toBe(false);
    }
  });

  it('returns a legal move from the opening at the extreme tier', () => {
    const st = createGameFromDef(DEFAULT_SETUPS[0]);
    const t = TIERS.extreme;
    const res = search(st, st.turn, Date.now() + 300, t.noise, t.maxDepth, undefined, t.options);
    expect(applyAction(st, st.turn, res.action).ok).toBe(true);
    expect(res.depthReached).toBeGreaterThanOrEqual(2);
  });
});
