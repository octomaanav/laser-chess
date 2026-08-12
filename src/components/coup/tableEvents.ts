// src/components/coup/tableEvents.ts
//
// src/game/coup/ is off-limits for this redesign, and its LogEntry is plain
// text — so there's no structured "what happened" event to animate against.
// Instead, every incoming ClientCoupState is diffed against the previous one
// to reconstruct a short list of table-level events (coins moved, a card
// flipped, a block appeared). This file is pure and DOM-free so it can be
// unit tested without React.
import type { ClientCoupState } from '@/game/coup/redact';
import type { Character } from '@/game/coup/types';

export type TableEvent =
  | { id: string; kind: 'coins-gained'; playerId: string; amount: number }
  | { id: string; kind: 'coins-stolen'; fromId: string; toId: string; amount: number }
  | { id: string; kind: 'treasury-paid'; playerId: string; amount: number }
  | { id: string; kind: 'card-revealed'; playerId: string; cardIndex: 0 | 1; cause: 'challenge-lost' | 'hit' | null }
  | { id: string; kind: 'claim-proved'; playerId: string; character: Character }
  | { id: string; kind: 'block-declared'; actorId: string };

export function deriveTableEvents(prev: ClientCoupState | null, next: ClientCoupState): TableEvent[] {
  if (!prev) return [];
  const events: TableEvent[] = [];
  const tick = next.log.length;
  const treasuryDelta = next.treasury - prev.treasury;

  const gains: { playerId: string; amount: number }[] = [];
  const losses: { playerId: string; amount: number }[] = [];

  // Whoever ClientCoupState.pendingRevealPlayerId names right before a
  // reveal lands is the forced-reveal player; pendingAction/pendingBlock at
  // that same moment tell us why (a challenge they lost, or a coup/
  // assassinate hit) — ClientCoupState never exposes a reveal "reason"
  // field directly (see src/game/coup/redact.ts), so this is reconstructed
  // from context instead.
  // A pendingBlock takes priority: pendingAction stays set the whole time a
  // block is being contested (see engine.ts), so without this a challenge
  // against the BLOCK gets misattributed to the original action's actor/claim.
  const blockActive = next.pendingBlock ?? prev.pendingBlock;
  const accusedId = blockActive ? blockActive.byId : (next.pendingAction?.actorId ?? null);
  const claimedCharacter = blockActive ? blockActive.claimedCharacter : (next.pendingAction?.claimedCharacter ?? null);

  for (const nextPlayer of next.players) {
    const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
    if (!prevPlayer) continue;

    const coinDelta = nextPlayer.coins - prevPlayer.coins;
    if (coinDelta > 0) gains.push({ playerId: nextPlayer.id, amount: coinDelta });
    if (coinDelta < 0) losses.push({ playerId: nextPlayer.id, amount: -coinDelta });

    nextPlayer.influence.forEach((card, index) => {
      const prevCard = prevPlayer.influence[index];
      if (card.revealed && !prevCard.revealed) {
        let cause: 'challenge-lost' | 'hit' | null = null;
        if (prev.pendingRevealPlayerId === nextPlayer.id) {
          if (accusedId === nextPlayer.id && claimedCharacter) cause = 'challenge-lost';
          else if (prev.pendingAction && (prev.pendingAction.type === 'coup' || prev.pendingAction.type === 'assassinate') && prev.pendingAction.targetId === nextPlayer.id) cause = 'hit';
        }
        events.push({ id: `reveal-${nextPlayer.id}-${index}-${tick}`, kind: 'card-revealed', playerId: nextPlayer.id, cardIndex: index as 0 | 1, cause });
      }
    });
  }

  // Steal moves coins directly between two players and never touches the
  // treasury — a matched gain/loss pair with treasury unchanged is a steal.
  if (treasuryDelta === 0 && gains.length > 0 && losses.length > 0) {
    for (const loss of losses) {
      const matchIndex = gains.findIndex((g) => g.amount === loss.amount);
      if (matchIndex === -1) continue;
      const [gain] = gains.splice(matchIndex, 1);
      events.push({ id: `steal-${loss.playerId}-${gain.playerId}-${tick}`, kind: 'coins-stolen', fromId: loss.playerId, toId: gain.playerId, amount: loss.amount });
    }
  }

  // Income / Foreign Aid / Tax: treasury shrank while a player grew.
  if (treasuryDelta < 0) {
    for (const gain of gains) {
      events.push({ id: `gain-${gain.playerId}-${tick}`, kind: 'coins-gained', playerId: gain.playerId, amount: gain.amount });
    }
  }

  // Coup / Assassinate cost: treasury grew while a player paid in.
  if (treasuryDelta > 0) {
    for (const loss of losses) {
      events.push({ id: `paid-${loss.playerId}-${tick}`, kind: 'treasury-paid', playerId: loss.playerId, amount: loss.amount });
    }
  }

  // A challenge either forces the accused to reveal (they were bluffing) or
  // forces the challenger to reveal instead (the accused proved their
  // claim). pendingRevealPlayerId naming anyone other than the accused,
  // while the accused's claim is still standing, means the accused proved
  // it and gets a "proved" flourish of their own.
  if (next.pendingRevealPlayerId && next.pendingRevealPlayerId !== prev.pendingRevealPlayerId) {
    if (accusedId && claimedCharacter && next.pendingRevealPlayerId !== accusedId) {
      events.push({ id: `proved-${accusedId}-${tick}`, kind: 'claim-proved', playerId: accusedId, character: claimedCharacter });
    }
  }

  if (next.pendingBlock && !prev.pendingBlock && next.pendingAction) {
    events.push({ id: `block-${next.pendingAction.actorId}-${tick}`, kind: 'block-declared', actorId: next.pendingAction.actorId });
  }

  return events;
}
