// Production backend: Postgres (Neon / Supabase / any DATABASE_URL). Setups and
// the admin secret are durable; rooms are written through on each move with an
// updated_at used for TTL cleanup, so in-progress games survive a restart.
import crypto from 'node:crypto';
import { Pool } from 'pg';
import type { SetupDef } from '../../game/types';
import type { OAuthIdentity, PersistedCoupRoom, PersistedRoom, Store, User } from './types';

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
      create table if not exists coup_rooms (
        code text primary key,
        state jsonb not null,
        updated_at timestamptz not null default now()
      );
      create table if not exists users (
        id text primary key,
        email text unique not null,
        username text unique not null,
        display_name text not null,
        password_hash text,
        created_at timestamptz not null default now()
      );
      create table if not exists identities (
        provider text not null,
        provider_id text not null,
        user_id text not null references users(id) on delete cascade,
        primary key (provider, provider_id)
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

  async loadCoupRoom(code: string): Promise<PersistedCoupRoom | null> {
    const r = await this.q('select state from coup_rooms where code = $1', [code]);
    return (r.rows[0]?.state as PersistedCoupRoom) ?? null;
  }
  async saveCoupRoom(room: PersistedCoupRoom): Promise<void> {
    await this.q(
      'insert into coup_rooms(code, state, updated_at) values($1, $2, now()) on conflict(code) do update set state = excluded.state, updated_at = now()',
      [room.code, JSON.stringify(room)],
    );
  }
  async deleteCoupRoom(code: string): Promise<void> {
    await this.q('delete from coup_rooms where code = $1', [code]);
  }
  async sweepCoupRooms(maxAgeMs: number): Promise<void> {
    await this.q(`delete from coup_rooms where updated_at < now() - ($1::bigint * interval '1 millisecond')`, [maxAgeMs]);
  }

  private rowToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      username: row.username as string,
      displayName: row.display_name as string,
      passwordHash: (row.password_hash as string | null) ?? null,
      createdAt: new Date(row.created_at as string).getTime(),
    };
  }
  async createUser(user: User): Promise<void> {
    await this.q(
      'insert into users(id, email, username, display_name, password_hash, created_at) values($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))',
      [user.id, user.email, user.username, user.displayName, user.passwordHash, user.createdAt],
    );
  }
  async getUserById(id: string): Promise<User | null> {
    const r = await this.q('select * from users where id = $1', [id]);
    return r.rows[0] ? this.rowToUser(r.rows[0]) : null;
  }
  async getUserByEmail(email: string): Promise<User | null> {
    const r = await this.q('select * from users where email = $1', [email.toLowerCase()]);
    return r.rows[0] ? this.rowToUser(r.rows[0]) : null;
  }
  async getUserByUsername(username: string): Promise<User | null> {
    const r = await this.q('select * from users where username = $1', [username.toLowerCase()]);
    return r.rows[0] ? this.rowToUser(r.rows[0]) : null;
  }
  async updateUser(id: string, patch: Partial<Pick<User, 'username' | 'displayName' | 'passwordHash'>>): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (patch.username !== undefined) sets.push(`username = $${sets.length + 1}`), vals.push(patch.username);
    if (patch.displayName !== undefined) sets.push(`display_name = $${sets.length + 1}`), vals.push(patch.displayName);
    if (patch.passwordHash !== undefined) sets.push(`password_hash = $${sets.length + 1}`), vals.push(patch.passwordHash);
    if (!sets.length) return;
    vals.push(id);
    await this.q(`update users set ${sets.join(', ')} where id = $${vals.length}`, vals);
  }
  async getUserByIdentity(provider: string, providerId: string): Promise<User | null> {
    const r = await this.q(
      'select u.* from users u join identities i on i.user_id = u.id where i.provider = $1 and i.provider_id = $2',
      [provider, providerId],
    );
    return r.rows[0] ? this.rowToUser(r.rows[0]) : null;
  }
  async linkIdentity(identity: OAuthIdentity): Promise<void> {
    await this.q(
      'insert into identities(provider, provider_id, user_id) values($1, $2, $3) on conflict(provider, provider_id) do nothing',
      [identity.provider, identity.providerId, identity.userId],
    );
  }
  async listIdentities(userId: string): Promise<OAuthIdentity[]> {
    const r = await this.q('select provider, provider_id, user_id from identities where user_id = $1', [userId]);
    return r.rows.map((row) => ({ provider: row.provider, providerId: row.provider_id, userId: row.user_id }));
  }
}
