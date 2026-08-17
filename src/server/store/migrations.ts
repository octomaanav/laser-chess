// src/server/store/migrations.ts
// Robust, idempotent PostgreSQL migration runner for Supabase
import type { Pool } from 'pg';

export interface Migration {
  id: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '00001_initial_schema',
    sql: `
      create table if not exists kv (
        key text primary key,
        value text not null
      );
      create table if not exists setups (
        name text primary key,
        pieces jsonb not null,
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
      create index if not exists idx_users_email on users(email);
      create index if not exists idx_users_username on users(username);

      create table if not exists identities (
        provider text not null,
        provider_id text not null,
        user_id text not null references users(id) on delete cascade,
        primary key (provider, provider_id)
      );
      create index if not exists idx_identities_user_id on identities(user_id);

      create table if not exists friendships (
        requester_id text not null references users(id) on delete cascade,
        addressee_id text not null references users(id) on delete cascade,
        status text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (requester_id, addressee_id)
      );
      create unique index if not exists friendships_pair
        on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

      create table if not exists player_ratings (
        user_id text not null references users(id) on delete cascade,
        game_slug text not null,
        rating int not null default 0,
        peak_rating int not null default 0,
        wins int not null default 0,
        losses int not null default 0,
        updated_at timestamptz not null default now(),
        primary key (user_id, game_slug)
      );
    `,
  },
  {
    id: '00002_game_rooms_and_history',
    sql: `
      create table if not exists rooms (
        code text primary key,
        game_slug text not null default 'laser-chess',
        host_name text,
        host_user_id text references users(id) on delete set null,
        player_names jsonb not null default '{"red": null, "silver": null}'::jsonb,
        player_count int not null default 0,
        is_ranked boolean not null default false,
        is_bot boolean not null default false,
        bot_difficulty text,
        status text not null default 'waiting',
        winner_name text,
        state jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      alter table rooms add column if not exists game_slug text not null default 'laser-chess';
      alter table rooms add column if not exists host_name text;
      alter table rooms add column if not exists host_user_id text references users(id) on delete set null;
      alter table rooms add column if not exists player_names jsonb not null default '{"red": null, "silver": null}'::jsonb;
      alter table rooms add column if not exists player_count int not null default 0;
      alter table rooms add column if not exists is_ranked boolean not null default false;
      alter table rooms add column if not exists is_bot boolean not null default false;
      alter table rooms add column if not exists bot_difficulty text;
      alter table rooms add column if not exists status text not null default 'waiting';
      alter table rooms add column if not exists winner_name text;
      alter table rooms add column if not exists created_at timestamptz not null default now();

      create index if not exists idx_rooms_updated_at on rooms(updated_at);
      create index if not exists idx_rooms_status on rooms(status);

      create table if not exists coup_rooms (
        code text primary key,
        game_slug text not null default 'coup',
        host_name text,
        host_user_id text references users(id) on delete set null,
        player_names jsonb not null default '[]'::jsonb,
        player_count int not null default 0,
        status text not null default 'waiting',
        winner_name text,
        state jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      alter table coup_rooms add column if not exists game_slug text not null default 'coup';
      alter table coup_rooms add column if not exists host_name text;
      alter table coup_rooms add column if not exists host_user_id text references users(id) on delete set null;
      alter table coup_rooms add column if not exists player_names jsonb not null default '[]'::jsonb;
      alter table coup_rooms add column if not exists player_count int not null default 0;
      alter table coup_rooms add column if not exists status text not null default 'waiting';
      alter table coup_rooms add column if not exists winner_name text;
      alter table coup_rooms add column if not exists created_at timestamptz not null default now();

      create index if not exists idx_coup_rooms_updated_at on coup_rooms(updated_at);

      create table if not exists game_matches (
        id text primary key,
        game_slug text not null,
        room_code text not null,
        player1_name text,
        player1_user_id text references users(id) on delete set null,
        player2_name text,
        player2_user_id text references users(id) on delete set null,
        all_players jsonb not null default '[]'::jsonb,
        is_bot boolean not null default false,
        bot_difficulty text,
        is_ranked boolean not null default false,
        status text not null default 'completed',
        winner_name text,
        winner_color text,
        winner_user_id text references users(id) on delete set null,
        moves_count int not null default 0,
        duration_seconds int not null default 0,
        started_at timestamptz not null default now(),
        ended_at timestamptz not null default now(),
        created_at timestamptz not null default now()
      );

      create index if not exists idx_game_matches_game on game_matches(game_slug, created_at desc);
      create index if not exists idx_game_matches_created_at on game_matches(created_at desc);
    `,
  },
  {
    id: '00003_views',
    sql: `
      create or replace view v_active_rooms as
      select
        code,
        game_slug,
        host_name,
        player_names,
        player_count,
        is_bot,
        bot_difficulty,
        is_ranked,
        status,
        updated_at,
        created_at
      from rooms
      where updated_at > now() - interval '2 hours'
      order by updated_at desc;

      create or replace view v_recent_matches as
      select
        id,
        game_slug,
        room_code,
        player1_name,
        player2_name,
        is_bot,
        bot_difficulty,
        is_ranked,
        winner_name,
        winner_color,
        moves_count,
        duration_seconds,
        status,
        created_at
      from game_matches
      order by created_at desc
      limit 100;
    `,
  },
];

export async function runMigrations(pool: Pool): Promise<{ applied: string[]; alreadyApplied: string[] }> {
  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await pool.query<{ version: string }>('select version from schema_migrations');
  const appliedSet = new Set(rows.map((r) => r.version));

  const applied: string[] = [];
  const alreadyApplied: string[] = [];

  for (const mig of MIGRATIONS) {
    if (appliedSet.has(mig.id)) {
      alreadyApplied.push(mig.id);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(mig.sql);
      await client.query('insert into schema_migrations(version, applied_at) values($1, now())', [mig.id]);
      await client.query('commit');
      applied.push(mig.id);
      console.log(`[db:migrate] Successfully applied migration: ${mig.id}`);
    } catch (err) {
      await client.query('rollback');
      console.error(`[db:migrate] Failed applying migration: ${mig.id}`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  return { applied, alreadyApplied };
}
