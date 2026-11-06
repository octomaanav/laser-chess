// Wire protocol shared between client and server.
import type { Action, Board, Color, DrawReason, Hit, LaserPoint } from './types';
import type { Difficulty } from './bot/types';

export interface PlayerSlots {
  red: boolean;
  silver: boolean;
}
export interface Names {
  red: string | null;
  silver: string | null;
}

// ---- client → server -------------------------------------------------------
export type ClientMessage =
  | { type: 'join'; playerId: string; name: string; code?: string; setup?: string; color?: Color | 'random'; perMove?: number; vsBot?: Difficulty }
  | { type: 'action'; action: Action }
  | { type: 'rematch'; setup?: string } // request or accept a rematch
  | { type: 'rematch-decline' } // decline / cancel a pending rematch
  | { type: 'leave' } // deliberately quitting a live game - an immediate loss
  | { type: 'resign' } // conceding while staying in the room
  | { type: 'draw-offer' } // offer (or accept, if the opponent already offered) a draw
  | { type: 'draw-decline' } // decline the opponent's offer, or withdraw your own
  | { type: 'chat'; text: string };

// ---- server → client -------------------------------------------------------
export type ServerMessage =
  | { type: 'joined'; code: string; you: Color | null; spectator: boolean }
  | {
      type: 'state';
      code: string;
      setup: string;
      board: Board;
      turn: Color;
      winner: Color | null;
      draw: DrawReason | null;
      drawOffer: Color | null; // who has a draw offer pending, if anyone
      names: Names;
      seated: PlayerSlots;
      online: PlayerSlots;
      perMoveMs: number; // 0 = no per-move timer
      turnEndsIn: number | null; // ms left for the current turn, or null if the clock isn't running
      forfeitOf: Color | null; // a disconnected player who will forfeit, or null
      forfeitEndsIn: number | null; // ms until that forfeit, or null
      rematch: PlayerSlots; // which players have requested a rematch
      isRanked?: boolean;
    }
  | {
      type: 'move';
      by: Color;
      action: Action;
      laser: LaserPoint[];
      removed: Hit | null;
      board: Board;
      turn: Color;
      winner: Color | null;
      draw: DrawReason | null;
      perMoveMs: number;
      turnEndsIn: number | null;
    }
  | { type: 'timeout'; winner: Color } // a player ran out of time
  | { type: 'forfeit'; winner: Color } // opponent disconnected and didn't return in time
  | { type: 'resign'; winner: Color } // the other player resigned
  | { type: 'draw'; reason: DrawReason } // the game ended in a draw outside of a move (i.e. by agreement)
  | { type: 'draw-declined'; by: Color } // a pending draw offer was declined or withdrawn
  | { type: 'rematch' } // both agreed - the game has been reset
  | { type: 'rematch-declined'; by: Color } // opponent declined/cancelled the rematch
  | { type: 'reseat'; you: Color | null }
  | { type: 'error'; message: string }
  | { type: 'chat'; name: string; color: Color | null; text: string };
