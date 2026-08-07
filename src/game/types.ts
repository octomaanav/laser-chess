// Shared game types used by both the server and the browser.

export type Color = 'red' | 'silver';

export type PieceType = 'pharaoh' | 'pyramid' | 'scarab' | 'anubis' | 'sphinx';

export interface Piece {
  id: string;
  type: PieceType;
  color: Color;
  orient: number; // 0=N 1=E 2=S 3=W
}

export type Cell = Piece | null;
export type Board = Cell[][]; // board[y][x], y: 0..7 (top), x: 0..9 (left)

export interface MoveAction {
  type: 'move';
  x: number;
  y: number;
  tx: number;
  ty: number;
  swap?: boolean;
}

export interface RotateAction {
  type: 'rotate';
  x: number;
  y: number;
  orient: number;
  spin?: 1 | -1;
}

export type Action = MoveAction | RotateAction;

export interface LaserPoint {
  x: number;
  y: number;
}

export interface Hit {
  x: number;
  y: number;
  piece: Piece;
}

export interface GameState {
  setup: string;
  board: Board;
  turn: Color;
  winner: Color | null;
  moveCount: number;
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  board?: Board;
  laser?: LaserPoint[];
  removed?: Hit | null;
  winner?: Color | null;
  turn?: Color;
}

// ---- editable starting configurations (admin editor) -----------------------
export interface EditablePiece {
  x: number;
  y: number;
  type: PieceType;
  color: Color;
  orient: number;
}

export interface SetupDef {
  name: string;
  pieces: EditablePiece[];
}
