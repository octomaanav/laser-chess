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
  | { type: 'join'; playerId: string; name: string; code?: string; setup?: string; color?: Color | 'random' }
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
    }
  | { type: 'rematch' }
  | { type: 'reseat'; you: Color | null }
  | { type: 'error'; message: string }
  | { type: 'chat'; name: string; color: Color | null; text: string };
