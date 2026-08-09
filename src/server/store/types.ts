// Storage abstraction. Two backends implement this: a file backend (local dev,
// zero setup) and a Postgres backend (production, via DATABASE_URL).
import type { Color, GameState, SetupDef } from '../../game/types';

export interface PersistedRoom {
  code: string;
  game: GameState;
  seats: { red: string | null; silver: string | null };
  names: { red: string | null; silver: string | null };
  perMoveMs: number;
  forfeitColor?: Color | null; // a disconnected player with a running forfeit clock
  forfeitDeadline?: number | null; // epoch ms the forfeit fires (survives restart)
}

export interface Store {
  // custom starting configurations (defaults are merged in by the caller)
  getCustomSetups(): Promise<Record<string, SetupDef>>;
  saveSetup(def: SetupDef): Promise<void>;
  deleteSetup(name: string): Promise<void>;

  // admin session-cookie signing secret (created on first use)
  getSecret(): Promise<string>;

  // live game rooms (so games survive a server restart / redeploy / sleep)
  loadRoom(code: string): Promise<PersistedRoom | null>;
  saveRoom(room: PersistedRoom): Promise<void>;
  deleteRoom(code: string): Promise<void>;
  sweepRooms(maxAgeMs: number): Promise<void>;
}
