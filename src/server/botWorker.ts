import { Worker } from 'node:worker_threads';
import { enumerateActions } from '../game/bot/moveGen';
import type { Difficulty } from '../game/bot/types';
import type { Action, Color, GameState } from '../game/types';

// Resolved relative to this module's own location (not process.cwd()) so
// worker spawning still works if the server process is ever started from a
// directory other than the repo root — a cwd-relative path would silently
// resolve to nothing, fail every worker spawn, and permanently fall back to
// random-move play (see randomFallback below) with only a console.error to
// notice.
const WORKER_FILE_URL = new URL('./botWorkerThread.ts', import.meta.url).href;
// Hard ceiling above the largest difficulty budget (hard = 3000ms), so a
// stuck search can never hang a room indefinitely.
const WORKER_TIMEOUT_MS = 5000;

// Simple concurrency cap: an unbounded number of hard-difficulty bot rooms
// (each spawning a full-CPU worker thread for up to 3s) could otherwise pin
// many cores at once with no human interaction required, since a bot seated
// on room creation moves automatically. Requests beyond the cap wait in a
// small in-memory queue for a slot rather than being rejected outright.
const MAX_CONCURRENT_SEARCHES = 8;
let inFlightSearches = 0;
const searchQueue: (() => void)[] = [];

async function acquireSearchSlot(): Promise<void> {
  if (inFlightSearches < MAX_CONCURRENT_SEARCHES) {
    inFlightSearches++;
    return;
  }
  await new Promise<void>((resolve) => searchQueue.push(resolve));
  inFlightSearches++;
}

function releaseSearchSlot(): void {
  inFlightSearches--;
  const next = searchQueue.shift();
  if (next) next();
}

// Consecutive-failure counter: a legitimate per-move search timeout is
// expected occasionally, but if worker construction itself is broken (bad
// path, missing tsx dependency, etc.) every single move fails and the bot
// silently plays random moves for the rest of the process's lifetime. Loudly
// flag that case instead of leaving it as one easy-to-miss console.error
// per move.
const CONSECUTIVE_FAILURE_ALERT_THRESHOLD = 5;
let consecutiveFailures = 0;

interface WorkerResult {
  action?: Action;
  error?: string;
}

// Node worker_threads do not inherit the parent's ESM loader hooks. The
// "obvious" fix — passing execArgv: ['--import', 'tsx/esm'] to the Worker
// constructor — does not actually work: Node resolves a worker's own
// entry-point module format before the --import hook is registered, so a
// .ts entry file still fails with ERR_UNKNOWN_FILE_EXTENSION. This is a
// known, unresolved Node limitation (nodejs/node#47747), not a bug in this
// code. The workaround is to give the worker a tiny inline bootstrap
// script (via `eval: true`) that registers tsx's ESM loader for *this
// thread* first, then dynamically imports the real .ts worker module —
// the dynamic import goes through the now-registered loader correctly,
// and because it all happens in the same thread, workerData/parentPort
// work exactly as if the .ts file had been the entry point directly.
const TSX_API_URL = import.meta.resolve('tsx/esm/api');

function bootstrapScript(targetUrl: string): string {
  return [
    `import { register } from ${JSON.stringify(TSX_API_URL)};`,
    'register();',
    `await import(${JSON.stringify(targetUrl)});`,
  ].join('\n');
}

export async function requestBotMove(state: GameState, color: Color, difficulty: Difficulty): Promise<Action> {
  await acquireSearchSlot();
  try {
    const action = await runInWorker(state, color, difficulty);
    consecutiveFailures = 0;
    return action;
  } catch (e) {
    consecutiveFailures++;
    console.error(
      `bot worker failed (worker file: ${WORKER_FILE_URL}, consecutive failures: ${consecutiveFailures}), falling back to a random legal move:`,
      e,
    );
    if (consecutiveFailures === CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
      console.error(
        `bot worker appears permanently broken: ${consecutiveFailures} consecutive failures. ` +
          'Every bot move is falling back to random play. Check that the worker file path ' +
          `resolves correctly (${WORKER_FILE_URL}) and that the tsx dependency is available.`,
      );
    }
    return randomFallback(state, color);
  } finally {
    releaseSearchSlot();
  }
}

function runInWorker(state: GameState, color: Color, difficulty: Difficulty): Promise<Action> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(bootstrapScript(WORKER_FILE_URL), {
      eval: true,
      workerData: { state, color, difficulty },
    });

    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('bot worker timed out'));
    }, WORKER_TIMEOUT_MS);

    worker.once('message', (msg: WorkerResult) => {
      clearTimeout(timer);
      worker.terminate();
      if (msg.error) reject(new Error(msg.error));
      else if (msg.action) resolve(msg.action);
      else reject(new Error('bot worker returned no action'));
    });
    worker.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function randomFallback(state: GameState, color: Color): Action {
  const actions = enumerateActions(state, color);
  if (actions.length === 0) throw new Error('no legal actions available for bot fallback');
  return actions[(Math.random() * actions.length) | 0];
}
