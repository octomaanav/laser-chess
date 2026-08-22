import type { ClientFlip7State } from './redact';

export type ClientMessage =
  | { type: 'join'; playerId: string; name: string; code?: string }
  | { type: 'start' } // host starts the game once 2-7 seats are filled
  | { type: 'hit' }
  | { type: 'stay' }
  | { type: 'choose-freeze-target'; targetId: string }
  | { type: 'choose-flip-three-target'; targetId: string }
  | { type: 'choose-second-chance-recipient'; recipientId: string }
  | { type: 'start-next-round' }
  | { type: 'rematch' }
  | { type: 'rematch-decline' };

export type ServerMessage =
  | { type: 'joined'; code: string; playerId: string; seated: boolean }
  | { type: 'lobby'; code: string; seats: { id: string; name: string; connected: boolean }[]; maxSeats: number; canStart: boolean }
  | { type: 'state'; state: ClientFlip7State }
  | { type: 'error'; message: string }
  | { type: 'forfeit'; playerId: string }
  | { type: 'rematch-votes'; ids: string[] }
  | { type: 'rematch' };
