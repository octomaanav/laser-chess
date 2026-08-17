import crypto from 'node:crypto';
import { Pool } from 'pg';
import type { SetupDef } from '../../game/types';
import { DEFAULT_RATING, MAX_RATING } from '../../game/ranking';
import { runMigrations } from './migrations';
import type {
  ActiveRoomSummary,
  FriendEdge,
  GameMatch,
  OAuthIdentity,
  PersistedCoupRoom,
  PersistedRoom,
  PlayerRating,
  Store,
  User,
} from './types';

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
    try {
      await runMigrations(this.pool);
    } catch (e) {
      console.error('[PgStore] Migration failed during startup:', e);
    }
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
    const isBot = !!(room.botDifficulty?.red || room.botDifficulty?.silver);
    const botDifficulty = room.botDifficulty?.red || room.botDifficulty?.silver || null;
    const isRanked = !!room.isRanked;
    const hostName = room.names.red || room.names.silver || 'Host';
    const hostUserId = (room.seats.red && room.rankedUserIds?.red) || (room.seats.silver && room.rankedUserIds?.silver) || null;
    const playerCount = (room.seats.red ? 1 : 0) + (room.seats.silver ? 1 : 0);

    let status = 'waiting';
    if (room.game?.winner) status = 'finished';
    else if (room.seats.red && room.seats.silver) status = 'in_progress';

    const winnerName = room.game?.winner ? room.names[room.game.winner] ?? room.game.winner : null;

    await this.q(
      `insert into rooms(
        code, game_slug, host_name, host_user_id, player_names, player_count,
        is_ranked, is_bot, bot_difficulty, status, winner_name, state, updated_at
      ) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
      on conflict(code) do update set
        host_name = excluded.host_name,
        host_user_id = excluded.host_user_id,
        player_names = excluded.player_names,
        player_count = excluded.player_count,
        is_ranked = excluded.is_ranked,
        is_bot = excluded.is_bot,
        bot_difficulty = excluded.bot_difficulty,
        status = excluded.status,
        winner_name = excluded.winner_name,
        state = excluded.state,
        updated_at = now()`,
      [
        room.code,
        room.rankedGameSlug || 'laser-chess',
        hostName,
        hostUserId,
        JSON.stringify(room.names),
        playerCount,
        isRanked,
        isBot,
        botDifficulty,
        status,
        winnerName,
        JSON.stringify(room),
      ],
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
    const playerNamesArray = Object.values(room.names);
    const hostName = playerNamesArray[0] || 'Host';
    const playerCount = room.seats.length;
    let status = 'waiting';
    let winnerName: string | null = null;
    if (room.state) {
      status = room.state.winner ? 'finished' : 'in_progress';
      if (room.state.winner) {
        winnerName = room.names[room.state.winner] || room.state.winner;
      }
    }

    await this.q(
      `insert into coup_rooms(
        code, game_slug, host_name, player_names, player_count, status, winner_name, state, updated_at
      ) values($1, $2, $3, $4, $5, $6, $7, $8, now())
      on conflict(code) do update set
        host_name = excluded.host_name,
        player_names = excluded.player_names,
        player_count = excluded.player_count,
        status = excluded.status,
        winner_name = excluded.winner_name,
        state = excluded.state,
        updated_at = now()`,
      [
        room.code,
        'coup',
        hostName,
        JSON.stringify(playerNamesArray),
        playerCount,
        status,
        winnerName,
        JSON.stringify(room),
      ],
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

  async createFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
    await this.q(
      'insert into friendships(requester_id, addressee_id, status) values($1, $2, $3) on conflict do nothing',
      [requesterId, addresseeId, 'pending'],
    );
  }
  async acceptFriendRequest(addresseeId: string, requesterId: string): Promise<void> {
    await this.q(
      "update friendships set status = 'accepted', updated_at = now() where requester_id = $1 and addressee_id = $2 and status = 'pending'",
      [requesterId, addresseeId],
    );
  }
  async deleteFriendship(userId: string, otherId: string): Promise<void> {
    await this.q(
      'delete from friendships where (requester_id = $1 and addressee_id = $2) or (requester_id = $2 and addressee_id = $1)',
      [userId, otherId],
    );
  }
  async listFriendships(userId: string): Promise<FriendEdge[]> {
    const r = await this.q('select requester_id, addressee_id, status from friendships where requester_id = $1 or addressee_id = $1', [userId]);
    return r.rows.map((row) => ({
      otherId: row.requester_id === userId ? row.addressee_id : row.requester_id,
      status: row.status,
      direction: row.requester_id === userId ? 'outgoing' : 'incoming',
    }));
  }

  async getRating(userId: string, gameSlug: string): Promise<PlayerRating | null> {
    const r = await this.q(
      'select user_id, game_slug, rating, peak_rating, wins, losses, updated_at from player_ratings where user_id = $1 and game_slug = $2',
      [userId, gameSlug],
    );
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return {
      userId: row.user_id,
      gameSlug: row.game_slug,
      rating: row.rating,
      peakRating: row.peak_rating,
      wins: row.wins,
      losses: row.losses,
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  async upsertRating(rt: PlayerRating): Promise<void> {
    await this.q(
      `insert into player_ratings(user_id, game_slug, rating, peak_rating, wins, losses, updated_at)
       values($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
       on conflict(user_id, game_slug) do update set
         rating = excluded.rating,
         peak_rating = excluded.peak_rating,
         wins = excluded.wins,
         losses = excluded.losses,
         updated_at = excluded.updated_at`,
      [rt.userId, rt.gameSlug, rt.rating, rt.peakRating, rt.wins, rt.losses, rt.updatedAt],
    );
  }

  // ---- Game Matches / Match History -----------------------------------------
  async recordMatch(match: GameMatch): Promise<void> {
    await this.q(
      `insert into game_matches(
        id, game_slug, room_code, player1_name, player1_user_id,
        player2_name, player2_user_id, all_players, is_bot, bot_difficulty,
        is_ranked, status, winner_name, winner_color, winner_user_id,
        moves_count, duration_seconds, started_at, ended_at, created_at
      ) values(
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17,
        to_timestamp($18 / 1000.0), to_timestamp($19 / 1000.0), now()
      ) on conflict(id) do update set
        status = excluded.status,
        winner_name = excluded.winner_name,
        winner_color = excluded.winner_color,
        moves_count = excluded.moves_count,
        duration_seconds = excluded.duration_seconds,
        ended_at = excluded.ended_at`,
      [
        match.id,
        match.gameSlug,
        match.roomCode,
        match.player1Name ?? null,
        match.player1UserId ?? null,
        match.player2Name ?? null,
        match.player2UserId ?? null,
        JSON.stringify(match.allPlayers ?? []),
        !!match.isBot,
        match.botDifficulty ?? null,
        !!match.isRanked,
        match.status,
        match.winnerName ?? null,
        match.winnerColor ?? null,
        match.winnerUserId ?? null,
        match.movesCount || 0,
        match.durationSeconds || 0,
        match.startedAt || Date.now(),
        match.endedAt || Date.now(),
      ],
    );
  }

  async getRecentMatches(limit = 50): Promise<GameMatch[]> {
    const r = await this.q(
      `select id, game_slug, room_code, player1_name, player1_user_id,
              player2_name, player2_user_id, all_players, is_bot, bot_difficulty,
              is_ranked, status, winner_name, winner_color, winner_user_id,
              moves_count, duration_seconds, started_at, ended_at, created_at
       from game_matches
       order by created_at desc
       limit $1`,
      [limit],
    );

    return r.rows.map((row) => ({
      id: row.id,
      gameSlug: row.game_slug,
      roomCode: row.room_code,
      player1Name: row.player1_name,
      player1UserId: row.player1_user_id,
      player2Name: row.player2_name,
      player2UserId: row.player2_user_id,
      allPlayers: row.all_players,
      isBot: row.is_bot,
      botDifficulty: row.bot_difficulty,
      isRanked: row.is_ranked,
      status: row.status,
      winnerName: row.winner_name,
      winnerColor: row.winner_color,
      winnerUserId: row.winner_user_id,
      movesCount: row.moves_count,
      durationSeconds: row.duration_seconds,
      startedAt: new Date(row.started_at).getTime(),
      endedAt: new Date(row.ended_at).getTime(),
      createdAt: new Date(row.created_at).getTime(),
    }));
  }

  async getActiveRooms(): Promise<ActiveRoomSummary[]> {
    const r = await this.q(`
      select code, game_slug, host_name, player_names, player_count, is_bot, bot_difficulty, is_ranked, status, updated_at
      from rooms
      where updated_at > now() - interval '2 hours'
      union all
      select code, game_slug, host_name, player_names, player_count, false as is_bot, null as bot_difficulty, false as is_ranked, status, updated_at
      from coup_rooms
      where updated_at > now() - interval '2 hours'
      order by updated_at desc
    `);

    return r.rows.map((row) => ({
      code: row.code,
      gameSlug: row.game_slug,
      hostName: row.host_name,
      playerNames: row.player_names,
      playerCount: Number(row.player_count) || 0,
      isBot: !!row.is_bot,
      botDifficulty: row.bot_difficulty,
      isRanked: !!row.is_ranked,
      status: row.status,
      updatedAt: new Date(row.updated_at).getTime(),
    }));
  }
}
