create table if not exists flip7_rooms (
  code text primary key,
  game_slug text not null default 'flip7',
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

create index if not exists idx_flip7_rooms_updated_at on flip7_rooms(updated_at);
