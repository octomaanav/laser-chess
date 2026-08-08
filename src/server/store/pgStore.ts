// Production backend: Postgres (Neon / Supabase / any DATABASE_URL). Setups and
// the admin secret are durable; rooms are written through on each move with an
// updated_at used for TTL cleanup, so in-progress games survive a restart.
import crypto from 'node:crypto';
import { Pool } from 'pg';
import type { SetupDef } from '../../game/types';
import type { PersistedRoom, Store } from './types';

export class PgStore implements Store {
  private pool: Pool;
  private ready: Promise<void>;

  constructor(connectionString: string) {
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    this.pool = new Pool({
      connectionString,
      ssl: local ? false : { rejectUnauthorized: false }, // Neon/Supabase need SSL
      max: 5,
    });
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.pool.query(`
      create table if not exists setups (
        name text primary key,
        pieces jsonb not null,
        updated_at timestamptz not null default now()
      );
      create table if not exists kv (
        key text primary key,
        value text not null
      );
      create table if not exists rooms (
        code text primary key,
        state jsonb not null,
        updated_at timestamptz not null default now()
      );
    `);
  }
  private async q(text: string, params?: unknown[]) {
    await this.ready;
    return this.pool.query(text, params as never);
  }

  async getCustomSetups(): Promise<Record<string, SetupDef>> {
    const r = await this.q('select name, pieces from setups');
    const out: Record<string, SetupDef> = {};
    for (const row of r.rows) out[row.name] = { name: row.name, pieces: row.pieces };
    return out;
  }
  async saveSetup(def: SetupDef): Promise<void> {
    await this.q(
      'insert into setups(name, pieces, updated_at) values($1, $2, now()) on conflict(name) do update set pieces = excluded.pieces, updated_at = now()',
      [def.name, JSON.stringify(def.pieces)],
    );
  }
  async deleteSetup(name: string): Promise<void> {
    await this.q('delete from setups where name = $1', [name]);
  }

  async getSecret(): Promise<string> {
    const r = await this.q('select value from kv where key = $1', ['admin:secret']);
    if (r.rows[0]?.value) return r.rows[0].value as string;
    const secret = crypto.randomBytes(32).toString('hex');
    await this.q('insert into kv(key, value) values($1, $2) on conflict(key) do nothing', ['admin:secret', secret]);
    const r2 = await this.q('select value from kv where key = $1', ['admin:secret']);
    return r2.rows[0].value as string;
  }

  async loadRoom(code: string): Promise<PersistedRoom | null> {
    const r = await this.q('select state from rooms where code = $1', [code]);
    return (r.rows[0]?.state as PersistedRoom) ?? null;
  }
  async saveRoom(room: PersistedRoom): Promise<void> {
    await this.q(
      'insert into rooms(code, state, updated_at) values($1, $2, now()) on conflict(code) do update set state = excluded.state, updated_at = now()',
      [room.code, JSON.stringify(room)],
    );
  }
  async deleteRoom(code: string): Promise<void> {
    await this.q('delete from rooms where code = $1', [code]);
  }
  async sweepRooms(maxAgeMs: number): Promise<void> {
    await this.q(`delete from rooms where updated_at < now() - ($1::bigint * interval '1 millisecond')`, [maxAgeMs]);
  }
}
