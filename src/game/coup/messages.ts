import type { ActionType, BlockCharacter, Character } from './types';
import type { ClientCoupState } from './redact';

export type ClientMessage =
  | { type: 'join'; playerId: string; name: string; code?: string }
  | { type: 'start' } // host starts the game once 2-6 seats are filled
  | { type: 'declare-action'; action: ActionType; targetId: string | null }
  | { type: 'declare-block'; character: BlockCharacter }
  | { type: 'challenge' }
  | { type: 'pass' } // explicitly decline to challenge/block this window
  | { type: 'choose-reveal'; cardIndex: 0 | 1 }
  | { type: 'choose-exchange'; keepIndices: number[] }
  | { type: 'choose-starting-character'; character: Character } // 2p variant only
  | { type: 'rematch' }
  | { type: 'rematch-decline' };

export type ServerMessage =
  | { type: 'joined'; code: string; playerId: string; seated: boolean }
  | { type: 'lobby'; code: string; seats: { id: string; name: string; connected: boolean }[]; maxSeats: number; canStart: boolean }
  | { type: 'state'; state: ClientCoupState; responseDeadline: number | null } // epoch ms, or null if no window is open
  | { type: 'error'; message: string }
  | { type: 'forfeit'; playerId: string }
  | { type: 'rematch-votes'; ids: string[] }
  | { type: 'rematch' };
