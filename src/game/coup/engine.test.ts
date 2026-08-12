// src/game/coup/engine.test.ts
import { describe, expect, it } from 'vitest';
import {
  chooseExchange,
  chooseReveal,
  createGame,
  declareAction,
  declareBlock,
  declareChallenge,
  resolveWindow,
} from './engine';
import type { CoupState } from './types';

const P = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carol' },
];

// Rig a fresh 3p game so a specific player is known to hold a specific
// character, for deterministic challenge tests.
function withHand(state: CoupState, playerId: string, chars: [string, string]) {
  const p = state.players.find((x) => x.id === playerId)!;
  p.influence[0].character = chars[0] as never;
  p.influence[1].character = chars[1] as never;
  return state;
}

describe('createGame', () => {
  it('deals 2 influence and 2 coins to each of 3+ players', () => {
    const s = createGame(P);
    expect(s.players).toHaveLength(3);
    for (const p of s.players) {
      expect(p.influence).toHaveLength(2);
      expect(p.coins).toBe(2);
    }
    expect(s.phase).toBe('idle');
    expect(s.deck).toHaveLength(15 - 6);
  });

  it('gives a 2-player game 1 starting coin and a variant-setup phase', () => {
    const s = createGame(P.slice(0, 2));
    expect(s.phase).toBe('variant-setup');
    expect(s.variantPools).toBeTruthy();
  });

  it('rejects fewer than 2 or more than 6 players', () => {
    expect(() => createGame([P[0]])).toThrow();
    expect(() => createGame([P[0], P[1], P[2], P[0], P[1], P[2], P[0]])).toThrow();
  });
});

describe('income', () => {
  it('is unblockable, unchallengeable, and grants 1 coin immediately', () => {
    let s = createGame(P);
    s = declareAction(s, 'a', 'income', null);
    expect(s.players[0].coins).toBe(3);
    expect(s.phase).toBe('idle');
    expect(s.turn).toBe(1);
  });
});

describe('tax challenge', () => {
  it('actor proves Duke: keeps the coins, challenger loses influence', () => {
    let s = createGame(P);
    s = withHand(s, 'a', ['duke', 'assassin']);
    s = declareAction(s, 'a', 'tax', null);
    s = declareChallenge(s, 'b');
    expect(s.phase).toBe('awaiting_reveal');
    expect(s.pendingReveals[0].playerId).toBe('b');
    s = chooseReveal(s, 'b', 0);
    expect(s.players[0].coins).toBe(5); // 2 + 3 tax
    expect(s.players[1].influence.filter((c) => c.revealed)).toHaveLength(1);
    expect(s.phase).toBe('idle');
  });

  it("actor bluffing: loses influence, action fails, no coins gained", () => {
    let s = createGame(P);
    s = withHand(s, 'a', ['captain', 'ambassador']); // no duke
    s = declareAction(s, 'a', 'tax', null);
    s = declareChallenge(s, 'b');
    s = chooseReveal(s, 'a', 0);
    expect(s.players[0].coins).toBe(2); // unchanged, action cancelled
    expect(s.phase).toBe('idle');
  });
});

describe('foreign aid block', () => {
  it('duke block goes unchallenged: actor gets nothing', () => {
    let s = createGame(P);
    s = declareAction(s, 'a', 'foreign-aid', null);
    s = declareBlock(s, 'b', 'duke');
    s = resolveWindow(s); // block window times out unchallenged
    expect(s.players[0].coins).toBe(2);
    expect(s.phase).toBe('idle');
  });

  it('block is challenged and blocker was bluffing: action proceeds', () => {
    let s = createGame(P);
    s = withHand(s, 'b', ['captain', 'ambassador']); // no duke
    s = declareAction(s, 'a', 'foreign-aid', null);
    s = declareBlock(s, 'b', 'duke');
    s = declareChallenge(s, 'a');
    s = chooseReveal(s, 'b', 0);
    expect(s.players[0].coins).toBe(4); // foreign aid succeeded after all
  });
});

describe('double danger of assassination', () => {
  it('losing a block-challenge costs 2 influence in one turn', () => {
    let s = createGame(P);
    s = withHand(s, 'a', ['assassin', 'captain']);
    s = withHand(s, 'b', ['duke', 'ambassador']); // no contessa
    s.players[0].coins = 5;
    s = declareAction(s, 'a', 'assassinate', 'b');
    s = declareBlock(s, 'b', 'contessa');
    s = declareChallenge(s, 'a');
    // b loses the block-challenge -> reveal #1
    expect(s.pendingReveals[0].playerId).toBe('b');
    s = chooseReveal(s, 'b', 0);
    // b now has only 1 unrevealed card left, so the assassination's own
    // reveal auto-resolves in the same step -> 2 influence lost in one turn
    expect(s.players[1].eliminated).toBe(true);
    expect(s.players[0].coins).toBe(2); // 5 - 3 assassinate cost, never refunded
  });
});

describe('steal', () => {
  it('takes only 1 coin if the target has just 1', () => {
    let s = createGame(P);
    s.players[1].coins = 1;
    s = declareAction(s, 'a', 'steal', 'b');
    s = resolveWindow(s);
    expect(s.players[1].coins).toBe(0);
    expect(s.players[0].coins).toBe(3);
  });
});

describe('exchange', () => {
  it('lets the actor choose which 2 of 4 candidate cards to keep', () => {
    let s = createGame(P);
    s = declareAction(s, 'a', 'exchange', null);
    s = resolveWindow(s);
    expect(s.phase).toBe('exchange_choice');
    expect(s.exchangeOffer).toHaveLength(2);
    s = chooseExchange(s, 'a', [0, 1]); // keep original two
    expect(s.phase).toBe('idle');
    expect(s.deck).toHaveLength(15 - 6); // 2 drawn, 2 returned - net unchanged
  });
});

describe('coup', () => {
  it('costs 7, is unblockable, and forces a reveal', () => {
    let s = createGame(P);
    s.players[0].coins = 7;
    s = declareAction(s, 'a', 'coup', 'b');
    expect(s.players[0].coins).toBe(0);
    expect(s.pendingReveals[0]).toEqual({ playerId: 'b', reason: 'coup' });
    s = chooseReveal(s, 'b', 1);
    expect(s.players[1].influence[1].revealed).toBe(true);
  });

  it('is forced when a player starts their turn with 10+ coins', () => {
    let s = createGame(P);
    s.players[0].coins = 10;
    expect(() => declareAction(s, 'a', 'income', null)).toThrow();
  });
});

describe('win condition', () => {
  it('ends the game when only one player has influence left', () => {
    let s = createGame([P[0], P[1]]);
    s.phase = 'idle';
    s.players[0].coins = 7;
    s.players[1].influence[0].revealed = true;
    s.players[1].influence[1].revealed = true;
    s.players[1].eliminated = true;
    s = declareAction(s, 'a', 'income', null);
    expect(s.winner).toBe('a');
    expect(s.phase).toBe('game_over');
  });
});
