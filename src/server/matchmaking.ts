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

// A match that has been made but not yet picked up by the player. The socket
// push is best-effort (the client may be mid-reconnect, backgrounded, or behind
// a proxy that dropped the WS), so every match is ALSO parked here and handed
// out by the polling GET /api/ranked/queue. Without this a paired player is
// removed from the queue and never learns their room code.
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

// How far from their own rank a player is currently willing to be matched.
export function rankTolerance(waitMs: number, queueSize: number): number {
  // With few players around there is rarely a same-rank opponent, so halve the
  // strict phase and reach "anyone" twice as fast rather than making them wait.
  const scale = queueSize <= SMALL_QUEUE ? 0.5 : 1;
  if (waitMs >= ANY_RANK_MS * scale) return Number.POSITIVE_INFINITY;
  const strict = STRICT_MS * scale;
  if (waitMs < strict) return 0;
  return 1 + Math.floor((waitMs - strict) / (EXPAND_MS * scale));
}

// Per-slug factory registry — avoids circular deps (matchmaking → gameServer
// → matchmaking). Each game's server registers its own factory via
// registerCreateRankedRoom(slug, fn) after defining it.
type CreateRankedRoomFn = (redUserId: string, silverUserId: string, gameSlug: string) => Promise<string>;
const _factories = new Map<string, CreateRankedRoomFn>();
export function registerCreateRankedRoom(gameSlug: string, fn: CreateRankedRoomFn) {
  _factories.set(gameSlug, fn);
}

class MatchmakingQueue {
  private queue = new Map<string, QueueEntry>();
  private pending = new Map<string, PendingMatch>();
  // Paired, room still being created. Held out of `queue` so a second tick can't
  // re-pair them, but still reported as queued so the polling client doesn't see
  // a momentary "not queued" and re-join mid-pairing.
  private reserving = new Set<string>();

  joinQueue(userId: string, displayName: string, username: string, rating: number, gameSlug: string) {
    // Drop any stale unclaimed match so a fresh search isn't immediately
    // resolved with a room from a previous session.
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

  // Hand a made match to its player exactly once (the client navigates on it).
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

  // Called every 3s from server.mts. Pairs same-rank players first, then falls
  // back to nearby ranks for anyone whose tolerance has opened up.
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

    for (const [slug, entries] of bySlug) {
      if (entries.length < 2 || !_factories.has(slug)) continue;
      matched.push(...pairEntries(entries, now));
    }

    for (const [a, b] of matched) {
      const factory = _factories.get(a.gameSlug);
      if (!factory) continue;

      // Reserve both players before the await so a second tick can't pair them
      // again while the room is being created.
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

        // Park the result for the poller, then push over the socket. Whichever
        // arrives first wins; takePendingMatch() makes the poll idempotent.
        this.pending.set(a.userId, { code, gameSlug: a.gameSlug, opponent: toSocialUser(b), createdAt: now });
        this.pending.set(b.userId, { code, gameSlug: a.gameSlug, opponent: toSocialUser(a), createdAt: now });

        socialHub.notify(a.userId, { type: 'ranked-matched', code, gameSlug: a.gameSlug, opponent: toSocialUser(b) });
        socialHub.notify(b.userId, { type: 'ranked-matched', code, gameSlug: a.gameSlug, opponent: toSocialUser(a) });
      } catch (err) {
        console.error('[matchmaking] failed to create ranked room:', err);
        // Room creation failed — put both back so they keep searching.
        this.queue.set(a.userId, a);
        this.queue.set(b.userId, b);
      } finally {
        this.reserving.delete(a.userId);
        this.reserving.delete(b.userId);
      }
    }
  }
}

// Two passes: exact-rank pairs first (longest-waiting first), then whatever is
// left gets paired with its nearest neighbour if BOTH players' tolerance covers
// the gap. Exported for testing.
export function pairEntries(entries: QueueEntry[], now: number): [QueueEntry, QueueEntry][] {
  const pairs: [QueueEntry, QueueEntry][] = [];
  const used = new Set<string>();
  const queueSize = entries.length;

  // Pass 1 — same rank.
  const byRating = new Map<number, QueueEntry[]>();
  for (const e of entries) {
    const list = byRating.get(e.rating) ?? [];
    list.push(e);
    byRating.set(e.rating, list);
  }
  for (const list of byRating.values()) {
    list.sort((a, b) => a.joinedAt - b.joinedAt); // FIFO: longest wait pairs first
    for (let i = 0; i + 1 < list.length; i += 2) {
      pairs.push([list[i], list[i + 1]]);
      used.add(list[i].userId);
      used.add(list[i + 1].userId);
    }
  }

  // Pass 2 — cross-rank, only once both players have waited long enough.
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
