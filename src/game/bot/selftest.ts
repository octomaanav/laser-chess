// Correctness smoke test for src/game/bot/. Run with: npx tsx src/game/bot/selftest.ts
// No test framework in this repo (see CLAUDE.md) — this is a lightweight,
// hand-run substitute, not a full suite.
import assert from 'node:assert';
import { createGameFromDef } from '../setups';
import { DEFAULT_SETUPS } from '../setups';
import { enumerateActions } from './moveGen';

const classic = DEFAULT_SETUPS.find((d) => d.name === 'Classic')!;

function testMoveGen() {
  const state = createGameFromDef(classic);
  const silverActions = enumerateActions(state, 'silver');
  const redActions = enumerateActions(state, 'red');
  assert.ok(silverActions.length > 0, 'silver should have legal actions on the opening board');
  assert.ok(redActions.length > 0, 'red should have legal actions on the opening board');
  // Every generated action must originate from a silver-owned square.
  for (const a of silverActions) {
    const piece = state.board[a.y][a.x];
    assert.ok(piece && piece.color === 'silver', `action originates from a non-silver square: ${JSON.stringify(a)}`);
  }
  console.log(`ok: moveGen (${silverActions.length} silver actions, ${redActions.length} red actions)`);
}

testMoveGen();

import type { Board, GameState as GS } from '../types';
import { evaluate } from './evaluate';

function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => null));
}
function stateWith(board: Board): GS {
  return { setup: 'test', board, turn: 'silver', winner: null, moveCount: 0 };
}

function testEvaluateMaterial() {
  const board = emptyBoard();
  // Silver has an extra scarab; otherwise identical — silver should score higher.
  board[3][3] = { id: 's1', type: 'sphinx', color: 'silver', orient: 0 };
  board[4][6] = { id: 'r1', type: 'sphinx', color: 'red', orient: 2 };
  board[2][2] = { id: 's2', type: 'scarab', color: 'silver', orient: 0 };
  const state = stateWith(board);
  const scoreSilver = evaluate(state, 'silver');
  const scoreRed = evaluate(state, 'red');
  assert.ok(scoreSilver > 0, `silver with extra material should score positive, got ${scoreSilver}`);
  assert.ok(scoreRed < 0, `red down material should score negative, got ${scoreRed}`);
  console.log(`ok: evaluate material (silver=${scoreSilver}, red=${scoreRed})`);
}

function testEvaluateFriendlyFire() {
  // Silver's sphinx at (0,0) fires South (orient 2) directly into its own
  // pyramid at (0,1) with no reflection (orient 0 pyramid reflects S/E faces,
  // so a laser traveling South hits it flat and is destroyed) — this must be
  // scored as BAD for silver, not good.
  const board = emptyBoard();
  board[0][0] = { id: 's1', type: 'sphinx', color: 'silver', orient: 2 };
  board[1][0] = { id: 'p1', type: 'pyramid', color: 'silver', orient: 2 };
  board[7][9] = { id: 's2', type: 'sphinx', color: 'red', orient: 0 };
  const state = stateWith(board);
  const score = evaluate(state, 'silver');
  assert.ok(score < 0, `shooting your own piece must score negative, got ${score}`);
  console.log(`ok: evaluate friendly-fire penalty (score=${score})`);
}

testEvaluateMaterial();
testEvaluateFriendlyFire();

import { search } from './search';
import { applyAction } from '../engine';

function testSearchFindsMateInOne() {
  // Silver's sphinx at (0,0) already fires East straight into red's pharaoh
  // at (9,0) with nothing in between. Any legal silver action that leaves
  // that lane clear still wins immediately (applyAction fires the laser
  // after every move). The search must return a legal, winning action.
  //
  // Note: a corner sphinx's only legal action is rotating between its two
  // board-facing orientations (see engine.ts sphinxLegalOrients) — it can
  // never "pass". If the sphinx were silver's only piece, its one legal
  // action would be rotating away from orient 1, which breaks this exact
  // winning lane every time. So a second silver piece, off row 0, is added
  // here to give silver a legal action that actually leaves the lane clear
  // (matching the "any legal action that leaves the lane clear wins"
  // comment above) — the search must find and prefer it over the
  // lane-breaking sphinx rotation.
  const board = emptyBoard();
  board[0][0] = { id: 's1', type: 'sphinx', color: 'silver', orient: 1 };
  board[0][9] = { id: 'p1', type: 'pharaoh', color: 'red', orient: 0 };
  board[7][0] = { id: 's2', type: 'sphinx', color: 'red', orient: 0 };
  board[5][5] = { id: 'y1', type: 'pyramid', color: 'silver', orient: 0 };
  const state = stateWith(board);

  const deadline = Date.now() + 300;
  const { action } = search(state, 'silver', deadline);
  const result = applyAction(state, 'silver', action);
  assert.ok(result.ok, 'search must return a legal action');
  assert.strictEqual(result.winner, 'silver', `expected silver to win immediately, got winner=${result.winner}`);
  console.log(`ok: search finds forced win (action=${JSON.stringify(action)})`);
}

testSearchFindsMateInOne();
console.log('all bot selftests passed');
