// src/game/flip7/engine.ts
import { buildDeck, shuffle } from './setups';
import {
  FLIP_SEVEN_BONUS,
  WINNING_SCORE,
  type ActionCard,
  type Card,
  type Flip7State,
  type ModifierCard,
  type MultiplierCard,
  type NumberCard,
  type Player,
} from './types';

function nextLogId(state: Flip7State): number {
  return state.log.length + 1;
}

function appendLog(state: Flip7State, text: string): Flip7State {
  return { ...state, log: [...state.log, { id: nextLogId(state), text }] };
}

function getPlayer(state: Flip7State, id: string): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`unknown player ${id}`);
  return p;
}

function updatePlayer(state: Flip7State, playerId: string, fn: (p: Player) => Player): Flip7State {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? fn(p) : p)) };
}

function currentPlayer(state: Flip7State): Player {
  return state.players[state.turn];
}

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

// The score a hand would bank right now: number cards (doubled if the x2
// multiplier is held) + flat modifiers + the Flip 7 bonus if all 7 unique
// numbers have been collected. A busted/forfeited hand is emptied on the
// spot, so this naturally returns 0 for them without any special-casing.
export function computeHandScore(hand: Card[]): number {
  const numbers = hand.filter((c): c is NumberCard => c.kind === 'number');
  const modifiers = hand.filter((c): c is ModifierCard => c.kind === 'modifier');
  const hasMultiplier = hand.some((c) => c.kind === 'multiplier');
  const numberSum = numbers.reduce((s, c) => s + c.value, 0);
  const modifierSum = modifiers.reduce((s, c) => s + c.value, 0);
  const bonus = numbers.length >= 7 ? FLIP_SEVEN_BONUS : 0;
  return (hasMultiplier ? numberSum * 2 : numberSum) + modifierSum + bonus;
}

// ---- turn flow ----------------------------------------------------------

function advanceTurn(state: Flip7State): Flip7State {
  const active = state.players.filter((p) => p.status === 'active');
  if (active.length === 0) return endRound(state);
  let next = (state.turn + 1) % state.players.length;
  let guard = 0;
  while (state.players[next].status !== 'active') {
    next = (next + 1) % state.players.length;
    if (++guard > state.players.length) break;
  }
  return { ...state, turn: next };
}

// Draws for a Flip Three target happen automatically (there's no choice to
// stop mid-sequence) until its 3 cards are drawn, the target goes inactive
// (busted/frozen by a nested action card), or a fresh target choice is
// needed - at which point this pauses and resumes later from wherever it
// left off. Once the whole (possibly nested) queue drains, play returns to
// normal turn order.
function advanceForcedDraws(state: Flip7State): Flip7State {
  let s = state;
  while (s.flipThreeQueue.length > 0 && s.phase === 'round_active') {
    const front = s.flipThreeQueue[0];
    const target = getPlayer(s, front.targetId);
    if (target.status !== 'active' || front.remaining <= 0) {
      s = { ...s, flipThreeQueue: s.flipThreeQueue.slice(1) };
      continue;
    }
    s = drawOneCard(s, front.targetId, true);
  }
  if (s.phase === 'round_active' && s.flipThreeQueue.length === 0) {
    s = advanceTurn(s);
  }
  return s;
}

function continueAfterResolution(state: Flip7State): Flip7State {
  if (state.phase !== 'round_active') return state; // paused on a target choice, or the round/game just ended
  if (state.flipThreeQueue.length > 0) return advanceForcedDraws(state);
  return advanceTurn(state);
}

// ---- drawing & resolving -------------------------------------------------

function drawOneCard(state: Flip7State, playerId: string, isForced: boolean): Flip7State {
  let s = state;
  if (s.deck.length === 0) {
    s = { ...s, deck: shuffle(s.discard), discard: [] };
  }
  const deck = s.deck.slice();
  const card = deck.pop()!;
  s = { ...s, deck };
  if (isForced) {
    const queue = s.flipThreeQueue.slice();
    queue[0] = { ...queue[0], remaining: queue[0].remaining - 1 };
    s = { ...s, flipThreeQueue: queue };
  }
  switch (card.kind) {
    case 'number':
      return resolveNumberCard(s, playerId, card);
    case 'modifier':
      return resolveModifierCard(s, playerId, card);
    case 'multiplier':
      return resolveMultiplierCard(s, playerId, card);
    case 'action':
      return resolveActionCard(s, playerId, card);
  }
}

function resolveNumberCard(state: Flip7State, playerId: string, card: NumberCard): Flip7State {
  const player = getPlayer(state, playerId);
  const hasDuplicate = player.hand.some((c) => c.kind === 'number' && c.value === card.value);

  if (hasDuplicate) {
    const scIndex = player.hand.findIndex((c) => c.kind === 'action' && c.action === 'second-chance');
    if (scIndex >= 0) {
      const usedCard = player.hand[scIndex];
      const newHand = player.hand.filter((_, i) => i !== scIndex);
      let s = updatePlayer(state, playerId, (p) => ({ ...p, hand: newHand }));
      s = {
        ...s,
        discard: [...s.discard, card, usedCard],
        lastDraw: {
          id: nextLogId(state),
          card,
          playerId,
          playerName: player.name,
          outcome: 'second_chance_saved',
        },
      };
      return appendLog(s, `${player.name}'s Second Chance saves them from busting on ${card.value}.`);
    }
    const fullBustedHand = [...player.hand, card];
    let s = updatePlayer(state, playerId, (p) => ({ ...p, status: 'busted', hand: [], bustedHand: fullBustedHand }));
    s = {
      ...s,
      discard: [...s.discard, card, ...player.hand],
      lastDraw: {
        id: nextLogId(state),
        card,
        playerId,
        playerName: player.name,
        outcome: 'duplicate_bust',
        bustedHand: fullBustedHand,
      },
    };
    return appendLog(s, `${player.name} draws a duplicate ${card.value} and busts.`);
  }

  const newHand = [...player.hand, card];
  const uniqueNumbers = newHand.filter((c) => c.kind === 'number').length;
  const isFlip7 = uniqueNumbers >= 7;

  let s = updatePlayer(state, playerId, (p) => ({ ...p, hand: newHand }));
  s = {
    ...s,
    lastDraw: {
      id: nextLogId(state),
      card,
      playerId,
      playerName: player.name,
      outcome: isFlip7 ? 'flip_seven' : 'added',
    },
  };
  s = appendLog(s, `${player.name} draws ${card.value}.`);
  if (isFlip7) {
    s = appendLog(s, `${player.name} flips 7! The round ends immediately.`);
    return endRound(s);
  }
  return s;
}

function resolveModifierCard(state: Flip7State, playerId: string, card: ModifierCard): Flip7State {
  const player = getPlayer(state, playerId);
  const s = updatePlayer(state, playerId, (p) => ({ ...p, hand: [...p.hand, card] }));
  const withDraw: Flip7State = {
    ...s,
    lastDraw: {
      id: nextLogId(state),
      card,
      playerId,
      playerName: player.name,
      outcome: 'added',
    },
  };
  return appendLog(withDraw, `${player.name} draws +${card.value}.`);
}

function resolveMultiplierCard(state: Flip7State, playerId: string, card: MultiplierCard): Flip7State {
  const player = getPlayer(state, playerId);
  const s = updatePlayer(state, playerId, (p) => ({ ...p, hand: [...p.hand, card] }));
  const withDraw: Flip7State = {
    ...s,
    lastDraw: {
      id: nextLogId(state),
      card,
      playerId,
      playerName: player.name,
      outcome: 'added',
    },
  };
  return appendLog(withDraw, `${player.name} draws the x2 multiplier!`);
}

function resolveActionCard(state: Flip7State, playerId: string, card: ActionCard): Flip7State {
  const player = getPlayer(state, playerId);

  if (card.action === 'freeze') {
    const s = {
      ...state,
      discard: [...state.discard, card],
      lastDraw: {
        id: nextLogId(state),
        card,
        playerId,
        playerName: player.name,
        outcome: 'freeze' as const,
      },
    };
    return { ...appendLog(s, `${player.name} draws Freeze.`), phase: 'awaiting_target', pendingTarget: { drawerId: playerId, kind: 'freeze' } };
  }

  if (card.action === 'flip-three') {
    const s = {
      ...state,
      discard: [...state.discard, card],
      lastDraw: {
        id: nextLogId(state),
        card,
        playerId,
        playerName: player.name,
        outcome: 'flip_three' as const,
      },
    };
    return {
      ...appendLog(s, `${player.name} draws Flip Three.`),
      phase: 'awaiting_target',
      pendingTarget: { drawerId: playerId, kind: 'flip-three' },
    };
  }

  // second-chance
  const alreadyHas = player.hand.some((c) => c.kind === 'action' && c.action === 'second-chance');
  if (!alreadyHas) {
    const s = updatePlayer(state, playerId, (p) => ({ ...p, hand: [...p.hand, card] }));
    const withDraw: Flip7State = {
      ...s,
      lastDraw: {
        id: nextLogId(state),
        card,
        playerId,
        playerName: player.name,
        outcome: 'second_chance_kept',
      },
    };
    return appendLog(withDraw, `${player.name} draws a Second Chance.`);
  }
  const eligible = state.players.some(
    (p) => p.id !== playerId && p.status === 'active' && !p.hand.some((c) => c.kind === 'action' && c.action === 'second-chance'),
  );
  if (!eligible) {
    const s = {
      ...state,
      discard: [...state.discard, card],
      lastDraw: {
        id: nextLogId(state),
        card,
        playerId,
        playerName: player.name,
        outcome: 'second_chance_kept' as const,
      },
    };
    return appendLog(s, `${player.name} already has a Second Chance - the extra is discarded (no one else could take it).`);
  }
  const s: Flip7State = {
    ...state,
    lastDraw: {
      id: nextLogId(state),
      card,
      playerId,
      playerName: player.name,
      outcome: 'second_chance_giveaway',
    },
  };
  return {
    ...appendLog(s, `${player.name} already has a Second Chance and must give this one away.`),
    phase: 'awaiting_target',
    pendingTarget: { drawerId: playerId, kind: 'second-chance' },
  };
}

function endRound(state: Flip7State): Flip7State {
  const scores = new Map(state.players.map((p) => [p.id, p.status === 'forfeited' ? 0 : computeHandScore(p.hand)]));
  let s: Flip7State = {
    ...state,
    phase: 'round_over',
    players: state.players.map((p) => ({ ...p, totalScore: p.totalScore + (scores.get(p.id) ?? 0) })),
    flipThreeQueue: [],
    pendingTarget: null,
  };
  for (const p of state.players) {
    if (p.status === 'forfeited') continue;
    const score = scores.get(p.id) ?? 0;
    const newTotal = p.totalScore + score;
    s = appendLog(s, score > 0 ? `${p.name} banks ${score} point${plural(score)} (total ${newTotal}).` : `${p.name} scores 0 this round.`);
  }
  const contenders = s.players.filter((p) => p.status !== 'forfeited');
  const maxScore = Math.max(...contenders.map((p) => p.totalScore));
  const leaders = contenders.filter((p) => p.totalScore === maxScore);
  if (maxScore >= WINNING_SCORE && leaders.length === 1) {
    s = appendLog(s, `${leaders[0].name} wins the game with ${maxScore} points!`);
    s = { ...s, phase: 'game_over', winner: leaders[0].id };
  }
  return s;
}

// ---- public API -----------------------------------------------------------

export function createGame(players: { id: string; name: string }[]): Flip7State {
  if (players.length < 2 || players.length > 7) {
    throw new Error('Flip 7 supports 2-7 players');
  }
  const ps: Player[] = players.map((p) => ({ id: p.id, name: p.name, hand: [], status: 'active', totalScore: 0, connected: true }));
  const dealerIndex = 0;
  const turn = (dealerIndex + 1) % ps.length;
  let s: Flip7State = {
    players: ps,
    deck: buildDeck(),
    discard: [],
    lastDraw: null,
    dealerIndex,
    turn,
    phase: 'round_active',
    pendingTarget: null,
    flipThreeQueue: [],
    round: 1,
    log: [],
    winner: null,
  };
  return appendLog(s, `${ps[dealerIndex].name} is the dealer. Round 1 begins.`);
}


export function hit(state: Flip7State, playerId: string): Flip7State {
  if (state.phase !== 'round_active') throw new Error('not accepting hits right now');
  if (state.flipThreeQueue.length > 0) throw new Error('a forced draw is in progress');
  const player = currentPlayer(state);
  if (player.id !== playerId) throw new Error('not your turn');
  if (player.status !== 'active') throw new Error('you are not active this round');
  return continueAfterResolution(drawOneCard(state, playerId, false));
}

export function stay(state: Flip7State, playerId: string): Flip7State {
  if (state.phase !== 'round_active') throw new Error('not accepting actions right now');
  if (state.flipThreeQueue.length > 0) throw new Error('a forced draw is in progress');
  const player = currentPlayer(state);
  if (player.id !== playerId) throw new Error('not your turn');
  if (player.status !== 'active') throw new Error('you are not active this round');
  const score = computeHandScore(player.hand);
  let s = updatePlayer(state, playerId, (p) => ({ ...p, status: 'stayed' }));
  s = appendLog(s, `${player.name} stays with ${score} point${plural(score)} banked.`);
  return continueAfterResolution(s);
}

export function chooseFreezeTarget(state: Flip7State, drawerId: string, targetId: string): Flip7State {
  if (state.phase !== 'awaiting_target' || state.pendingTarget?.kind !== 'freeze') throw new Error('no Freeze is pending');
  if (state.pendingTarget.drawerId !== drawerId) throw new Error('not your Freeze to resolve');
  const drawer = getPlayer(state, drawerId);
  const target = getPlayer(state, targetId);
  if (target.status !== 'active') throw new Error('that player cannot be frozen');
  const score = computeHandScore(target.hand);
  let s = updatePlayer(state, targetId, (p) => ({ ...p, status: 'frozen' }));
  s = appendLog(s, `${drawer.name} freezes ${target.name}, who banks ${score} point${plural(score)}.`);
  s = { ...s, phase: 'round_active', pendingTarget: null };
  return continueAfterResolution(s);
}

export function chooseFlipThreeTarget(state: Flip7State, drawerId: string, targetId: string): Flip7State {
  if (state.phase !== 'awaiting_target' || state.pendingTarget?.kind !== 'flip-three') throw new Error('no Flip Three is pending');
  if (state.pendingTarget.drawerId !== drawerId) throw new Error('not your Flip Three to resolve');
  const drawer = getPlayer(state, drawerId);
  const target = getPlayer(state, targetId);
  if (target.status !== 'active') throw new Error('that player cannot be targeted');
  let s = appendLog(state, `${drawer.name} uses Flip Three on ${target.name}.`);
  s = {
    ...s,
    phase: 'round_active',
    pendingTarget: null,
    flipThreeQueue: [{ targetId, remaining: 3, initiatorId: drawerId }, ...s.flipThreeQueue],
  };
  return continueAfterResolution(s);
}

export function chooseSecondChanceRecipient(state: Flip7State, drawerId: string, recipientId: string): Flip7State {
  if (state.phase !== 'awaiting_target' || state.pendingTarget?.kind !== 'second-chance') throw new Error('no Second Chance is pending');
  if (state.pendingTarget.drawerId !== drawerId) throw new Error('not your Second Chance to give away');
  if (recipientId === drawerId) throw new Error('you already hold a Second Chance');
  const drawer = getPlayer(state, drawerId);
  const recipient = getPlayer(state, recipientId);
  if (recipient.status !== 'active') throw new Error('that player cannot receive it');
  if (recipient.hand.some((c) => c.kind === 'action' && c.action === 'second-chance')) throw new Error('that player already has one');
  let s = updatePlayer(state, recipientId, (p) => ({ ...p, hand: [...p.hand, { kind: 'action', action: 'second-chance' }] }));
  s = appendLog(s, `${drawer.name} gives their extra Second Chance to ${recipient.name}.`);
  s = { ...s, phase: 'round_active', pendingTarget: null };
  return continueAfterResolution(s);
}

export function startNextRound(state: Flip7State, playerId: string): Flip7State {
  if (state.phase !== 'round_over') throw new Error('the round is not over yet');
  if (!state.players.some((p) => p.id === playerId)) throw new Error('not in this game');
  let dealerIndex = state.dealerIndex;
  do {
    dealerIndex = (dealerIndex + 1) % state.players.length;
  } while (state.players[dealerIndex].status === 'forfeited');
  const players = state.players.map((p) => (p.status === 'forfeited' ? p : { ...p, hand: [], bustedHand: undefined, status: 'active' as const }));
  let turn = dealerIndex;
  do {
    turn = (turn + 1) % players.length;
  } while (players[turn].status !== 'active');
  let s: Flip7State = {
    ...state,
    players,
    deck: buildDeck(),
    discard: [],
    lastDraw: null,
    dealerIndex,
    turn,
    phase: 'round_active',
    pendingTarget: null,
    flipThreeQueue: [],
    round: state.round + 1,
  };
  return appendLog(s, `Round ${s.round} begins. ${players[dealerIndex].name} is the dealer.`);
}

// Called by the room server when a disconnected player's forfeit clock
// expires. A forfeit can land at any point in the state machine - mid-turn,
// mid-forced-draw, or while a target choice is pending - so it must clean up
// whatever might still reference the forfeiting player as a ghost.
export function forfeitPlayer(state: Flip7State, playerId: string): Flip7State {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.status === 'forfeited') return state;

  let s = appendLog(state, `${player.name} disconnected too long and forfeits.`);
  s = { ...s, players: s.players.map((p) => (p.id === playerId ? { ...p, status: 'forfeited', hand: [] } : p)) };

  const remaining = s.players.filter((p) => p.status !== 'forfeited');
  if (remaining.length < 2) {
    const winner = remaining[0] ?? null;
    return { ...s, phase: 'game_over', winner: winner?.id ?? null, flipThreeQueue: [], pendingTarget: null };
  }

  const wasCurrentTurn = s.phase === 'round_active' && s.players[s.turn]?.id === playerId;
  const wasPendingDrawer = s.pendingTarget?.drawerId === playerId;
  const wasForcedTarget = s.flipThreeQueue.some((f) => f.targetId === playerId);

  if (wasPendingDrawer) s = { ...s, phase: 'round_active', pendingTarget: null };
  s = { ...s, flipThreeQueue: s.flipThreeQueue.filter((f) => f.targetId !== playerId) };

  if (wasCurrentTurn || wasPendingDrawer || wasForcedTarget) {
    return s.flipThreeQueue.length > 0 ? advanceForcedDraws(s) : advanceTurn(s);
  }
  return s;
}
