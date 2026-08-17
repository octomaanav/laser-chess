import { describe, expect, it } from 'vitest';
import { FileStore } from './fileStore';
import type { GameMatch } from './types';

describe('Store match logging', () => {
  it('records and retrieves game matches', async () => {
    const store = new FileStore();
    const match: GameMatch = {
      id: 'test-match-1',
      gameSlug: 'laser-chess',
      roomCode: 'TEST1',
      player1Name: 'Alice',
      player2Name: 'Bob',
      status: 'completed',
      winnerName: 'Alice',
      winnerColor: 'red',
      movesCount: 24,
      durationSeconds: 180,
      startedAt: Date.now() - 180000,
      endedAt: Date.now(),
    };

    await store.recordMatch(match);
    const recent = await store.getRecentMatches(10);
    expect(recent.length).toBeGreaterThan(0);
    const found = recent.find((m) => m.id === 'test-match-1');
    expect(found).toBeDefined();
    expect(found?.winnerName).toBe('Alice');
    expect(found?.movesCount).toBe(24);
  });
});
