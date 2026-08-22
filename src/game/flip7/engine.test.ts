import { describe, expect, it } from 'vitest';
import { buildDeck } from './setups';
import {
  chooseFlipThreeTarget,
  chooseFreezeTarget,
  chooseSecondChanceRecipient,
  computeHandScore,
  createGame,
  forfeitPlayer,
  hit,
  stay,
  startNextRound,
} from './engine';
import type { Card, Flip7State } from './types';

// Draws happen via deck.pop(), so the *last* element is drawn first - reverse
// the intended draw order when injecting a deterministic deck for a test.
function withDeck(state: Flip7State, drawOrder: Card[]): Flip7State {
  return { ...state, deck: [...drawOrder].reverse() };
}

function num(value: number): Card {
  return { kind: 'number', value: value as never };
}
function modifier(value: 2 | 4 | 6 | 8 | 10): Card {
  return { kind: 'modifier', value };
}
const multiplier: Card = { kind: 'multiplier' };
const freeze: Card = { kind: 'action', action: 'freeze' };
const flipThree: Card = { kind: 'action', action: 'flip-three' };
const secondChance: Card = { kind: 'action', action: 'second-chance' };

function game(names: string[]): Flip7State {
  return createGame(names.map((n, i) => ({ id: `p${i}`, name: n })));
}

describe('deck composition', () => {
  it('has exactly 94 cards with the correct breakdown', () => {
    const deck = buildDeck();
    expect(deck.length).toBe(94);
    const numbers = deck.filter((c) => c.kind === 'number');
    expect(numbers.length).toBe(79);
    for (let v = 0; v <= 12; v++) {
      const expected = v === 0 ? 1 : v;
      expect(numbers.filter((c) => c.kind === 'number' && c.value === v).length).toBe(expected);
    }
    expect(deck.filter((c) => c.kind === 'modifier').length).toBe(5);
    expect(deck.filter((c) => c.kind === 'multiplier').length).toBe(1);
    expect(deck.filter((c) => c.kind === 'action' && c.action === 'freeze').length).toBe(3);
    expect(deck.filter((c) => c.kind === 'action' && c.action === 'flip-three').length).toBe(3);
    expect(deck.filter((c) => c.kind === 'action' && c.action === 'second-chance').length).toBe(3);
  });
});

describe('createGame', () => {
  it('seats players, deals nobody a hand, and starts left of the dealer', () => {
    let s = game(['A', 'B', 'C']);
    expect(s.players).toHaveLength(3);
    expect(s.players.every((p) => p.hand.length === 0 && p.status === 'active' && p.totalScore === 0)).toBe(true);
    expect(s.dealerIndex).toBe(0);
    expect(s.turn).toBe(1); // player left of the dealer goes first
    expect(s.phase).toBe('round_active');
  });

  it('rejects out-of-range player counts', () => {
    expect(() => createGame([{ id: 'a', name: 'A' }])).toThrow();
    expect(() => createGame(Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })))).toThrow();
  });
});

describe('hit/stay turn order', () => {
  it('advances to the next active player after a hit or a stay', () => {
    let s = game(['A', 'B', 'C']); // turn starts at B (index 1)
    s = withDeck(s, [num(3)]);
    s = hit(s, 'p1');
    expect(s.turn).toBe(2); // C's turn
    s = stay(s, 'p2');
    expect(s.turn).toBe(0); // back around to A (the dealer)
  });

  it('rejects hitting out of turn', () => {
    const s = game(['A', 'B']);
    expect(() => hit(s, 'p0')).toThrow('not your turn');
  });
});

describe('busting and Second Chance', () => {
  it('draws a unique number onto the hand without busting', () => {
    let s = game(['A', 'B']);
    s = withDeck(s, [num(5), num(1)]);
    s = hit(s, 'p1'); // B draws 5, turn -> A
    s = hit(s, 'p0'); // A draws 1
    expect(s.players.find((p) => p.id === 'p1')!.hand).toHaveLength(1);
  });

  it('a held Second Chance saves the player from busting on a duplicate', () => {
    // Turn passes after every hit (dealer=A, first turn=B), so interleave A's
    // draws with filler cards that don't affect the assertions below.
    let s = game(['A', 'B']);
    s = withDeck(s, [secondChance, num(1), num(5), num(2), num(5)]);
    s = hit(s, 'p1'); // B draws Second Chance
    expect(s.players.find((p) => p.id === 'p1')!.hand).toHaveLength(1);
    s = hit(s, 'p0'); // A's filler draw
    s = hit(s, 'p1'); // B draws 5 (unique)
    expect(s.players.find((p) => p.id === 'p1')!.hand.filter((c) => c.kind === 'number')).toHaveLength(1);
    s = hit(s, 'p0'); // A's filler draw
    s = hit(s, 'p1'); // B draws 5 again - duplicate, but Second Chance absorbs it
    const b = s.players.find((p) => p.id === 'p1')!;
    expect(b.status).toBe('active');
    expect(b.hand.some((c) => c.kind === 'action' && c.action === 'second-chance')).toBe(false); // consumed
    expect(b.hand.filter((c) => c.kind === 'number')).toHaveLength(1); // duplicate discarded, not added
  });

  it('busts without a Second Chance, discarding the whole hand and scoring 0', () => {
    let s = game(['A', 'B']);
    s = withDeck(s, [num(5), num(1), num(5)]);
    s = hit(s, 'p1'); // B draws 5
    s = hit(s, 'p0'); // A's filler draw
    s = hit(s, 'p1'); // duplicate 5, no Second Chance held
    const b = s.players.find((p) => p.id === 'p1')!;
    expect(b.status).toBe('busted');
    expect(b.hand).toHaveLength(0);
    expect(computeHandScore(b.hand)).toBe(0);
  });
});

describe('scoring', () => {
  it('sums numbers, doubles them with the x2 multiplier, and adds flat modifiers', () => {
    const hand: Card[] = [num(3), num(5), modifier(4), multiplier];
    // (3 + 5) * 2 + 4 = 20
    expect(computeHandScore(hand)).toBe(20);
  });

  it('awards the +15 Flip 7 bonus at 7 unique numbers', () => {
    const hand: Card[] = [0, 1, 2, 3, 4, 5, 6].map(num);
    expect(computeHandScore(hand)).toBe(21 + 15); // 0+1+2+3+4+5+6 = 21
  });
});

describe('Flip 7 ends the round immediately for everyone', () => {
  it('banks whatever others had drawn once someone flips 7', () => {
    let s = game(['A', 'B']);
    s = withDeck(s, [num(0), num(1), num(2), num(3), num(4), num(5), num(6)]);
    s = hit(s, 'p1'); // B draws 0, turn -> A
    s = stay(s, 'p0'); // A stays immediately with 0 - now B is the only active player, so every
    // subsequent turn cycles straight back to B.
    for (let i = 0; i < 6; i++) s = hit(s, 'p1');
    expect(s.phase).toBe('round_over');
    const b = s.players.find((p) => p.id === 'p1')!;
    expect(b.totalScore).toBe(21 + 15);
    const a = s.players.find((p) => p.id === 'p0')!;
    expect(a.totalScore).toBe(0);
  });
});

describe('Freeze', () => {
  it('immediately stays the chosen target and hands the turn back to normal order', () => {
    let s = game(['A', 'B', 'C']);
    s = withDeck(s, [freeze]);
    s = hit(s, 'p1'); // B draws Freeze
    expect(s.phase).toBe('awaiting_target');
    expect(s.pendingTarget).toEqual({ drawerId: 'p1', kind: 'freeze' });
    s = chooseFreezeTarget(s, 'p1', 'p2'); // freeze C
    expect(s.players.find((p) => p.id === 'p2')!.status).toBe('frozen');
    expect(s.phase).toBe('round_active');
    expect(s.turn).toBe(0); // advances past B (the drawer) to A, skipping frozen C
  });
});

describe('Flip Three', () => {
  it('forces the target to draw 3 cards before turn order resumes', () => {
    let s = game(['A', 'B', 'C']);
    s = withDeck(s, [flipThree, num(1), num(2), num(3)]);
    s = hit(s, 'p1'); // B draws Flip Three
    expect(s.phase).toBe('awaiting_target');
    s = chooseFlipThreeTarget(s, 'p1', 'p0'); // force A to draw 3
    const a = s.players.find((p) => p.id === 'p0')!;
    expect(a.hand.filter((c) => c.kind === 'number')).toHaveLength(3);
    expect(s.phase).toBe('round_active');
    expect(s.turn).toBe(2); // resumes after B (the original drawer), i.e. C
  });

  it('chains: a Flip Three drawn mid-sequence resolves fully before the outer one resumes', () => {
    let s = game(['A', 'B', 'C']);
    // B draws Flip Three targeting A. A's first forced draw is itself a Flip
    // Three targeting C, which must fully resolve (3 cards) before A's
    // remaining 2 forced draws continue.
    s = withDeck(s, [flipThree, flipThree, num(9), num(10), num(11), num(1), num(2)]);
    s = hit(s, 'p1'); // B draws outer Flip Three
    s = chooseFlipThreeTarget(s, 'p1', 'p0'); // targets A
    expect(s.phase).toBe('awaiting_target'); // A's first forced draw was itself Flip Three
    expect(s.pendingTarget).toEqual({ drawerId: 'p0', kind: 'flip-three' });
    s = chooseFlipThreeTarget(s, 'p0', 'p2'); // A sends it to C
    const c = s.players.find((p) => p.id === 'p2')!;
    expect(c.hand.filter((x) => x.kind === 'number')).toHaveLength(3); // C's 3 forced draws all resolved
    const a = s.players.find((p) => p.id === 'p0')!;
    expect(a.hand.filter((x) => x.kind === 'number')).toHaveLength(2); // A's remaining 2 forced draws resolved after
    expect(s.phase).toBe('round_active');
  });

  it('cleans up queue when an Action card is drawn on the final forced draw', () => {
    let s = game(['A', 'B', 'C']);
    // B targets A with Flip Three. A draws 2 number cards, then Freeze on the 3rd forced draw.
    s = withDeck(s, [flipThree, num(1), num(2), freeze]);
    s = hit(s, 'p1'); // B draws Flip Three
    s = chooseFlipThreeTarget(s, 'p1', 'p0'); // Targets A
    expect(s.phase).toBe('awaiting_target');
    expect(s.pendingTarget).toEqual({ drawerId: 'p0', kind: 'freeze' });
    expect(s.flipThreeQueue).toHaveLength(0); // Queue should not hold stale { remaining: 0 }
    s = chooseFreezeTarget(s, 'p0', 'p2'); // A freezes C (C is now frozen)
    expect(s.phase).toBe('round_active');
    expect(s.turn).toBe(0); // Next active player after B (since C is frozen) is A (p0)
  });

  it('cancels remaining forced draws if the target busts mid-sequence', () => {
    let s = game(['A', 'B', 'C']);
    // A (p0) will draw a 5.
    // Turn starts with B (p1). B stays.
    // Turn is C (p2). C stays.
    // Turn is A (p0). A hits and gets a 5.
    // Turn is B (p1). B hits and draws Flip Three targeting A.
    // A draws a 5 (duplicate) on the 1st forced draw and busts.
    s = withDeck(s, [num(5), flipThree, num(5), num(8), num(9)]);
    s = stay(s, 'p1'); // B stays
    s = stay(s, 'p2'); // C stays
    s = hit(s, 'p0');  // A draws 5
    // Now only A is active, so turn stays with A or A is the only player.
    // Instead let's test with B active:
    let s2 = game(['A', 'B', 'C']);
    // A has 5. B draws Flip Three. A draws 5 on forced draw.
    s2 = withDeck(s2, [num(3), num(5), flipThree, num(5), num(8), num(9)]);
    s2 = hit(s2, 'p1'); // B draws 3
    s2 = stay(s2, 'p2'); // C stays
    s2 = hit(s2, 'p0'); // A draws 5
    s2 = hit(s2, 'p1'); // B draws Flip Three
    s2 = chooseFlipThreeTarget(s2, 'p1', 'p0'); // Targets A
    const a = s2.players.find((p) => p.id === 'p0')!;
    expect(a.status).toBe('busted');
    expect(s2.flipThreeQueue).toHaveLength(0); // Queue cleared on bust
    expect(s2.phase).toBe('round_active');
    expect(s2.turn).toBe(1); // Turn is back to B who is still active
  });
});

describe('startNextRound', () => {
  it('rotates the dealer, resets hands/status, and deals a fresh deck', () => {
    let s = game(['A', 'B']);
    s = withDeck(s, [num(5)]);
    s = stay(s, 'p1');
    s = stay(s, 'p0');
    expect(s.phase).toBe('round_over');
    s = startNextRound(s, 'p0');
    expect(s.dealerIndex).toBe(1);
    expect(s.turn).toBe(0);
    expect(s.round).toBe(2);
    expect(s.players.every((p) => p.status === 'active' && p.hand.length === 0)).toBe(true);
    expect(s.deck.length).toBe(94);
  });
});

describe('game over', () => {
  it('ends the game once a sole leader reaches 200 at a round boundary', () => {
    let s = game(['A', 'B']);
    s = { ...s, players: s.players.map((p) => (p.id === 'p1' ? { ...p, totalScore: 195 } : p)) };
    s = withDeck(s, [num(6)]);
    s = hit(s, 'p1'); // B: hand totals 6 so far (banks to 195 + 6 = 201 at round end)
    s = stay(s, 'p0'); // A stays with 0, turn cycles back to B (only active player)
    s = stay(s, 'p1'); // B stays too - round ends, scores bank
    expect(s.phase).toBe('game_over');
    expect(s.winner).toBe('p1');
  });

  it('keeps playing when the round ends in an exact tie at the top', () => {
    let s = game(['A', 'B']);
    s = { ...s, players: s.players.map((p) => ({ ...p, totalScore: 195 })) };
    s = withDeck(s, [num(6), num(6)]);
    s = hit(s, 'p1'); // B draws 6, turn -> A
    s = hit(s, 'p0'); // A draws 6, turn -> B (both still active)
    s = stay(s, 'p1'); // B stays, turn -> A
    s = stay(s, 'p0'); // A stays - round ends, both bank 195 + 6 = 201
    expect(s.phase).toBe('round_over'); // tied at 201 - not over yet
    expect(s.winner).toBeNull();
  });
});

describe('forfeitPlayer', () => {
  it('advances play past a forfeiting current-turn player', () => {
    let s = game(['A', 'B', 'C']);
    expect(s.turn).toBe(1); // B's turn
    s = forfeitPlayer(s, 'p1');
    expect(s.players.find((p) => p.id === 'p1')!.status).toBe('forfeited');
    expect(s.turn).toBe(2); // skipped straight to C
  });

  it('ends the game when forfeits leave fewer than 2 players', () => {
    let s = game(['A', 'B']);
    s = forfeitPlayer(s, 'p1');
    expect(s.phase).toBe('game_over');
    expect(s.winner).toBe('p0');
  });
});

describe('Second Chance giveaway', () => {
  it('forces the drawer to give away a second copy to an eligible player', () => {
    let s = game(['A', 'B', 'C']);
    s = withDeck(s, [secondChance]);
    s = hit(s, 'p1'); // B holds one, turn -> C
    // Fast-forward straight back to B's turn (a legitimate white-box tweak on
    // this pure state object) rather than simulating C's intervening turn.
    s = { ...s, turn: s.players.findIndex((p) => p.id === 'p1') };
    s = withDeck(s, [secondChance]);
    s = hit(s, 'p1'); // B draws a second one, must give it away
    expect(s.phase).toBe('awaiting_target');
    expect(s.pendingTarget).toEqual({ drawerId: 'p1', kind: 'second-chance' });
    s = chooseSecondChanceRecipient(s, 'p1', 'p2');
    const c = s.players.find((p) => p.id === 'p2')!;
    expect(c.hand.some((card) => card.kind === 'action' && card.action === 'second-chance')).toBe(true);
  });
});

describe('lastDraw and card showcase metadata', () => {
  it('records lastDraw and preserved bustedHand on duplicate bust', () => {
    let s = game(['A', 'B']);
    s = withDeck(s, [num(5), num(1), num(5)]);
    s = hit(s, 'p1'); // B draws 5
    expect(s.lastDraw).toMatchObject({
      playerId: 'p1',
      playerName: 'B',
      card: { kind: 'number', value: 5 },
      outcome: 'added',
    });
    s = hit(s, 'p0'); // A draws 1
    s = hit(s, 'p1'); // duplicate 5 -> bust
    expect(s.lastDraw).toMatchObject({
      playerId: 'p1',
      playerName: 'B',
      card: { kind: 'number', value: 5 },
      outcome: 'duplicate_bust',
    });
    const b = s.players.find((p) => p.id === 'p1')!;
    expect(b.bustedHand).toEqual([
      { kind: 'number', value: 5 },
      { kind: 'number', value: 5 },
    ]);
  });

  it('records lastDraw for modifiers, multipliers, and freeze actions', () => {
    let s = game(['A', 'B', 'C']);
    s = withDeck(s, [modifier(6)]);
    s = hit(s, 'p1');
    expect(s.lastDraw).toMatchObject({
      playerId: 'p1',
      card: { kind: 'modifier', value: 6 },
      outcome: 'added',
    });

    s = withDeck(s, [multiplier]);
    s = hit(s, 'p2');
    expect(s.lastDraw).toMatchObject({
      playerId: 'p2',
      card: { kind: 'multiplier' },
      outcome: 'added',
    });

    s = withDeck(s, [freeze]);
    s = hit(s, 'p0');
    expect(s.lastDraw).toMatchObject({
      playerId: 'p0',
      card: { kind: 'action', action: 'freeze' },
      outcome: 'freeze',
    });
  });
});

