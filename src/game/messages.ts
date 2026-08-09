// Wire protocol shared between client and server.
import type { Action, Board, Color, Hit, LaserPoint } from './types';

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
  | { type: 'join'; playerId: string; name: string; code?: string; setup?: string; color?: Color | 'random'; perMove?: number }
  | { type: 'action'; action: Action }
  | { type: 'rematch'; setup?: string }
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
      names: Names;
      seated: PlayerSlots;
      online: PlayerSlots;
      perMoveMs: number; // 0 = no per-move timer
      turnEndsIn: number | null; // ms left for the current turn, or null if the clock isn't running
      forfeitOf: Color | null; // a disconnected player who will forfeit, or null
      forfeitEndsIn: number | null; // ms until that forfeit, or null
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
      perMoveMs: number;
      turnEndsIn: number | null;
    }
  | { type: 'timeout'; winner: Color } // a player ran out of time
  | { type: 'forfeit'; winner: Color } // opponent disconnected and didn't return in time
  | { type: 'rematch' }
  | { type: 'reseat'; you: Color | null }
  | { type: 'error'; message: string }
  | { type: 'chat'; name: string; color: Color | null; text: string };
