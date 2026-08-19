import type { Flip7State, ForcedDraw, LogEntry, PendingTarget, Phase, Player } from './types';

// Flip 7 hands are fully public once drawn (players watch each other's
// progress toward 7 unique numbers), so unlike Coup there's no hidden
// per-player information to strip. The only thing that must never reach the
// client is the draw pile's order/composition - counts are enough for the UI.
export interface ClientFlip7State {
  you: string;
  players: Player[];
  deckCount: number;
  discardCount: number;
  dealerIndex: number;
  turn: number;
  phase: Phase;
  pendingTarget: PendingTarget | null;
  flipThreeQueue: ForcedDraw[];
  round: number;
  log: LogEntry[];
  winner: string | null;
}

export function redactStateFor(state: Flip7State, viewerId: string): ClientFlip7State {
  return {
    you: viewerId,
    players: state.players,
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    dealerIndex: state.dealerIndex,
    turn: state.turn,
    phase: state.phase,
    pendingTarget: state.pendingTarget,
    flipThreeQueue: state.flipThreeQueue,
    round: state.round,
    log: state.log,
    winner: state.winner,
  };
}
