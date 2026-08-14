// One-off local tool — NOT wired to package.json, NOT imported by production
// code. Run manually: npx tsx scripts/tune-bot-weights.ts
//
// Hill-climbs evaluate.ts's tactical Weights via self-play: each generation
// mutates one weight, plays a small match between the mutant and the
// current best, and keeps the mutant only if it wins clearly more than
// half the games. See docs/superpowers/specs/2026-08-14-bot-weight-tuning-design.md.
import { evaluate, DEFAULT_WEIGHTS, type Weights } from '../src/game/bot/evaluate';
import { enumerateActions } from '../src/game/bot/moveGen';
import { applyAction } from '../src/game/engine';
import { createGameFromDef, DEFAULT_SETUPS } from '../src/game/setups';
import type { Action, Color, GameState } from '../src/game/types';

const GENERATIONS = 30;
const MATCH_GAMES = 20;
const MAX_PLIES = 120;
const ADOPT_THRESHOLD = 0.55; // mutant must win > this fraction of the match to replace current best

type WeightKey = keyof Weights;
const WEIGHT_KEYS = Object.keys(DEFAULT_WEIGHTS) as WeightKey[];

function mutate(weights: Weights): Weights {
  const key = WEIGHT_KEYS[(Math.random() * WEIGHT_KEYS.length) | 0];
  const factor = 0.8 + Math.random() * 0.45; // [0.8, 1.25]
  return { ...weights, [key]: weights[key] * factor };
}

// Greedy one-ply move choice scored by `weights` — search.ts's minimax
// always uses DEFAULT_WEIGHTS internally with no way to inject a candidate
// weight set, so this script drives its own move choice instead: apply
// each legal action, score the result with evaluate(next, color, weights),
// keep the best. This is the only depth at which the weights parameter
// actually changes behavior, so it's what isolates eval quality for tuning.
function chooseGreedyMove(state: GameState, color: Color, weights: Weights): Action {
  const actions = enumerateActions(state, color);
  let best = actions[0];
  let bestScore = -Infinity;
  for (const action of actions) {
    const result = applyAction(state, color, action);
    if (!result.ok) continue;
    const next: GameState = {
      ...state,
      board: result.board!,
      turn: result.turn!,
      winner: result.winner!,
      moveCount: state.moveCount + 1,
    };
    const score = evaluate(next, color, weights);
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

type Outcome = 'a' | 'b' | 'draw';

// Plays one game to completion or MAX_PLIES. `aColor` says which color
// weightsA is playing this game (alternated by the caller across the match
// so neither weight set always moves first).
function playGame(weightsA: Weights, weightsB: Weights, setupName: string, aColor: Color): Outcome {
  const def = DEFAULT_SETUPS.find((d) => d.name === setupName)!;
  let state = createGameFromDef(def);

  for (let ply = 0; ply < MAX_PLIES; ply++) {
    if (state.winner) break;
    const toMove = state.turn;
    const weights = toMove === aColor ? weightsA : weightsB;
    const action = chooseGreedyMove(state, toMove, weights);
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

function playMatch(mutant: Weights, current: Weights): number {
  let mutantScore = 0;
  for (let i = 0; i < MATCH_GAMES; i++) {
    const setupName = DEFAULT_SETUPS[i % DEFAULT_SETUPS.length].name;
    const mutantIsA = i % 2 === 0;
    const aColor: Color = 'silver';
    const outcome = playMatchGame(mutant, current, mutantIsA, setupName, aColor);
    mutantScore += outcome;
  }
  return mutantScore / MATCH_GAMES;
}

function playMatchGame(mutant: Weights, current: Weights, mutantIsA: boolean, setupName: string, aColor: Color): number {
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
