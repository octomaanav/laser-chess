// Pure Flip 7 domain types. No imports from server/ or components/.

export type NumberValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type ModifierValue = 2 | 4 | 6 | 8 | 10;
export type ActionKind = 'freeze' | 'flip-three' | 'second-chance';

export interface NumberCard {
  kind: 'number';
  value: NumberValue;
}
export interface ModifierCard {
  kind: 'modifier';
  value: ModifierValue;
}
export interface MultiplierCard {
  kind: 'multiplier'; // the single x2 card - doubles the number-card sum at scoring
}
export interface ActionCard {
  kind: 'action';
  action: ActionKind;
}

export type Card = NumberCard | ModifierCard | MultiplierCard | ActionCard;

export type DrawOutcome =
  | 'added'
  | 'duplicate_bust'
  | 'second_chance_saved'
  | 'freeze'
  | 'flip_three'
  | 'second_chance_kept'
  | 'second_chance_giveaway'
  | 'flip_seven';

export interface LastDraw {
  id: number;
  card: Card;
  playerId: string;
  playerName: string;
  outcome: DrawOutcome;
  bustedHand?: Card[];
}

export type PlayerStatus = 'active' | 'stayed' | 'busted' | 'frozen' | 'forfeited';

export interface Player {
  id: string;
  name: string;
  hand: Card[]; // cards collected so far this round - fully public in Flip 7, no hidden info
  bustedHand?: Card[]; // cards held when busted (for round review)
  status: PlayerStatus;
  totalScore: number; // running game total, banked at the end of every round
  connected: boolean;
}

export type Phase =
  | 'round_active' // normal hit/stay turn order
  | 'awaiting_target' // pendingTarget's drawer must choose who a Freeze / Flip Three / spare Second Chance applies to
  | 'round_over' // scores banked for this round, waiting for someone to start the next one
  | 'game_over';

export interface PendingTarget {
  drawerId: string; // whoever drew the action card and must choose its target
  kind: ActionKind;
}

// A Flip Three forces its target to draw 3 cards in a row, resolved one at a
// time. Drawing a second Flip Three mid-sequence pushes a new entry in front
// of this one (LIFO) - the newest forced draw always resolves to completion
// before the sequence that spawned it resumes.
export interface ForcedDraw {
  targetId: string;
  remaining: number;
  initiatorId: string;
}

export interface LogEntry {
  id: number;
  text: string;
}

export interface Flip7State {
  players: Player[]; // seat order = turn order
  deck: Card[];
  discard: Card[];
  lastDraw: LastDraw | null;
  dealerIndex: number;
  turn: number; // index into players[] of whose normal turn it is
  phase: Phase;
  pendingTarget: PendingTarget | null;
  flipThreeQueue: ForcedDraw[];
  round: number; // 1-indexed
  log: LogEntry[];
  winner: string | null; // player id, set once phase === 'game_over'
}

export const FLIP_SEVEN_BONUS = 15;
export const WINNING_SCORE = 200;

