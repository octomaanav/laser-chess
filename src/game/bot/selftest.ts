// Correctness smoke test for src/game/bot/. Run with: npx tsx src/game/bot/selftest.ts
// No test framework in this repo (see CLAUDE.md) - this is a lightweight,
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
import { evaluate, DEFAULT_WEIGHTS, type Weights } from './evaluate';

function emptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => null));
}
function stateWith(board: Board): GS {
  return { setup: 'test', board, turn: 'silver', winner: null, moveCount: 0 };
}

function testEvaluateMaterial() {
  const board = emptyBoard();
  // Silver has an extra prism; otherwise identical - silver should score higher.
  board[3][3] = { id: 's1', type: 'source', color: 'silver', orient: 0 };
  board[4][6] = { id: 'r1', type: 'source', color: 'red', orient: 2 };
  board[2][2] = { id: 's2', type: 'prism', color: 'silver', orient: 0 };
  const state = stateWith(board);
  const scoreSilver = evaluate(state, 'silver');
  const scoreRed = evaluate(state, 'red');
  assert.ok(scoreSilver > 0, `silver with extra material should score positive, got ${scoreSilver}`);
  assert.ok(scoreRed < 0, `red down material should score negative, got ${scoreRed}`);
  console.log(`ok: evaluate material (silver=${scoreSilver}, red=${scoreRed})`);
}

function testEvaluateFriendlyFire() {
  // Silver's source at (0,0) fires South (orient 2) directly into its own
  // mirror at (0,1) with no reflection (orient 0 mirror reflects S/E faces,
  // so a laser traveling South hits it flat and is destroyed) - this must be
  // scored as BAD for silver, not good.
  const board = emptyBoard();
  board[0][0] = { id: 's1', type: 'source', color: 'silver', orient: 2 };
  board[1][0] = { id: 'p1', type: 'mirror', color: 'silver', orient: 2 };
  board[7][9] = { id: 's2', type: 'source', color: 'red', orient: 0 };
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
  // Silver's source at (0,0) already fires East straight into red's keystone
  // at (9,0) with nothing in between. Any legal silver action that leaves
  // that lane clear still wins immediately (applyAction fires the laser
  // after every move). The search must return a legal, winning action.
  //
  // Note: a corner source's only legal action is rotating between its two
  // board-facing orientations (see engine.ts sourceLegalOrients) - it can
  // never "pass". If the source were silver's only piece, its one legal
  // action would be rotating away from orient 1, which breaks this exact
  // winning lane every time. So a second silver piece, off row 0, is added
  // here to give silver a legal action that actually leaves the lane clear
  // (matching the "any legal action that leaves the lane clear wins"
  // comment above) - the search must find and prefer it over the
  // lane-breaking source rotation.
  const board = emptyBoard();
  board[0][0] = { id: 's1', type: 'source', color: 'silver', orient: 1 };
  board[0][9] = { id: 'p1', type: 'keystone', color: 'red', orient: 0 };
  board[7][0] = { id: 's2', type: 'source', color: 'red', orient: 0 };
  board[5][5] = { id: 'y1', type: 'mirror', color: 'silver', orient: 0 };
  const state = stateWith(board);

  const deadline = Date.now() + 300;
  const { action } = search(state, 'silver', deadline);
  const result = applyAction(state, 'silver', action);
  assert.ok(result.ok, 'search must return a legal action');
  assert.strictEqual(result.winner, 'silver', `expected silver to win immediately, got winner=${result.winner}`);
  console.log(`ok: search finds forced win (action=${JSON.stringify(action)})`);
}

testSearchFindsMateInOne();

import { chooseMove } from './bot';

function testChooseMoveRespectsBudget() {
  const state = createGameFromDef(classic);
  const start = Date.now();
  const action = chooseMove(state, 'silver', 'easy');
  const elapsed = Date.now() - start;
  assert.ok(action, 'chooseMove must return an action');
  assert.ok(elapsed < 1000, `easy difficulty should return well under 1s, took ${elapsed}ms`);
  console.log(`ok: chooseMove easy (${elapsed}ms)`);
}

testChooseMoveRespectsBudget();

function testEvaluateCustomWeights() {
  // Same position as testEvaluateMaterial, but with offenseHit zeroed out -
  // if a silver piece can currently hit red's laser-exposed piece for
  // points, zeroing that weight must lower silver's score relative to
  // DEFAULT_WEIGHTS. This is the only way to prove the weights parameter
  // actually flows into the score instead of being ignored.
  const board = emptyBoard();
  board[0][0] = { id: 's1', type: 'source', color: 'silver', orient: 1 };
  board[0][5] = { id: 'r1', type: 'mirror', color: 'red', orient: 0 };
  board[7][9] = { id: 's2', type: 'source', color: 'red', orient: 0 };
  const state = stateWith(board);

  const zeroOffense: Weights = { ...DEFAULT_WEIGHTS, offenseHit: 0 };
  const defaultScore = evaluate(state, 'silver');
  const zeroedScore = evaluate(state, 'silver', zeroOffense);
  assert.ok(
    zeroedScore < defaultScore,
    `zeroing offenseHit should lower silver's score, got default=${defaultScore} zeroed=${zeroedScore}`,
  );
  console.log(`ok: evaluate custom weights (default=${defaultScore}, zeroed=${zeroedScore})`);
}

testEvaluateCustomWeights();

function testEvaluateDangerProximity() {
  // Silver's keystone sits at (5,0). Red's source at (5,7) fires orient 0
  // (North) straight up column 5 — its path runs directly toward silver's
  // king (never reflected, nothing in between) without hitting it this
  // turn. A second red source variant fires away (orient 2, South) instead.
  // The near-miss-toward-king position must score worse for silver than the
  // laser-pointed-away position — proving the defensive proximity term
  // actually penalizes a looming threat, not just an exact hit.
  const threatBoard = emptyBoard();
  threatBoard[0][5] = { id: 'p1', type: 'keystone', color: 'silver', orient: 0 };
  threatBoard[7][5] = { id: 'r1', type: 'source', color: 'red', orient: 0 };
  threatBoard[7][0] = { id: 's1', type: 'source', color: 'silver', orient: 1 };
  const threatState = stateWith(threatBoard);

  const safeBoard = emptyBoard();
  safeBoard[0][5] = { id: 'p1', type: 'keystone', color: 'silver', orient: 0 };
  safeBoard[7][5] = { id: 'r1', type: 'source', color: 'red', orient: 2 };
  safeBoard[7][0] = { id: 's1', type: 'source', color: 'silver', orient: 1 };
  const safeState = stateWith(safeBoard);

  const threatScore = evaluate(threatState, 'silver');
  const safeScore = evaluate(safeState, 'silver');
  assert.ok(
    threatScore < safeScore,
    `enemy laser aimed at own king must score worse than aimed away, got threat=${threatScore} safe=${safeScore}`,
  );
  console.log(`ok: evaluate danger proximity (threat=${threatScore}, safe=${safeScore})`);
}

testEvaluateDangerProximity();

import { computeHash, hashKey } from './zobrist';

function testZobristSameStateSameHash() {
  const state = createGameFromDef(classic);
  const h1 = computeHash(state);
  const h2 = computeHash(state);
  assert.strictEqual(hashKey(h1), hashKey(h2), 'identical state must hash identically');
  console.log(`ok: zobrist same state -> same hash (${hashKey(h1)})`);
}

function testZobristIgnoresPieceId() {
  const boardA = emptyBoard();
  boardA[0][0] = { id: 'a', type: 'source', color: 'silver', orient: 0 };
  const stateA = stateWith(boardA);
  const boardB = emptyBoard();
  boardB[0][0] = { id: 'totally-different-id', type: 'source', color: 'silver', orient: 0 };
  const stateB = stateWith(boardB);
  assert.strictEqual(hashKey(computeHash(stateA)), hashKey(computeHash(stateB)), 'piece id must not affect hash');
  console.log('ok: zobrist ignores piece id');
}

function testZobristDistinguishesOrientAndTurn() {
  const board = emptyBoard();
  board[0][0] = { id: 'a', type: 'source', color: 'silver', orient: 0 };
  const state = stateWith(board);

  const rotatedBoard = board.map((row) => row.slice());
  rotatedBoard[0][0] = { ...rotatedBoard[0][0]!, orient: 1 };
  const rotated = stateWith(rotatedBoard);
  assert.notStrictEqual(
    hashKey(computeHash(state)),
    hashKey(computeHash(rotated)),
    'different orient must hash differently',
  );

  const otherTurn = { ...state, turn: 'red' as const };
  assert.notStrictEqual(
    hashKey(computeHash(state)),
    hashKey(computeHash(otherTurn)),
    'different side-to-move must hash differently',
  );
  console.log('ok: zobrist distinguishes orient and side-to-move');
}

testZobristSameStateSameHash();
testZobristIgnoresPieceId();
testZobristDistinguishesOrientAndTurn();

import { createTable, ttLookup, ttStore } from './transpositionTable';

function testTranspositionTableStoreAndLookup() {
  const table = createTable();
  const state = createGameFromDef(classic);
  const hash = computeHash(state);
  assert.strictEqual(ttLookup(table, hash), undefined, 'empty table must miss');
  const entry = { depth: 3, score: 42, flag: 'exact' as const, bestAction: enumerateActions(state, 'silver')[0] };
  ttStore(table, hash, entry);
  assert.deepStrictEqual(ttLookup(table, hash), entry, 'stored entry must be returned by lookup');
  console.log('ok: transposition table store/lookup');
}

function testTranspositionTableAlwaysReplaces() {
  const table = createTable();
  const state = createGameFromDef(classic);
  const hash = computeHash(state);
  const action = enumerateActions(state, 'silver')[0];
  ttStore(table, hash, { depth: 1, score: 1, flag: 'exact', bestAction: action });
  ttStore(table, hash, { depth: 5, score: 99, flag: 'lower', bestAction: action });
  const entry = ttLookup(table, hash)!;
  assert.strictEqual(entry.depth, 5, 'later store must replace earlier entry (always-replace policy)');
  console.log('ok: transposition table always-replace policy');
}

testTranspositionTableStoreAndLookup();
testTranspositionTableAlwaysReplaces();

function testSearchDeterministicWithTranspositionTable() {
  const state = createGameFromDef(classic);
  const { action: action1 } = search(state, 'silver', Date.now() + 5000, 0, 2);
  const { action: action2 } = search(state, 'silver', Date.now() + 5000, 0, 2);
  assert.deepStrictEqual(
    action1,
    action2,
    'search with noise=0 must be deterministic across runs with the transposition table',
  );
  console.log('ok: search deterministic with transposition table');
}

testSearchDeterministicWithTranspositionTable();

import { quiescence } from './quiescence';

function testQuiescenceStandPatWhenNoCaptures() {
  // Neither source's laser path crosses any piece - no capturing move is
  // available to either side, so quiescence() must return exactly the
  // static evaluate() score (stand pat) without searching any deeper.
  const board = emptyBoard();
  board[0][0] = { id: 's1', type: 'source', color: 'silver', orient: 2 }; // fires south, column 0 empty below it
  board[7][9] = { id: 'r1', type: 'source', color: 'red', orient: 0 }; // fires north, column 9 empty above it
  board[3][3] = { id: 'm1', type: 'mirror', color: 'silver', orient: 0 };
  board[4][6] = { id: 'm2', type: 'mirror', color: 'red', orient: 0 };
  const state = stateWith(board);
  const timedOut = { timedOut: false };
  const deadline = Date.now() + 1000;
  const standPatScore = evaluate(state, 'silver', DEFAULT_WEIGHTS);
  const quiescenceScore = quiescence(state, 'silver', 'red', -Infinity, Infinity, deadline, timedOut, DEFAULT_WEIGHTS);
  assert.strictEqual(quiescenceScore, standPatScore, 'quiescence must stand pat when no captures are available');
  console.log(`ok: quiescence stands pat with no captures (score=${quiescenceScore})`);
}

function testQuiescenceRespectsPliesBound() {
  // Red's source at (0,0) fires straight East along row 0 into silver's
  // shield at (0,3) with nothing between - red has an immediate capturing
  // move available (moving the unrelated mirror at (7,5) doesn't disturb
  // row 0, so the laser still refires and hits the shield after that move,
  // same trick used by testSearchFindsMateInOne above). With pliesLeft=0,
  // quiescence must NOT extend into that capture - it returns the stand-pat
  // score immediately regardless of what's available.
  const board = emptyBoard();
  // Board adjusted from the brief: red's source starts aimed south (orient 2)
  // at an empty column, so stand-pat has no aimed-laser penalty; rotating it
  // east is red's one capturing move.
  board[0][0] = { id: 'r1', type: 'source', color: 'red', orient: 2 };
  board[0][3] = { id: 's1', type: 'shield', color: 'silver', orient: 0 };
  board[7][5] = { id: 'r2', type: 'mirror', color: 'red', orient: 0 };
  board[7][9] = { id: 's2', type: 'source', color: 'silver', orient: 2 };
  const state = { ...stateWith(board), turn: 'red' as const };
  const timedOut = { timedOut: false };
  const deadline = Date.now() + 1000;
  const standPatScore = evaluate(state, 'silver', DEFAULT_WEIGHTS);
  const bounded = quiescence(state, 'silver', 'red', -Infinity, Infinity, deadline, timedOut, DEFAULT_WEIGHTS, 0);
  assert.strictEqual(bounded, standPatScore, 'pliesLeft=0 must return the stand-pat score without extending');
  console.log('ok: quiescence respects pliesLeft bound');
}

function testQuiescenceExtendsIntoAvailableCapture() {
  // Same position as above, but with the default (non-zero) plies budget -
  // quiescence must actually recurse past red's capturing move rather than
  // stopping at the stand-pat score. The two scores are expected to differ,
  // proving the recursive capture search actually executes.
  const board = emptyBoard();
  // Board adjusted from the brief (see previous test): red source aimed south,
  // capture available by rotating it east.
  board[0][0] = { id: 'r1', type: 'source', color: 'red', orient: 2 };
  board[0][3] = { id: 's1', type: 'shield', color: 'silver', orient: 0 };
  board[7][5] = { id: 'r2', type: 'mirror', color: 'red', orient: 0 };
  board[7][9] = { id: 's2', type: 'source', color: 'silver', orient: 2 };
  const state = { ...stateWith(board), turn: 'red' as const };
  const timedOut = { timedOut: false };
  const deadline = Date.now() + 1000;
  const standPatScore = evaluate(state, 'silver', DEFAULT_WEIGHTS);
  const extended = quiescence(state, 'silver', 'red', -Infinity, Infinity, deadline, timedOut, DEFAULT_WEIGHTS);
  assert.ok(extended < standPatScore, `red captures silver's shield, so silver's score must drop below stand-pat (standPat=${standPatScore}, extended=${extended})`);
  console.log(`ok: quiescence extends into available capture (standPat=${standPatScore}, extended=${extended})`);
}

testQuiescenceStandPatWhenNoCaptures();
testQuiescenceRespectsPliesBound();
testQuiescenceExtendsIntoAvailableCapture();

console.log('all bot selftests passed');
