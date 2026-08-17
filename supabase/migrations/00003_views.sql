-- 00003_views.sql
-- Helpful Views for Supabase Table Editor & Admin Dashboard

-- Real-time active rooms view
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

-- Recent matches view
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
