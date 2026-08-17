// Pure Coup domain types. No imports from server/ or components/.

export type Character = 'chair' | 'fixer' | 'auditor' | 'broker' | 'counsel';
export type BlockCharacter = 'chair' | 'counsel' | 'broker' | 'auditor';
export type ActionType = 'income' | 'foreign-aid' | 'coup' | 'tax' | 'assassinate' | 'exchange' | 'steal';

export interface Card {
  character: Character;
  revealed: boolean;
}

export interface Player {
  id: string;
  name: string;
  coins: number;
  influence: [Card, Card];
  eliminated: boolean;
  connected: boolean;
}

export interface PendingAction {
  type: ActionType;
  actorId: string;
  targetId: string | null;
  claimedCharacter: Character | null;
  costPaid: number;
}

export interface PendingBlock {
  byId: string;
  claimedCharacter: BlockCharacter;
}

export interface PendingReveal {
  playerId: string;
  reason: 'lost-challenge' | 'coup' | 'assassinate';
}

export type Phase =
  | 'variant-setup' // 2-player only: both players drafting their starting character
  | 'idle' // waiting on the current player's turn
  | 'action_declared' // response window #1: challenge the action, or block it
  | 'block_declared' // response window #2: challenge the block
  | 'awaiting_reveal' // one or more players must choose which influence card to flip
  | 'exchange_choice' // the acting player is choosing which cards to keep (Broker)
  | 'game_over';

export interface LogEntry {
  id: number;
  text: string;
}

// What happens once the current reveal queue drains, set whenever a
// challenge is resolved so chooseReveal knows what to do next.
export type PendingResolution = 'apply-action' | 'action-failed' | 'refund-actor' | null;

export interface CoupState {
  players: Player[]; // seat order = turn order
  deck: Character[]; // face-down court deck (never sent to clients directly - see redact.ts)
  treasury: number;
  turn: number; // index into players[] of whose turn it is
  phase: Phase;
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  pendingReveals: PendingReveal[];
  pendingResolution: PendingResolution;
  exchangeOffer: Character[] | null; // the 2 cards drawn for a Broker exchange
  variantPools: Record<string, Character[]> | null; // 2p variant: each player's private 5-card draft pool
  variantChoices: Record<string, Character> | null; // 2p variant: each player's chosen starting character
  log: LogEntry[];
  winner: string | null; // player id, set once phase === 'game_over'
}

export const ALL_CHARACTERS: Character[] = ['chair', 'fixer', 'auditor', 'broker', 'counsel'];

export const BLOCKERS_FOR: Partial<Record<ActionType, BlockCharacter[]>> = {
  'foreign-aid': ['chair'],
  assassinate: ['counsel'],
  steal: ['auditor', 'broker'],
};

export const CLAIM_FOR: Partial<Record<ActionType, Character>> = {
  tax: 'chair',
  assassinate: 'fixer',
  exchange: 'broker',
  steal: 'auditor',
};

export const COST_FOR: Record<ActionType, number> = {
  income: 0,
  'foreign-aid': 0,
  coup: 7,
  tax: 0,
  assassinate: 3,
  exchange: 0,
  steal: 0,
};

export const TARGETED_ACTIONS: ActionType[] = ['coup', 'assassinate', 'steal'];
// Never open a response window - resolve immediately.
export const UNCONTESTABLE_ACTIONS: ActionType[] = ['income', 'coup'];
