-- 00002_game_rooms_and_history.sql
-- Enriched live rooms with explicit player columns & permanent match history table

-- Live Laser Chess rooms (with dedicated columns for Supabase visibility)
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
  status text not null default 'waiting', -- 'waiting', 'in_progress', 'finished'
  winner_name text,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure existing legacy rooms tables gain the new columns if upgrading in-place
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

-- Live Coup rooms
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

-- Permanent Match History: Log every completed, surrendered, or timed out match
create table if not exists game_matches (
  id text primary key,
  game_slug text not null,
  room_code text not null,
  player1_name text,
  player1_user_id text references users(id) on delete set null,
  player2_name text,
  player2_user_id text references users(id) on delete set null,
  all_players jsonb not null default '[]'::jsonb, -- all player names/ids
  is_bot boolean not null default false,
  bot_difficulty text,
  is_ranked boolean not null default false,
  status text not null default 'completed', -- 'completed', 'forfeit', 'timeout', 'resigned'
  winner_name text,
  winner_color text, -- 'red', 'silver', or seat id
  winner_user_id text references users(id) on delete set null,
  moves_count int not null default 0,
  duration_seconds int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_game_matches_game on game_matches(game_slug, created_at desc);
create index if not exists idx_game_matches_players on game_matches(player1_user_id, player2_user_id);
create index if not exists idx_game_matches_created_at on game_matches(created_at desc);
