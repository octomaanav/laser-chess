// One-off local tool - NOT wired to package.json, NOT imported by production
// code. Run manually: npx tsx scripts/tune-bot-weights.ts
//
// Hill-climbs evaluate.ts's tactical Weights via self-play: each generation
// mutates one weight, plays a small match between the mutant and the
// current best, and keeps the mutant only if it wins clearly more than
// half the games. See docs/superpowers/specs/2026-08-14-bot-weight-tuning-design.md.
import { DEFAULT_WEIGHTS, type Weights } from '../src/game/bot/evaluate';
import { search } from '../src/game/bot/search';
import { enumerateActions } from '../src/game/bot/moveGen';
import { applyAction } from '../src/game/engine';
import { createGameFromDef, DEFAULT_SETUPS } from '../src/game/setups';
import type { Action, Color, GameState } from '../src/game/types';

const GENERATIONS = 30;
const MAX_PLIES = 120;
const ADOPT_THRESHOLD = 0.55; // mutant must win > this fraction of the match to replace current best
// Fixed depth, no time pressure (deadline = Infinity) - depth alone limits
// each move, keeping games fast and fully reproducible across runs.
const TUNE_DEPTH = 3;
// The 4 default setups are mirror-symmetric starting positions; at
// TUNE_DEPTH some resolve via a forced tactical sequence that alpha-beta
// finds regardless of eval weights (a forced win scores ±Infinity, bypassing
// evaluate() entirely), and others turned out sensitive to any asymmetry
// between the two sides' weights rather than genuine strength - see the
// design doc's addendum. Randomizing the first few plies with uniformly
// random legal moves (both sides, weight-independent) breaks that
// determinism so each generation actually samples a different midgame
// instead of replaying the same fixed forced lines.
const RANDOM_OPENING_PLIES = 6;
// Each (setup, mutant-color) matchup is replayed this many times with a
// fresh random opening each time. At REPEATS=1 (8 games/match total), many
// "ADOPTED" mutations won by exactly 4.5/8 games - right at the 55%
// threshold, well within noise for an 8-sample match. Bumping repeats
// trades runtime for a match size where a marginal win rate reflects an
// actual difference in strength rather than which side got the luckier
// random opening.
const REPEATS = 3;

type WeightKey = keyof Weights;
const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as WeightKey[];

function mutate(weights: Weights): Weights {
  const key = WEIGHT_KEYS[(Math.random() * WEIGHT_KEYS.length) | 0];
  const factor = 0.8 + Math.random() * 0.45; // [0.8, 1.25]
  return { ...weights, [key]: weights[key] * factor };
}

type Outcome = 'a' | 'b' | 'draw';

function randomLegalAction(state: GameState, color: Color): Action {
  const actions = enumerateActions(state, color);
  return actions[(Math.random() * actions.length) | 0];
}

// Plays one game to completion or MAX_PLIES. `aColor` says which color
// weightsA is playing this game (alternated by the caller across the match
// so neither weight set always moves first). The first RANDOM_OPENING_PLIES
// plies are uniformly random legal moves (weight-independent) to escape
// this game's fixed forced-tactic lines; afterward each move is chosen by a
// real minimax search (search.ts, same code the production bot uses) at
// TUNE_DEPTH, with the mover's weight set injected.
function playGame(weightsA: Weights, weightsB: Weights, setupName: string, aColor: Color): Outcome {
  const def = DEFAULT_SETUPS.find((d) => d.name === setupName)!;
  let state = createGameFromDef(def);

  for (let ply = 0; ply < MAX_PLIES; ply++) {
    if (state.winner) break;
    const toMove = state.turn;
    const action =
      ply < RANDOM_OPENING_PLIES
        ? randomLegalAction(state, toMove)
        : search(state, toMove, Infinity, 0, TUNE_DEPTH, toMove === aColor ? weightsA : weightsB).action;
    const result = applyAction(state, toMove, action);
    if (!result.ok) throw new Error(`tuner produced illegal action: ${JSON.stringify(action)} (${result.error})`);
    state = {
      ...state,
      board: result.board!,
      turn: result.turn!,
      winner: result.winner!,
      moveCount: state.moveCount + 1,
    };
  }

  if (!state.winner) return 'draw';
  return state.winner === aColor ? 'a' : 'b';
}

// Each match plays every setup with the mutant as BOTH colors, once each,
// rather than a fixed game count cycling through indices: an earlier
// index-based version tied mutant color to `i % 2` and setup to `i % 4`,
// and since 4 is a multiple of 2, every setup always paired with the same
// mutant color on every repeat - with the random opening below adding
// variety per game, that periodicity would otherwise have kept comparing
// the mutant's weaker color assignment against the current-best's stronger
// one (or vice versa) on the same setups every generation. Enumerating
// setup x color explicitly guarantees every unique matchup is covered.
const MATCH_GAMES = DEFAULT_SETUPS.length * 2 * REPEATS;

function playMatch(mutant: Weights, current: Weights): number {
  let mutantScore = 0;
  for (const setup of DEFAULT_SETUPS) {
    for (let r = 0; r < REPEATS; r++) {
      mutantScore += playMatchGame(mutant, current, true, setup.name);
      mutantScore += playMatchGame(mutant, current, false, setup.name);
    }
  }
  return mutantScore / MATCH_GAMES;
}

function playMatchGame(mutant: Weights, current: Weights, mutantIsA: boolean, setupName: string): number {
  const aColor: Color = 'silver';
  const weightsA = mutantIsA ? mutant : current;
  const weightsB = mutantIsA ? current : mutant;
  const outcome = playGame(weightsA, weightsB, setupName, aColor);
  if (outcome === 'draw') return 0.5;
  const mutantWon = mutantIsA ? outcome === 'a' : outcome === 'b';
  return mutantWon ? 1 : 0;
}

function run(): void {
  let current = { ...DEFAULT_WEIGHTS };

  for (let gen = 1; gen <= GENERATIONS; gen++) {
    const mutant = mutate(current);
    const changedKey = WEIGHT_KEYS.find((k) => mutant[k] !== current[k])!;
    const winRate = playMatch(mutant, current);
    const adopted = winRate > ADOPT_THRESHOLD;
    if (adopted) current = mutant;
    console.log(
      `gen ${gen}/${GENERATIONS}: mutated ${changedKey} -> ${mutant[changedKey].toFixed(2)}, ` +
        `win rate ${(winRate * 100).toFixed(1)}%, ${adopted ? 'ADOPTED' : 'discarded'}`,
    );
  }

  console.log('\nFinal weights:');
  console.log(JSON.stringify(current, null, 2));
}

run();
