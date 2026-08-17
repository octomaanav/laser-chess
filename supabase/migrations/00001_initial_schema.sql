-- 00001_initial_schema.sql
-- Baseline schema for Game Night platform: configurations, accounts, identities, friendships, ratings

-- Key-value store for global settings (e.g., admin secret)
create table if not exists kv (
  key text primary key,
  value text not null
);

-- Board configurations / custom setups
create table if not exists setups (
  name text primary key,
  pieces jsonb not null,
  updated_at timestamptz not null default now()
);

-- User accounts
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

-- External OAuth identities (Google, GitHub, etc.)
create table if not exists identities (
  provider text not null,
  provider_id text not null,
  user_id text not null references users(id) on delete cascade,
  primary key (provider, provider_id)
);

create index if not exists idx_identities_user_id on identities(user_id);

-- Friendships & requests
create table if not exists friendships (
  requester_id text not null references users(id) on delete cascade,
  addressee_id text not null references users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id)
);

create unique index if not exists friendships_pair
  on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists idx_friendships_lookup on friendships(requester_id, addressee_id, status);

-- Per-game player skill ratings & rank indices
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

create index if not exists idx_player_ratings_game on player_ratings(game_slug, rating desc);
