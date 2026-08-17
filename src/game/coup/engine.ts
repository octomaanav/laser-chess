// src/game/coup/engine.ts
import { buildDeck, buildVariantPools, shuffle } from './setups';
import {
  BLOCKERS_FOR,
  CLAIM_FOR,
  COST_FOR,
  UNCONTESTABLE_ACTIONS,
  type ActionType,
  type BlockCharacter,
  type Card,
  type Character,
  type CoupState,
  type PendingReveal,
  type Player,
} from './types';

function nextLogId(state: CoupState): number {
  return state.log.length + 1;
}

function appendLog(state: CoupState, text: string): CoupState {
  return { ...state, log: [...state.log, { id: nextLogId(state), text }] };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Public description of a just-declared action, shown to everyone before
// it's known to succeed or fail - claims are always public in Coup, so
// naming the claimed character here never leaks hidden information.
function describeActionLog(actor: Player, type: ActionType, target?: Player): string {
  switch (type) {
    case 'income':
      return `${actor.name} took Income.`;
    case 'foreign-aid':
      return `${actor.name} attempted Foreign Aid.`;
    case 'coup':
      return `${actor.name} launched a Coup against ${target!.name}.`;
    case 'tax':
      return `${actor.name} claimed Chair and attempted to collect Tax.`;
    case 'assassinate':
      return `${actor.name} claimed Fixer and attempted to assassinate ${target!.name}.`;
    case 'exchange':
      return `${actor.name} claimed Broker and attempted an Exchange.`;
    case 'steal':
      return `${actor.name} claimed Auditor and attempted to steal from ${target!.name}.`;
  }
}

const ACTION_LABEL: Record<ActionType, string> = {
  income: 'Income',
  'foreign-aid': 'Foreign Aid',
  coup: 'Coup',
  tax: 'Tax',
  assassinate: 'the assassination',
  exchange: 'the Exchange',
  steal: 'the steal',
};

function alivePlayers(state: CoupState): Player[] {
  return state.players.filter((p) => !p.eliminated);
}

function getPlayer(state: CoupState, id: string): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`unknown player ${id}`);
  return p;
}

function unrevealedCards(p: Player): { card: Card; index: 0 | 1 }[] {
  return p.influence
    .map((card, i) => ({ card, index: i as 0 | 1 }))
    .filter((x) => !x.card.revealed);
}

function currentPlayer(state: CoupState): Player {
  return state.players[state.turn];
}

function advanceTurn(state: CoupState): CoupState {
  const alive = alivePlayers(state);
  if (alive.length <= 1) {
    const winner = alive[0] ?? null;
    const logged = winner ? appendLog(state, `${winner.name} wins the game!`) : state;
    return {
      ...logged,
      phase: 'game_over',
      winner: winner?.id ?? null,
      pendingAction: null,
      pendingBlock: null,
      pendingReveals: [],
      pendingResolution: null,
    };
  }
  let next = (state.turn + 1) % state.players.length;
  while (state.players[next].eliminated) next = (next + 1) % state.players.length;
  return {
    ...state,
    turn: next,
    phase: 'idle',
    pendingAction: null,
    pendingBlock: null,
    pendingReveals: [],
    pendingResolution: null,
    exchangeOffer: null,
  };
}

function checkWinAfterElimination(state: CoupState): CoupState {
  const alive = alivePlayers(state);
  if (alive.length <= 1) {
    const winner = alive[0] ?? null;
    const logged = winner && state.phase !== 'game_over' ? appendLog(state, `${winner.name} wins the game!`) : state;
    return { ...logged, phase: 'game_over', winner: winner?.id ?? null };
  }
  return state;
}

// Queue a player's influence loss. If they only have one unrevealed card
// left, there's no real choice - auto-reveal it immediately.
function queueReveal(state: CoupState, reveal: PendingReveal): CoupState {
  const p = getPlayer(state, reveal.playerId);
  const remaining = unrevealedCards(p);
  if (remaining.length === 0) return state; // already eliminated, nothing to lose
  if (remaining.length === 1) {
    return applyReveal(state, reveal.playerId, remaining[0].index);
  }
  return { ...state, phase: 'awaiting_reveal', pendingReveals: [...state.pendingReveals, reveal] };
}

function applyReveal(state: CoupState, playerId: string, cardIndex: 0 | 1): CoupState {
  const revealedPlayer = getPlayer(state, playerId);
  const revealedCharacter = revealedPlayer.influence[cardIndex].character;
  let eliminated = false;
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const influence = [...p.influence] as [Card, Card];
    influence[cardIndex] = { ...influence[cardIndex], revealed: true };
    eliminated = influence.every((c) => c.revealed);
    return { ...p, influence, eliminated };
  });
  let next: CoupState = { ...state, players };
  // The revealed card is now face-up (public), so naming it here doesn't
  // leak any hidden information - only the player's OTHER (still-hidden)
  // card stays secret.
  next = appendLog(
    next,
    eliminated
      ? `${revealedPlayer.name} revealed ${cap(revealedCharacter)} and is eliminated.`
      : `${revealedPlayer.name} revealed ${cap(revealedCharacter)}.`,
  );
  next = checkWinAfterElimination(next);
  return next;
}

function applyActionEffect(state: CoupState): CoupState {
  const action = state.pendingAction;
  if (!action) return state;
  let next = { ...state };
  const actor = getPlayer(next, action.actorId);

  switch (action.type) {
    case 'income': {
      next = setCoins(next, actor.id, actor.coins + 1);
      next = { ...next, treasury: next.treasury - 1 };
      break;
    }
    case 'foreign-aid': {
      next = setCoins(next, actor.id, actor.coins + 2);
      next = { ...next, treasury: next.treasury - 2 };
      break;
    }
    case 'tax': {
      next = setCoins(next, actor.id, actor.coins + 3);
      next = { ...next, treasury: next.treasury - 3 };
      break;
    }
    case 'coup': {
      next = queueReveal(next, { playerId: action.targetId!, reason: 'coup' });
      break;
    }
    case 'assassinate': {
      next = queueReveal(next, { playerId: action.targetId!, reason: 'assassinate' });
      break;
    }
    case 'steal': {
      const target = getPlayer(next, action.targetId!);
      const amount = Math.min(2, target.coins);
      next = setCoins(next, target.id, target.coins - amount);
      next = setCoins(next, actor.id, getPlayer(next, actor.id).coins + amount);
      break;
    }
    case 'exchange': {
      const drawn = next.deck.slice(0, 2);
      next = { ...next, deck: next.deck.slice(2), exchangeOffer: drawn, phase: 'exchange_choice' };
      return next; // pauses here - chooseExchange finishes the turn
    }
  }

  if (next.pendingReveals.length > 0) return next; // queueReveal opened a fresh reveal
  return advanceTurn(next);
}

function setCoins(state: CoupState, playerId: string, coins: number): CoupState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, coins } : p)) };
}

function drainOrResolve(state: CoupState): CoupState {
  if (state.pendingReveals.length > 0) return state; // still waiting on a choice
  switch (state.pendingResolution) {
    case 'apply-action':
      return applyActionEffect({ ...state, pendingResolution: null });
    case 'action-failed':
      return advanceTurn({ ...state, pendingResolution: null }); // cost stays spent, no refund
    case 'refund-actor': {
      const action = state.pendingAction!;
      const refunded = setCoins(state, action.actorId, getPlayer(state, action.actorId).coins + action.costPaid);
      return advanceTurn({ ...refunded, pendingResolution: null, treasury: refunded.treasury - action.costPaid });
    }
    default:
      return state.phase === 'awaiting_reveal' ? advanceTurn(state) : state;
  }
}

// ---- public API -------------------------------------------------------

export function createGame(players: { id: string; name: string }[]): CoupState {
  if (players.length < 2 || players.length > 6) {
    throw new Error('Boardroom supports 2-6 players');
  }
  const base: CoupState = {
    players: [],
    deck: [],
    treasury: 50,
    turn: 0,
    phase: 'idle',
    pendingAction: null,
    pendingBlock: null,
    pendingReveals: [],
    pendingResolution: null,
    exchangeOffer: null,
    variantPools: null,
    variantChoices: null,
    log: [],
    winner: null,
  };

  if (players.length === 2) {
    const [poolA, poolB] = buildVariantPools();
    return {
      ...base,
      players: players.map((p, i) => ({
        id: p.id,
        name: p.name,
        coins: i === 0 ? 1 : 2, // rulebook 2p variant: starting player gets 1, the other gets 2 (compensation for going second)
        influence: [
          { character: 'chair', revealed: false }, // placeholder, replaced in chooseStartingCharacter
          { character: 'chair', revealed: false },
        ],
        eliminated: false,
        connected: true,
      })),
      treasury: base.treasury - 3,
      phase: 'variant-setup',
      variantPools: { [players[0].id]: poolA, [players[1].id]: poolB },
      variantChoices: {},
    };
  }

  const deck = buildDeck();
  const dealt: Player[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    coins: 2,
    influence: [
      { character: deck.pop()!, revealed: false },
      { character: deck.pop()!, revealed: false },
    ],
    eliminated: false,
    connected: true,
  }));
  return { ...base, players: dealt, deck, treasury: base.treasury - dealt.length * 2 };
}

// 2-player variant: each player secretly keeps 1 card from their 5-card
// pool. Once both have chosen, deal 1 random card from the shuffled third
// pool to each and set the remaining 3 as the court deck.
export function chooseStartingCharacter(state: CoupState, playerId: string, character: Character): CoupState {
  if (state.phase !== 'variant-setup') throw new Error('not in variant setup');
  const pool = state.variantPools?.[playerId];
  if (!pool || !pool.includes(character)) throw new Error('character not in your draft pool');
  if (state.variantChoices?.[playerId]) throw new Error('already chosen');

  const variantChoices = { ...state.variantChoices, [playerId]: character };
  let next: CoupState = { ...state, variantChoices };

  const ids = Object.keys(next.variantPools!);
  if (Object.keys(variantChoices).length < ids.length) return next; // waiting on the other player

  const [, , thirdPool] = [next.variantPools![ids[0]], next.variantPools![ids[1]], buildVariantPools()[2]];
  const shuffled = shuffle(thirdPool);
  const dealt = shuffled.slice(0, ids.length);
  const courtDeck = shuffled.slice(ids.length);

  const players = next.players.map((p, i) => {
    const chosen = variantChoices[p.id];
    if (!chosen) return p;
    return {
      ...p,
      influence: [
        { character: chosen, revealed: false },
        { character: dealt[i], revealed: false },
      ] as [Card, Card],
    };
  });

  return { ...next, players, deck: courtDeck, phase: 'idle', variantPools: null };
}

export function declareAction(
  state: CoupState,
  actorId: string,
  type: ActionType,
  targetId: string | null,
): CoupState {
  if (state.phase !== 'idle') throw new Error('an action is already in progress');
  const actor = currentPlayer(state);
  if (actor.id !== actorId) throw new Error('not your turn');
  if (actor.eliminated) throw new Error('eliminated players cannot act');

  if (actor.coins >= 10 && type !== 'coup') throw new Error('you must coup with 10+ coins');

  const cost = COST_FOR[type];
  if (actor.coins < cost) throw new Error('not enough coins');

  const requiresTarget = type === 'coup' || type === 'assassinate' || type === 'steal';
  if (requiresTarget) {
    if (!targetId || targetId === actorId) throw new Error('a valid target is required');
    const target = getPlayer(state, targetId);
    if (target.eliminated) throw new Error('target is already eliminated');
  }

  let next: CoupState = {
    ...state,
    players: state.players.map((p) => (p.id === actorId ? { ...p, coins: p.coins - cost } : p)),
    treasury: state.treasury + cost,
    pendingAction: {
      type,
      actorId,
      targetId: requiresTarget ? targetId : null,
      claimedCharacter: CLAIM_FOR[type] ?? null,
      costPaid: cost,
    },
  };
  next = appendLog(next, describeActionLog(actor, type, requiresTarget ? getPlayer(next, targetId!) : undefined));

  if (UNCONTESTABLE_ACTIONS.includes(type)) {
    return applyActionEffect(next);
  }
  return { ...next, phase: 'action_declared' };
}

export function declareBlock(state: CoupState, byId: string, claimedCharacter: BlockCharacter): CoupState {
  if (state.phase !== 'action_declared' || !state.pendingAction) throw new Error('nothing to block');
  const action = state.pendingAction;
  const allowed = BLOCKERS_FOR[action.type];
  if (!allowed || !allowed.includes(claimedCharacter)) throw new Error('this action cannot be blocked that way');

  const eligible =
    action.type === 'foreign-aid' ? state.players.filter((p) => p.id !== action.actorId && !p.eliminated).map((p) => p.id) : [action.targetId];
  if (!eligible.includes(byId)) throw new Error('you cannot block this action');

  const blocker = getPlayer(state, byId);
  const next = appendLog(state, `${blocker.name} claimed ${cap(claimedCharacter)} to block ${ACTION_LABEL[action.type]}.`);
  return { ...next, pendingBlock: { byId, claimedCharacter }, phase: 'block_declared' };
}

export function declareChallenge(state: CoupState, challengerId: string): CoupState {
  const challenger = getPlayer(state, challengerId);
  if (challenger.eliminated) throw new Error('eliminated players cannot challenge');
  if (state.phase === 'action_declared' && state.pendingAction) {
    const action = state.pendingAction;
    if (!action.claimedCharacter) throw new Error('this action makes no character claim to challenge');
    if (challengerId === action.actorId) throw new Error('you cannot challenge your own action');
    const accused = getPlayer(state, action.actorId);
    const next = appendLog(state, `${challenger.name} challenged ${accused.name}'s claim of ${cap(action.claimedCharacter)}.`);
    return resolveChallenge(next, challengerId, action.actorId, action.claimedCharacter, 'action');
  }
  if (state.phase === 'block_declared' && state.pendingBlock) {
    const block = state.pendingBlock;
    if (challengerId === block.byId) throw new Error('you cannot challenge your own block');
    const accused = getPlayer(state, block.byId);
    const next = appendLog(state, `${challenger.name} challenged ${accused.name}'s claim of ${cap(block.claimedCharacter)}.`);
    return resolveChallenge(next, challengerId, block.byId, block.claimedCharacter, 'block');
  }
  throw new Error('nothing to challenge');
}

function resolveChallenge(
  state: CoupState,
  challengerId: string,
  accusedId: string,
  claimed: Character,
  against: 'action' | 'block',
): CoupState {
  const accused = getPlayer(state, accusedId);
  const challenger = getPlayer(state, challengerId);
  const held = unrevealedCards(accused).find((c) => c.card.character === claimed);

  if (held) {
    // Accused proves it: shuffle that card back into the deck and draw a
    // replacement, so they keep 2 influence without revealing what it is.
    const deck = shuffle([...state.deck, claimed]);
    const replacement = deck.pop()!;
    const players = state.players.map((p) => {
      if (p.id !== accusedId) return p;
      const influence = [...p.influence] as [Card, Card];
      influence[held.index] = { character: replacement, revealed: false };
      return { ...p, influence };
    });
    let next: CoupState = { ...state, players, deck };
    next = appendLog(next, `${accused.name} proved ${cap(claimed)}. ${challenger.name} loses the challenge.`);
    const resolution = against === 'action' ? 'apply-action' : 'action-failed';
    next = queueReveal(next, { playerId: challengerId, reason: 'lost-challenge' });
    next = { ...next, pendingResolution: resolution };
    return drainOrResolve(next);
  }

  // Accused was bluffing: they lose the challenge.
  const resolution = against === 'action' ? 'refund-actor' : 'apply-action';
  let next = appendLog(state, `${accused.name} did not have ${cap(claimed)} and loses the challenge.`);
  next = queueReveal(next, { playerId: accusedId, reason: 'lost-challenge' });
  next = { ...next, pendingResolution: resolution };
  return drainOrResolve(next);
}

// Called by the server when a response-window timer expires with nobody
// having challenged or blocked.
export function resolveWindow(state: CoupState): CoupState {
  if (state.phase === 'action_declared' && state.pendingAction) {
    return applyActionEffect(state);
  }
  if (state.phase === 'block_declared') {
    return advanceTurn({ ...state }); // block stands unchallenged, cost stays spent
  }
  throw new Error('no open response window');
}

export function chooseReveal(state: CoupState, playerId: string, cardIndex: 0 | 1): CoupState {
  if (state.phase !== 'awaiting_reveal' || state.pendingReveals.length === 0) {
    throw new Error('no reveal is pending');
  }
  const [head, ...rest] = state.pendingReveals;
  if (head.playerId !== playerId) throw new Error('not your reveal to choose');
  const p = getPlayer(state, playerId);
  if (p.influence[cardIndex].revealed) throw new Error('that card is already revealed');

  let next = applyReveal(state, playerId, cardIndex);
  next = { ...next, pendingReveals: rest };
  if (next.phase === 'game_over') return next;
  return drainOrResolve(next);
}

// Called by the room server when a disconnected player's forfeit clock
// expires. Unlike a normal challenge/coup loss, a forfeit can happen at any
// point in the state machine - mid-turn, mid-response-window, or while a
// reveal/exchange is pending - so it must clean up whatever pending* fields
// might reference the forfeiting player as a ghost, not just flip their
// cards face up.
export function forfeitPlayer(state: CoupState, playerId: string): CoupState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return state;

  const players = state.players.map((p) =>
    p.id === playerId
      ? { ...p, eliminated: true, influence: p.influence.map((c) => ({ ...c, revealed: true })) as [Card, Card] }
      : p,
  );
  const logged = appendLog(state, `${player.name} disconnected too long and forfeits.`);
  let next: CoupState = { ...logged, players, pendingReveals: state.pendingReveals.filter((r) => r.playerId !== playerId) };

  next = checkWinAfterElimination(next);
  if (next.phase === 'game_over') {
    return { ...next, pendingAction: null, pendingBlock: null, pendingReveals: [], pendingResolution: null };
  }

  const wasCurrentTurn = state.players[state.turn]?.id === playerId;
  const wasPendingActor = state.pendingAction?.actorId === playerId;
  const wasPendingTarget = state.pendingAction?.targetId === playerId;
  const wasPendingBlocker = state.pendingBlock?.byId === playerId;
  const wasPendingReveal = state.pendingReveals.some((r) => r.playerId === playerId);

  // The forfeiting player was involved in whatever's currently in progress
  // (their own turn, the action/block they're party to, or a reveal they
  // owed) - that in-progress thing is now unresolvable, so move play on.
  // advanceTurn also re-runs the alive<=1 check and clears pending* fields.
  if (wasCurrentTurn || wasPendingActor || wasPendingTarget || wasPendingBlocker || wasPendingReveal) {
    return advanceTurn(next);
  }

  return next;
}

export function chooseExchange(state: CoupState, playerId: string, keepIndices: number[]): CoupState {
  if (state.phase !== 'exchange_choice' || !state.pendingAction) throw new Error('no exchange pending');
  if (state.pendingAction.actorId !== playerId) throw new Error('not your exchange');
  if (!state.exchangeOffer) throw new Error('no exchange offer');

  const actor = getPlayer(state, playerId);
  // Only unrevealed slots are in play for the exchange - an already-revealed
  // (face-up, dead) card must never go back into the court deck, and a live
  // card must never be hidden into a revealed slot.
  const unrevealed = unrevealedCards(actor);
  const candidates = [...unrevealed.map((u) => u.card.character), ...state.exchangeOffer];
  const requiredKeep = unrevealed.length;
  if (keepIndices.length !== requiredKeep || new Set(keepIndices).size !== requiredKeep) {
    throw new Error(`choose exactly ${requiredKeep} card(s) to keep`);
  }
  for (const i of keepIndices) if (i < 0 || i >= candidates.length) throw new Error('invalid selection');

  const kept = keepIndices.map((i) => candidates[i]);
  const returned = candidates.filter((_, i) => !keepIndices.includes(i));
  const deck = shuffle([...state.deck, ...returned]);

  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const influence = [...p.influence] as [Card, Card];
    unrevealed.forEach((u, i) => {
      influence[u.index] = { character: kept[i], revealed: false };
    });
    return { ...p, influence };
  });

  const logged = appendLog(state, `${actor.name} exchanged cards with the court deck.`);
  return advanceTurn({ ...logged, players, deck, exchangeOffer: null });
}
