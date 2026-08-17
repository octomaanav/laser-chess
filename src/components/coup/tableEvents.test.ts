import { describe, expect, it } from 'vitest';
import { deriveTableEvents } from './tableEvents';
import type { ClientCoupState } from '@/game/coup/redact';

function baseState(overrides: Partial<ClientCoupState> = {}): ClientCoupState {
  return {
    you: 'a',
    players: [
      { id: 'a', name: 'Alice', coins: 2, eliminated: false, connected: true, influenceCount: 2, influence: [{ character: 'chair', revealed: false }, { character: 'auditor', revealed: false }] },
      { id: 'b', name: 'Bob', coins: 2, eliminated: false, connected: true, influenceCount: 2, influence: [{ character: null, revealed: false }, { character: null, revealed: false }] },
    ],
    deckSize: 15,
    treasury: 50,
    turn: 0,
    phase: 'idle',
    pendingAction: null,
    pendingBlock: null,
    pendingRevealPlayerId: null,
    exchangeOffer: null,
    variantPoolForYou: null,
    log: [],
    winner: null,
    ...overrides,
  } as ClientCoupState;
}

describe('deriveTableEvents', () => {
  it('returns nothing on the first snapshot', () => {
    expect(deriveTableEvents(null, baseState())).toEqual([]);
  });

  it('detects a treasury-funded gain (income/foreign-aid/tax) as coins-gained', () => {
    const prev = baseState({ treasury: 50 });
    const next = baseState({ treasury: 47, players: [{ ...prev.players[0], coins: 5 }, prev.players[1]], log: [{ id: 1, text: 'Alice took 3 coins.' }] });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'coins-gained', playerId: 'a', amount: 3 }));
  });

  it('detects a matched gain/loss with untouched treasury as coins-stolen', () => {
    const prev = baseState({ treasury: 50 });
    const next = baseState({
      treasury: 50,
      players: [{ ...prev.players[0], coins: 4 }, { ...prev.players[1], coins: 0 }],
      log: [{ id: 1, text: 'Alice stole 2 coins from Bob.' }],
    });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'coins-stolen', fromId: 'b', toId: 'a', amount: 2 }));
  });

  it('detects a player paying into the treasury as treasury-paid', () => {
    const prev = baseState({ treasury: 50, players: [{ ...baseState().players[0], coins: 7 }, baseState().players[1]] });
    const next = baseState({ treasury: 57, players: [{ ...prev.players[0], coins: 0 }, prev.players[1]] });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'treasury-paid', playerId: 'a', amount: 7 }));
  });

  it('tags a reveal caused by losing a challenge as challenge-lost', () => {
    const prev = baseState({
      phase: 'action_declared',
      pendingAction: { type: 'tax', actorId: 'a', targetId: null, claimedCharacter: 'chair', costPaid: 0 },
      pendingRevealPlayerId: 'a',
    });
    const next = baseState({
      phase: 'awaiting_reveal',
      pendingAction: { type: 'tax', actorId: 'a', targetId: null, claimedCharacter: 'chair', costPaid: 0 },
      pendingRevealPlayerId: null,
      players: [{ ...prev.players[0], influence: [{ character: 'chair', revealed: true }, { character: 'auditor', revealed: false }] }, prev.players[1]],
    });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'card-revealed', playerId: 'a', cardIndex: 0, cause: 'challenge-lost' }));
  });

  it('tags a reveal caused by a successful coup/assassinate hit as hit', () => {
    const prev = baseState({
      phase: 'action_declared',
      pendingAction: { type: 'coup', actorId: 'b', targetId: 'a', claimedCharacter: null, costPaid: 7 },
      pendingRevealPlayerId: 'a',
    });
    const next = baseState({
      phase: 'awaiting_reveal',
      pendingAction: { type: 'coup', actorId: 'b', targetId: 'a', claimedCharacter: null, costPaid: 7 },
      pendingRevealPlayerId: null,
      players: [{ ...prev.players[0], influence: [{ character: 'chair', revealed: true }, { character: 'auditor', revealed: false }] }, prev.players[1]],
    });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'card-revealed', playerId: 'a', cardIndex: 0, cause: 'hit' }));
  });

  it('emits claim-proved when the accused keeps their claim and the challenger must reveal instead', () => {
    const prev = baseState({
      phase: 'action_declared',
      pendingAction: { type: 'tax', actorId: 'a', targetId: null, claimedCharacter: 'chair', costPaid: 0 },
      pendingRevealPlayerId: null,
    });
    const next = baseState({
      phase: 'action_declared',
      pendingAction: { type: 'tax', actorId: 'a', targetId: null, claimedCharacter: 'chair', costPaid: 0 },
      pendingRevealPlayerId: 'b',
    });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'claim-proved', playerId: 'a', character: 'chair' }));
  });

  it('emits block-declared when a pendingBlock first appears', () => {
    const prev = baseState({
      phase: 'action_declared',
      pendingAction: { type: 'foreign-aid', actorId: 'a', targetId: null, claimedCharacter: null, costPaid: 0 },
    });
    const next = baseState({
      phase: 'block_declared',
      pendingAction: { type: 'foreign-aid', actorId: 'a', targetId: null, claimedCharacter: null, costPaid: 0 },
      pendingBlock: { byId: 'b', claimedCharacter: 'chair' },
    });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'block-declared', actorId: 'a' }));
  });

  it('attributes a bluffed block-challenge reveal to the blocker, not the original actor', () => {
    const prev = baseState({
      phase: 'block_declared',
      pendingAction: { type: 'assassinate', actorId: 'a', targetId: 'b', claimedCharacter: 'fixer', costPaid: 3 },
      pendingBlock: { byId: 'b', claimedCharacter: 'counsel' },
      pendingRevealPlayerId: 'b',
    });
    const next = baseState({
      phase: 'awaiting_reveal',
      pendingAction: { type: 'assassinate', actorId: 'a', targetId: 'b', claimedCharacter: 'fixer', costPaid: 3 },
      pendingBlock: { byId: 'b', claimedCharacter: 'counsel' },
      pendingRevealPlayerId: null,
      players: [prev.players[0], { ...prev.players[1], influence: [{ character: null, revealed: true }, { character: null, revealed: false }] }],
    });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'card-revealed', playerId: 'b', cardIndex: 0, cause: 'challenge-lost' }));
  });

  it('emits claim-proved for the blocker (not the original actor) when a block-challenge fails', () => {
    const prev = baseState({
      phase: 'block_declared',
      pendingAction: { type: 'assassinate', actorId: 'a', targetId: 'b', claimedCharacter: 'fixer', costPaid: 3 },
      pendingBlock: { byId: 'b', claimedCharacter: 'counsel' },
      pendingRevealPlayerId: null,
    });
    const next = baseState({
      phase: 'block_declared',
      pendingAction: { type: 'assassinate', actorId: 'a', targetId: 'b', claimedCharacter: 'fixer', costPaid: 3 },
      pendingBlock: { byId: 'b', claimedCharacter: 'counsel' },
      pendingRevealPlayerId: 'c',
    });
    const events = deriveTableEvents(prev, next);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'claim-proved', playerId: 'b', character: 'counsel' }));
  });
});
