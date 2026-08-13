import { describe, expect, it } from 'vitest';
import { createGame } from './engine';
import { redactStateFor } from './redact';

describe('redactStateFor', () => {
  it('hides other players unrevealed characters but not your own', () => {
    const state = createGame([
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Carol' },
    ]);
    const viewA = redactStateFor(state, 'a');
    const you = viewA.players.find((p) => p.id === 'a')!;
    const opponent = viewA.players.find((p) => p.id === 'b')!;
    expect(you.influence.every((c) => c.character !== null)).toBe(true);
    expect(opponent.influence.every((c) => c.character === null)).toBe(true);
    expect(opponent.influenceCount).toBe(2);
  });

  it('never includes deck contents, only its size', () => {
    const state = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]);
    const view = redactStateFor(state, 'a');
    expect((view as unknown as { deck?: unknown }).deck).toBeUndefined();
    expect(view.deckSize).toBe(state.deck.length);
  });

  it('only includes the exchange offer for the exchanging player', () => {
    let state = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]);
    state = { ...state, phase: 'exchange_choice', pendingAction: { type: 'exchange', actorId: 'a', targetId: null, claimedCharacter: 'ambassador', costPaid: 0 }, exchangeOffer: [state.deck[0], state.deck[1]] };
    expect(redactStateFor(state, 'a').exchangeOffer).toHaveLength(2);
    expect(redactStateFor(state, 'b').exchangeOffer).toBeNull();
  });
});
