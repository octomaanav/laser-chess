import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { enumerateActions } from '../game/bot/moveGen';
import type { Difficulty } from '../game/bot/types';
import type { Action, Color, GameState } from '../game/types';

const WORKER_FILE_URL = pathToFileURL(path.join(process.cwd(), 'src/server/botWorkerThread.ts')).href;
// Hard ceiling above the largest difficulty budget (hard = 3000ms), so a
// stuck search can never hang a room indefinitely.
const WORKER_TIMEOUT_MS = 5000;

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
  try {
    return await runInWorker(state, color, difficulty);
  } catch (e) {
    console.error('bot worker failed, falling back to a random legal move:', e);
    return randomFallback(state, color);
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
