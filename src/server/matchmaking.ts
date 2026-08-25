// In-memory matchmaking queue. Lives in the same process as the game server so
// it can call createRankedRoom() directly and push notifications via socialHub.
// Uses the same globalThis singleton pattern as socialHub to survive module
// hot-reload in dev without losing queued players.
import { socialHub } from './social/socialHub';
import type { SocialUser } from './social/types';

export interface QueueEntry {
  userId: string;
  displayName: string;
  username: string;
  rating: number;   // rank index (0–15)
  joinedAt: number;
  gameSlug: string;
}

export interface PendingMatch {
  code: string;
  gameSlug: string;
  opponent: SocialUser;
  createdAt: number;
}

const PENDING_TTL_MS = 5 * 60_000;

// Rank-window policy. Players are paired with their exact rank first; the
// tolerance only opens up the longer they wait, so a full queue stays
// rank-pure while a near-empty one still finds someone.
const STRICT_MS = 20_000;   // same-rank-only phase
const EXPAND_MS = 20_000;   // then +1 rank of tolerance per interval
const ANY_RANK_MS = 45_000; // past this, any opponent beats no opponent
const SMALL_QUEUE = 4;      // at or below this many waiting, everything halves

// Bot backfill threshold: if no real human match is found after 10s, match with a bot.
export const BOT_BACKFILL_DELAY_MS = 10_000;

// Curated realistic human gamer names for matchmaking bots
export const MATCHMAKING_BOT_PROFILES: { displayName: string; username: string }[] = [
  { displayName: 'Elena Rostova', username: 'elena_r' },
  { displayName: 'Marcus Vance', username: 'marcus_v' },
  { displayName: 'Samira Khan', username: 'samira_k' },
  { displayName: 'Oliver Pratt', username: 'oliver_p' },
  { displayName: 'Sophia Miller', username: 'sophia_m' },
  { displayName: 'Leo Zhang', username: 'leo_zhang' },
  { displayName: 'Maya Chen', username: 'maya_chen' },
  { displayName: 'Lucas Sterling', username: 'lucas_s' },
  { displayName: 'Chloe Bennett', username: 'chloe_b' },
  { displayName: 'Daniel Torres', username: 'daniel_t' },
  { displayName: 'Aria Thorne', username: 'aria_t' },
  { displayName: 'Kai Takahashi', username: 'kai_t' },
  { displayName: 'Zoe Patel', username: 'zoe_patel' },
  { displayName: 'Ethan Brooks', username: 'ethan_b' },
  { displayName: 'Gabriel Silva', username: 'gabriel_s' },
];

export function getBotDifficultyForRating(rating: number): 'easy' | 'medium' | 'hard' {
  if (rating <= 4) return 'easy';
  if (rating <= 9) return 'medium';
  return 'hard';
}

// How far from their own rank a player is currently willing to be matched.
export function rankTolerance(waitMs: number, queueSize: number): number {
  const scale = queueSize <= SMALL_QUEUE ? 0.5 : 1;
  if (waitMs >= ANY_RANK_MS * scale) return Number.POSITIVE_INFINITY;
  const strict = STRICT_MS * scale;
  if (waitMs < strict) return 0;
  return 1 + Math.floor((waitMs - strict) / (EXPAND_MS * scale));
}

// Per-slug factory registry - avoids circular deps (matchmaking → gameServer → matchmaking).
type CreateRankedRoomFn = (redUserId: string, silverUserId: string, gameSlug: string) => Promise<string>;
type CreateRankedBotRoomFn = (
  humanUserId: string,
  humanColor: 'red' | 'silver',
  botDifficulty: 'easy' | 'medium' | 'hard',
  botName: string,
  gameSlug: string
) => Promise<string>;

const _factories = new Map<string, CreateRankedRoomFn>();
const _botFactories = new Map<string, CreateRankedBotRoomFn>();

export function registerCreateRankedRoom(gameSlug: string, fn: CreateRankedRoomFn) {
  _factories.set(gameSlug, fn);
}

export function registerCreateRankedBotRoom(gameSlug: string, fn: CreateRankedBotRoomFn) {
  _botFactories.set(gameSlug, fn);
}

class MatchmakingQueue {
  private queue = new Map<string, QueueEntry>();
  private pending = new Map<string, PendingMatch>();
  private reserving = new Set<string>();

  joinQueue(userId: string, displayName: string, username: string, rating: number, gameSlug: string) {
    this.pending.delete(userId);
    if (this.queue.has(userId) || this.reserving.has(userId)) return;
    this.queue.set(userId, { userId, displayName, username, rating, joinedAt: Date.now(), gameSlug });
  }

  leaveQueue(userId: string) {
    this.queue.delete(userId);
    this.pending.delete(userId);
  }

  isQueued(userId: string): boolean {
    return this.queue.has(userId) || this.reserving.has(userId);
  }

  takePendingMatch(userId: string): PendingMatch | null {
    const m = this.pending.get(userId);
    if (!m) return null;
    this.pending.delete(userId);
    return m;
  }

  getQueueSize(gameSlug: string): number {
    let count = 0;
    for (const e of this.queue.values()) if (e.gameSlug === gameSlug) count++;
    return count;
  }

  async tick() {
    const now = Date.now();

    for (const [userId, m] of this.pending) {
      if (now - m.createdAt > PENDING_TTL_MS) this.pending.delete(userId);
    }

    // Group by slug
    const bySlug = new Map<string, QueueEntry[]>();
    for (const entry of this.queue.values()) {
      const list = bySlug.get(entry.gameSlug) ?? [];
      list.push(entry);
      bySlug.set(entry.gameSlug, list);
    }

    const matched: [QueueEntry, QueueEntry][] = [];
    const unmatched: QueueEntry[] = [];

    for (const [slug, entries] of bySlug) {
      if (!_factories.has(slug) && !_botFactories.has(slug)) continue;
      const pairs = _factories.has(slug) ? pairEntries(entries, now) : [];
      matched.push(...pairs);

      const pairedIds = new Set(pairs.flatMap(([a, b]) => [a.userId, b.userId]));
      for (const entry of entries) {
        if (!pairedIds.has(entry.userId)) {
          unmatched.push(entry);
        }
      }
    }

    // 1. Resolve human-vs-human matches (priority)
    for (const [a, b] of matched) {
      const factory = _factories.get(a.gameSlug);
      if (!factory) continue;

      this.queue.delete(a.userId);
      this.queue.delete(b.userId);
      this.reserving.add(a.userId);
      this.reserving.add(b.userId);

      try {
        const [red, silver] = Math.random() < 0.5 ? [a, b] : [b, a];
        const code = await factory(red.userId, silver.userId, a.gameSlug);

        const toSocialUser = (e: QueueEntry): SocialUser => ({
          id: e.userId, username: e.username, displayName: e.displayName,
        });

        this.pending.set(a.userId, { code, gameSlug: a.gameSlug, opponent: toSocialUser(b), createdAt: now });
        this.pending.set(b.userId, { code, gameSlug: a.gameSlug, opponent: toSocialUser(a), createdAt: now });

        socialHub.notify(a.userId, { type: 'ranked-matched', code, gameSlug: a.gameSlug, opponent: toSocialUser(b) });
        socialHub.notify(b.userId, { type: 'ranked-matched', code, gameSlug: a.gameSlug, opponent: toSocialUser(a) });
      } catch (err) {
        console.error('[matchmaking] failed to create ranked room:', err);
        this.queue.set(a.userId, a);
        this.queue.set(b.userId, b);
      } finally {
        this.reserving.delete(a.userId);
        this.reserving.delete(b.userId);
      }
    }

    // 2. Resolve bot backfill for players waiting >= BOT_BACKFILL_DELAY_MS
    for (const entry of unmatched) {
      const botFactory = _botFactories.get(entry.gameSlug);
      if (!botFactory) continue;

      const waitTime = now - entry.joinedAt;
      if (waitTime < BOT_BACKFILL_DELAY_MS) continue;

      this.queue.delete(entry.userId);
      this.reserving.add(entry.userId);

      try {
        const difficulty = getBotDifficultyForRating(entry.rating);
        const botProfile = MATCHMAKING_BOT_PROFILES[Math.floor(Math.random() * MATCHMAKING_BOT_PROFILES.length)];
        const humanColor = Math.random() < 0.5 ? 'red' : 'silver';

        const code = await botFactory(
          entry.userId,
          humanColor,
          difficulty,
          botProfile.displayName,
          entry.gameSlug
        );

        const botUser: SocialUser = {
          id: `bot:${difficulty}:${entry.userId}`,
          username: botProfile.username,
          displayName: botProfile.displayName,
        };

        this.pending.set(entry.userId, { code, gameSlug: entry.gameSlug, opponent: botUser, createdAt: now });
        socialHub.notify(entry.userId, { type: 'ranked-matched', code, gameSlug: entry.gameSlug, opponent: botUser });
      } catch (err) {
        console.error('[matchmaking] failed to create ranked bot room:', err);
        this.queue.set(entry.userId, entry);
      } finally {
        this.reserving.delete(entry.userId);
      }
    }
  }
}

export function pairEntries(entries: QueueEntry[], now: number): [QueueEntry, QueueEntry][] {
  const pairs: [QueueEntry, QueueEntry][] = [];
  const used = new Set<string>();
  const queueSize = entries.length;

  // Pass 1 - same rank.
  const byRating = new Map<number, QueueEntry[]>();
  for (const e of entries) {
    const list = byRating.get(e.rating) ?? [];
    list.push(e);
    byRating.set(e.rating, list);
  }
  for (const list of byRating.values()) {
    list.sort((a, b) => a.joinedAt - b.joinedAt);
    for (let i = 0; i + 1 < list.length; i += 2) {
      pairs.push([list[i], list[i + 1]]);
      used.add(list[i].userId);
      used.add(list[i + 1].userId);
    }
  }

  // Pass 2 - cross-rank, only once both players have waited long enough.
  const rest = entries.filter((e) => !used.has(e.userId)).sort((a, b) => a.rating - b.rating);
  for (let i = 0; i + 1 < rest.length; i++) {
    const a = rest[i];
    const b = rest[i + 1];
    if (used.has(a.userId) || used.has(b.userId)) continue;
    const tol = Math.min(
      rankTolerance(now - a.joinedAt, queueSize),
      rankTolerance(now - b.joinedAt, queueSize),
    );
    if (Math.abs(a.rating - b.rating) <= tol) {
      pairs.push([a, b]);
      used.add(a.userId);
      used.add(b.userId);
    }
  }

  return pairs;
}

declare global {
  // eslint-disable-next-line no-var
  var __gameNightMatchmakingQueue: MatchmakingQueue | undefined;
}
export const matchmakingQueue: MatchmakingQueue =
  (globalThis.__gameNightMatchmakingQueue ??= new MatchmakingQueue());
