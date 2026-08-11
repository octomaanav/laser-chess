// Runs inside a worker_thread spawned by botWorker.ts. Receives one bot-move
// request via workerData, computes it, posts the result, and exits (one
// worker per request — simplest correct approach at this scale).
import { parentPort, workerData } from 'node:worker_threads';
import { chooseMove } from '../game/bot/bot';
import type { Difficulty } from '../game/bot/types';
import type { Action, Color, GameState } from '../game/types';

interface Request {
  state: GameState;
  color: Color;
  difficulty: Difficulty;
}

const { state, color, difficulty } = workerData as Request;

try {
  const action: Action = chooseMove(state, color, difficulty);
  parentPort!.postMessage({ action });
} catch (e) {
  parentPort!.postMessage({ error: String((e as Error).message || e) });
}
