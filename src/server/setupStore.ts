// Server-side store for starting configurations. Built-in defaults are always
// available; custom setups saved from the admin editor are persisted to
// data/setups.json and override defaults by name. Both the WebSocket game
// server and the /api/setups route go through this file, and the JSON file is
// the shared source of truth, so they stay consistent.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETUPS, buildBoardFromDef } from '../game/setups';
import type { GameState, SetupDef } from '../game/types';

const FILE = path.join(process.cwd(), 'data', 'setups.json');

function readCustom(): Record<string, SetupDef> {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeCustom(obj: Record<string, SetupDef>) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

export function listSetups(): SetupDef[] {
  const custom = readCustom();
  const map = new Map<string, SetupDef>();
  for (const d of DEFAULT_SETUPS) map.set(d.name, d);
  for (const k of Object.keys(custom)) map.set(k, custom[k]);
  return [...map.values()];
}

export function getSetup(name: string): SetupDef | null {
  return listSetups().find((s) => s.name === name) ?? null;
}

export function saveSetup(def: SetupDef) {
  const custom = readCustom();
  custom[def.name] = def;
  writeCustom(custom);
}

export function deleteSetup(name: string) {
  const custom = readCustom();
  delete custom[name];
  writeCustom(custom);
}

export function isDefault(name: string): boolean {
  return DEFAULT_SETUPS.some((d) => d.name === name);
}

export function createGame(name = 'Classic'): GameState {
  const def = getSetup(name) ?? getSetup('Classic') ?? DEFAULT_SETUPS[0];
  return { setup: def.name, board: buildBoardFromDef(def), turn: 'silver', winner: null, moveCount: 0 };
}
