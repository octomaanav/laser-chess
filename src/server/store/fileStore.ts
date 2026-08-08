// Local-dev backend: setups + admin secret in ./data/*.json. Rooms are not
// persisted in dev (kept in memory, as before) — that only matters in prod.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SetupDef } from '../../game/types';
import type { PersistedRoom, Store } from './types';

const dir = () => path.join(process.cwd(), 'data');
const setupsFile = () => path.join(dir(), 'setups.json');
const secretFile = () => path.join(dir(), 'adminSecret.json');

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}
function writeJSON(file: string, obj: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

export class FileStore implements Store {
  async getCustomSetups(): Promise<Record<string, SetupDef>> {
    return readJSON<Record<string, SetupDef>>(setupsFile(), {});
  }
  async saveSetup(def: SetupDef): Promise<void> {
    const c = readJSON<Record<string, SetupDef>>(setupsFile(), {});
    c[def.name] = def;
    writeJSON(setupsFile(), c);
  }
  async deleteSetup(name: string): Promise<void> {
    const c = readJSON<Record<string, SetupDef>>(setupsFile(), {});
    delete c[name];
    writeJSON(setupsFile(), c);
  }
  async getSecret(): Promise<string> {
    const s = readJSON<{ sessionSecret?: string }>(secretFile(), {});
    if (s.sessionSecret) return s.sessionSecret;
    const secret = crypto.randomBytes(32).toString('hex');
    writeJSON(secretFile(), { sessionSecret: secret });
    return secret;
  }
  // rooms: not persisted in dev
  async loadRoom(): Promise<PersistedRoom | null> {
    return null;
  }
  async saveRoom(): Promise<void> {}
  async deleteRoom(): Promise<void> {}
  async sweepRooms(): Promise<void> {}
}
