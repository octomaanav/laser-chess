import type { Action } from '../types';
import type { ZobristHash } from './zobrist';
import { hashKey } from './zobrist';

// Scoped to one search() call - created fresh per bot move, discarded
// after. Always-replace on collision: simplest policy, fine at this
// table's size (bounded by one search call's node count).
export type TTFlag = 'exact' | 'lower' | 'upper';

export interface TTEntry {
  depth: number;
  score: number;
  flag: TTFlag;
  // Absent for leaf (depth 0) entries, which have no "best move at this
  // node" concept - present for internal-node entries, used as a move-
  // ordering hint when this position is reached again.
  bestAction?: Action;
}

export type TranspositionTable = Map<string, TTEntry>;

export function createTable(): TranspositionTable {
  return new Map();
}

export function ttLookup(table: TranspositionTable, hash: ZobristHash): TTEntry | undefined {
  return table.get(hashKey(hash));
}

export function ttStore(table: TranspositionTable, hash: ZobristHash, entry: TTEntry): void {
  table.set(hashKey(hash), entry);
}
