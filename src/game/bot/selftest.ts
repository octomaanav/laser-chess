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
console.log('all bot selftests passed');
