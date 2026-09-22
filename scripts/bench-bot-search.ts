// scripts/bench-bot-search.ts
// One-off local tool - NOT wired to package.json, NOT imported by production
// code. Run manually: npx tsx scripts/bench-bot-search.ts
//
// Measures depthReached for search() at a fixed time budget across every
// default starting setup. Run once before the search upgrades (transposition
// table, quiescence search, TT move ordering) and once after, to compare -
// "does the search reach a greater depth for the same time budget" is the
// strength signal the design doc calls for, independent of any eval-weight
// changes (none are made by this plan).
import { search } from '../src/game/bot/search';
import { createGameFromDef, DEFAULT_SETUPS } from '../src/game/setups';

const BUDGET_MS = 2000;

function bench(setupName: string) {
  const def = DEFAULT_SETUPS.find((d) => d.name === setupName)!;
  const state = createGameFromDef(def);
  const deadline = Date.now() + BUDGET_MS;
  const start = Date.now();
  const { depthReached } = search(state, 'silver', deadline);
  const elapsed = Date.now() - start;
  console.log(`${setupName}: depthReached=${depthReached} elapsed=${elapsed}ms`);
}

for (const def of DEFAULT_SETUPS) {
  bench(def.name);
}
