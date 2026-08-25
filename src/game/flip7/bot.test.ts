// src/game/flip7/bot.test.ts
import { describe, expect, it } from 'vitest';
import { calculateBustProbability, decideBotMove, decideBotTarget } from './bot';
import { createGame, hit, stay } from './engine';
import type { Card, Flip7State, NumberCard } from './types';

const num = (v: any): NumberCard => ({ kind: 'number', value: v });
const freeze: Card = { kind: 'action', action: 'freeze' };
const secondChance: Card = { kind: 'action', action: 'second-chance' };
const flipThree: Card = { kind: 'action', action: 'flip-three' };

function withDeck(state: Flip7State, cards: Card[]): Flip7State {
  return { ...state, deck: cards.slice().reverse() };
}

describe('Flip 7 Bot AI', () => {
  it('calculates 0% bust probability with Second Chance or 0/1 card', () => {
    let s = createGame([
      { id: 'p0', name: 'Human' },
      { id: 'p1', name: 'Bot' },
    ]);
    expect(calculateBustProbability(s, 'p1')).toBe(0);

    // Bot holding a Second Chance card has 0 bust probability
    s = {
      ...s,
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, hand: [num(12), num(11), secondChance] } : p)),
    };
    expect(calculateBustProbability(s, 'p1')).toBe(0);
  });

  it('calculates non-zero bust probability when holding multiple numbers', () => {
    let s = createGame([
      { id: 'p0', name: 'Human' },
      { id: 'p1', name: 'Bot' },
    ]);
    s = {
      ...s,
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, hand: [num(12), num(11), num(10), num(9)] } : p)),
    };
    const prob = calculateBustProbability(s, 'p1');
    expect(prob).toBeGreaterThan(0.3); // Holding 12, 11, 10, 9 has high duplicate risk (12+11+10+9 = 42 dangerous cards)
  });

  it('Easy bot draws on empty hand and hits with Second Chance', () => {
    let s = createGame([
      { id: 'p0', name: 'Human' },
      { id: 'p1', name: 'Bot' },
    ]);
    expect(decideBotMove(s, 'p1', 'easy')).toBe('hit');

    s = {
      ...s,
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, hand: [num(12), num(11), secondChance] } : p)),
    };
    expect(decideBotMove(s, 'p1', 'easy')).toBe('hit');
  });

  it('Medium and Hard bots stay when bust risk is high without Second Chance', () => {
    let s = createGame([
      { id: 'p0', name: 'Human' },
      { id: 'p1', name: 'Bot' },
    ]);
    // Bot holds 12, 11, 10, 9 (total 42 points, very high bust chance)
    s = {
      ...s,
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, hand: [num(12), num(11), num(10), num(9)] } : p)),
    };
    expect(decideBotMove(s, 'p1', 'medium')).toBe('stay');
    expect(decideBotMove(s, 'p1', 'hard')).toBe('stay');
  });

  it('Hard bot hits with Second Chance even with high points', () => {
    let s = createGame([
      { id: 'p0', name: 'Human' },
      { id: 'p1', name: 'Bot' },
    ]);
    s = {
      ...s,
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, hand: [num(12), num(11), num(10), secondChance] } : p)),
    };
    expect(decideBotMove(s, 'p1', 'hard')).toBe('hit');
  });

  it('decides targets smartly for Freeze and Flip Three', () => {
    let s = createGame([
      { id: 'p0', name: 'Leader' },
      { id: 'p1', name: 'Bot' },
      { id: 'p2', name: 'Trailing' },
    ]);
    s = {
      ...s,
      players: [
        { ...s.players[0], totalScore: 100, hand: [num(12), num(11)] }, // 23 pts in hand
        { ...s.players[1], totalScore: 50, hand: [] },
        { ...s.players[2], totalScore: 20, hand: [num(2)] }, // 2 pts in hand
      ],
    };

    // Freeze should target highest threat (Leader, p0)
    const freezeTarget = decideBotTarget(s, 'p1', 'freeze', 'hard');
    expect(freezeTarget).toBe('p0');

    // Flip Three should target player with most cards (p0 has 2 cards vs p2 with 1 card)
    const flipThreeTarget = decideBotTarget(s, 'p1', 'flip-three', 'hard');
    expect(flipThreeTarget).toBe('p0');

    // Second Chance giveaway should give to lowest score player (p2)
    const scTarget = decideBotTarget(s, 'p1', 'second-chance', 'hard');
    expect(scTarget).toBe('p2');
  });
});
