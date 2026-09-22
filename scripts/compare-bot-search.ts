// One-off local tool - NOT wired to package.json or CI, NOT imported by
// production code. Run manually: npx tsx scripts/compare-bot-search.ts
//
// Head-to-head strength check: the current search (transposition table +
// quiescence) vs the original plain minimax (scripts/legacy-search.ts) at
// EQUAL wall-clock time per move. Depth reached alone is a misleading metric
// (quiescence spends time per leaf), so this plays real games. Every default
// setup is played with both colors; each (setup, random opening) pairing is
// played twice with colors swapped so the opening luck cancels out.
import { search } from '../src/game/bot/search';
import { legacySearch } from './legacy-search';
import { enumerateActions } from '../src/game/bot/moveGen';
import { applyAction } from '../src/game/engine';
import { createGameFromDef, DEFAULT_SETUPS } from '../src/game/setups';
import type { Action, Color, GameState } from '../src/game/types';

const MOVE_BUDGET_MS = 400;
const RANDOM_OPENING_PLIES = 6;
const MAX_PLIES = 120;
const REPEATS = 3; // distinct random openings per setup; each is played twice (colors swapped)

type Engine = 'new' | 'legacy';

interface Stats {
  newWins: number;
  legacyWins: number;
  draws: number;
  newDepthSum: number;
  newMoves: number;
  legacyDepthSum: number;
  legacyMoves: number;
}

const emptyStats = (): Stats => ({
  newWins: 0,
  legacyWins: 0,
  draws: 0,
  newDepthSum: 0,
  newMoves: 0,
  legacyDepthSum: 0,
  legacyMoves: 0,
});

function randomLegalAction(state: GameState, color: Color): Action {
  const actions = enumerateActions(state, color);
  return actions[(Math.random() * actions.length) | 0];
}

function step(state: GameState, color: Color, action: Action): GameState {
  const result = applyAction(state, color, action);
  if (!result.ok) throw new Error(`illegal action: ${JSON.stringify(action)} (${result.error})`);
  return {
    ...state,
    board: result.board!,
    turn: result.turn!,
    winner: result.winner!,
    moveCount: state.moveCount + 1,
  };
}

// Generates the shared random opening once so both color assignments of a
// pairing start from the identical position.
// Openings that already end the game during the random plies are re-rolled:
// they'd be decided by luck, not engine strength (and the same for both colors).
function randomOpening(setupName: string): GameState {
  const def = DEFAULT_SETUPS.find((d) => d.name === setupName)!;
  for (;;) {
    let state = createGameFromDef(def);
    for (let ply = 0; ply < RANDOM_OPENING_PLIES && !state.winner; ply++) {
      state = step(state, state.turn, randomLegalAction(state, state.turn));
    }
    if (!state.winner) return state;
  }
}

// Plays from `start` until a winner or MAX_PLIES total plies. Accumulates
// depthReached per engine into `stats`. Returns the winning engine or 'draw'.
function playGame(start: GameState, newColor: Color, stats: Stats): Engine | 'draw' {
  let state = start;
  for (let ply = RANDOM_OPENING_PLIES; ply < MAX_PLIES; ply++) {
    if (state.winner) break;
    const toMove = state.turn;
    const deadline = Date.now() + MOVE_BUDGET_MS;
    if (toMove === newColor) {
      const r = search(state, toMove, deadline, 0, Infinity);
      stats.newDepthSum += r.depthReached;
      stats.newMoves++;
      state = step(state, toMove, r.action);
    } else {
      const r = legacySearch(state, toMove, deadline, 0, Infinity);
      stats.legacyDepthSum += r.depthReached;
      stats.legacyMoves++;
      state = step(state, toMove, r.action);
    }
  }
  if (!state.winner) return 'draw';
  return state.winner === newColor ? 'new' : 'legacy';
}

function record(stats: Stats, outcome: Engine | 'draw'): void {
  if (outcome === 'new') stats.newWins++;
  else if (outcome === 'legacy') stats.legacyWins++;
  else stats.draws++;
}

function score(s: Stats): number {
  const games = s.newWins + s.legacyWins + s.draws;
  return games ? (s.newWins + s.draws / 2) / games : 0;
}

function avg(sum: number, n: number): string {
  return n ? (sum / n).toFixed(2) : 'n/a';
}

function fmt(s: Stats): string {
  const games = s.newWins + s.legacyWins + s.draws;
  return (
    `new ${s.newWins}W / legacy ${s.legacyWins}W / ${s.draws}D (${games} games), ` +
    `new score ${(score(s) * 100).toFixed(1)}%, ` +
    `avg depth new ${avg(s.newDepthSum, s.newMoves)} / legacy ${avg(s.legacyDepthSum, s.legacyMoves)}`
  );
}

function run(): void {
  const total = emptyStats();
  const totalGames = DEFAULT_SETUPS.length * REPEATS * 2;
  let played = 0;
  const startedAt = Date.now();
  console.log(`Budget ${MOVE_BUDGET_MS}ms/move, ${totalGames} games planned\n`);

  for (const setup of DEFAULT_SETUPS) {
    const per = emptyStats();
    for (let r = 0; r < REPEATS; r++) {
      const opening = randomOpening(setup.name);
      for (const newColor of ['silver', 'red'] as Color[]) {
        const outcome = playGame(opening, newColor, per);
        record(per, outcome);
        played++;
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
        console.log(
          `[${played}/${totalGames}] ${setup.name} rep ${r + 1} new=${newColor}: ${outcome} (${elapsed}s elapsed)`,
        );
      }
    }
    console.log(`\n== ${setup.name}: ${fmt(per)}\n`);
    total.newWins += per.newWins;
    total.legacyWins += per.legacyWins;
    total.draws += per.draws;
    total.newDepthSum += per.newDepthSum;
    total.newMoves += per.newMoves;
    total.legacyDepthSum += per.legacyDepthSum;
    total.legacyMoves += per.legacyMoves;
  }

  console.log(`TOTAL: ${fmt(total)}`);
}

run();
