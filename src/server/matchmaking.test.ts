// src/server/matchmaking.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
  getBotDifficultyForRating,
  pairEntries,
  rankTolerance,
  registerCreateRankedRoom,
  registerCreateRankedBotRoom,
  matchmakingQueue,
  BOT_BACKFILL_DELAY_MS,
  type QueueEntry,
} from './matchmaking';

describe('Matchmaking Queue & Bot Backfill', () => {
  it('maps rating to appropriate bot difficulty', () => {
    expect(getBotDifficultyForRating(0)).toBe('easy'); // Bronze 1
    expect(getBotDifficultyForRating(2)).toBe('easy'); // Bronze 3
    expect(getBotDifficultyForRating(3)).toBe('medium'); // Silver 1
    expect(getBotDifficultyForRating(5)).toBe('medium'); // Silver 3
    expect(getBotDifficultyForRating(6)).toBe('hard'); // Gold 1
    expect(getBotDifficultyForRating(11)).toBe('hard'); // Platinum 3
    expect(getBotDifficultyForRating(12)).toBe('extreme'); // Diamond 1
    expect(getBotDifficultyForRating(15)).toBe('extreme'); // Master
  });

  it('pairs same-rank human entries first', () => {
    const now = Date.now();
    const entries: QueueEntry[] = [
      { userId: 'u1', displayName: 'Player 1', username: 'p1', rating: 5, joinedAt: now - 1000, gameSlug: 'laser-chess' },
      { userId: 'u2', displayName: 'Player 2', username: 'p2', rating: 5, joinedAt: now - 500, gameSlug: 'laser-chess' },
      { userId: 'u3', displayName: 'Player 3', username: 'p3', rating: 8, joinedAt: now - 2000, gameSlug: 'laser-chess' },
    ];

    const pairs = pairEntries(entries, now);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0].userId).toBe('u1');
    expect(pairs[0][1].userId).toBe('u2');
  });

  it('backfills a solo waiting player with a bot after 10s', async () => {
    const botRoomFn = vi.fn().mockResolvedValue('ROOM1');
    registerCreateRankedBotRoom('laser-chess', botRoomFn);

    const now = Date.now();
    // Join solo player
    matchmakingQueue.joinQueue('u100', 'Human Player', 'human100', 12, 'laser-chess');

    // Tick before 10s -> no match yet
    await matchmakingQueue.tick();
    expect(matchmakingQueue.isQueued('u100')).toBe(true);

    // Fast-forward join time past 10s
    const entry = (matchmakingQueue as any).queue.get('u100');
    if (entry) entry.joinedAt = now - (BOT_BACKFILL_DELAY_MS + 1000);

    // Tick after 10s -> bot match created!
    await matchmakingQueue.tick();

    expect(botRoomFn).toHaveBeenCalledWith(
      'u100',
      expect.stringMatching(/red|silver/),
      'extreme', // rating 12 (Diamond 1) maps to the extreme bot
      expect.any(String),
      'laser-chess'
    );

    const match = matchmakingQueue.takePendingMatch('u100');
    expect(match).not.toBeNull();
    expect(match?.code).toBe('ROOM1');
    expect(match?.opponent.displayName).toBeDefined();
  });
});
