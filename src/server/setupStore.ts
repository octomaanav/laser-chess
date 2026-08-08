// Server-side access to starting configurations. Built-in defaults are always
// available; custom setups saved from the admin editor live in the Store
// (local files in dev, Postgres in prod) and override defaults by name.
import { DEFAULT_SETUPS, buildBoardFromDef } from '../game/setups';
import { getStore } from './store';
import type { GameState, SetupDef } from '../game/types';

export async function listSetups(): Promise<SetupDef[]> {
  const custom = await getStore().getCustomSetups();
  const map = new Map<string, SetupDef>();
  for (const d of DEFAULT_SETUPS) map.set(d.name, d);
  for (const k of Object.keys(custom)) map.set(k, custom[k]);
  return [...map.values()];
}

export async function getSetup(name: string): Promise<SetupDef | null> {
  return (await listSetups()).find((s) => s.name === name) ?? null;
}

export async function saveSetup(def: SetupDef): Promise<void> {
  await getStore().saveSetup(def);
}

export async function deleteSetup(name: string): Promise<void> {
  await getStore().deleteSetup(name);
}

export function isDefault(name: string): boolean {
  return DEFAULT_SETUPS.some((d) => d.name === name);
}

export async function createGame(name = 'Classic'): Promise<GameState> {
  const def = (await getSetup(name)) ?? (await getSetup('Classic')) ?? DEFAULT_SETUPS[0];
  return { setup: def.name, board: buildBoardFromDef(def), turn: 'silver', winner: null, moveCount: 0 };
}
