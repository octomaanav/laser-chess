import type { Character, CoupState, LogEntry, PendingAction, PendingBlock } from './types';

export interface RedactedCard {
  character: Character | null; // null unless revealed or it's the viewer's own card
  revealed: boolean;
}

export interface RedactedPlayer {
  id: string;
  name: string;
  coins: number;
  eliminated: boolean;
  connected: boolean;
  influenceCount: number;
  influence: RedactedCard[];
}

export interface ClientCoupState {
  you: string;
  players: RedactedPlayer[];
  deckSize: number;
  treasury: number;
  turn: number;
  phase: CoupState['phase'];
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  pendingRevealPlayerId: string | null;
  exchangeOffer: Character[] | null;
  variantPoolForYou: Character[] | null;
  log: LogEntry[];
  winner: string | null;
}

export function redactStateFor(state: CoupState, viewerId: string): ClientCoupState {
  return {
    you: viewerId,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      coins: p.coins,
      eliminated: p.eliminated,
      connected: p.connected,
      influenceCount: p.influence.filter((c) => !c.revealed).length,
      influence: p.influence.map((c) =>
        c.revealed || p.id === viewerId ? { character: c.character, revealed: c.revealed } : { character: null, revealed: false },
      ),
    })),
    deckSize: state.deck.length,
    treasury: state.treasury,
    turn: state.turn,
    phase: state.phase,
    pendingAction: state.pendingAction,
    pendingBlock: state.pendingBlock,
    pendingRevealPlayerId: state.pendingReveals[0]?.playerId ?? null,
    exchangeOffer: state.phase === 'exchange_choice' && state.pendingAction?.actorId === viewerId ? state.exchangeOffer : null,
    variantPoolForYou: state.phase === 'variant-setup' ? (state.variantPools?.[viewerId] ?? null) : null,
    log: state.log,
    winner: state.winner,
  };
}
