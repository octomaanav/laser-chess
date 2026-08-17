// Storage abstraction. Two backends implement this: a file backend (local dev,
// zero setup) and a Postgres backend (production, via DATABASE_URL).
import type { Color, GameState, SetupDef } from '../../game/types';
import type { Difficulty } from '../../game/bot/types';
import type { CoupState } from '../../game/coup/types';

export interface PersistedRoom {
  code: string;
  game: GameState;
  seats: { red: string | null; silver: string | null };
  names: { red: string | null; silver: string | null };
  perMoveMs: number;
  turnStartedAt?: number | null; // epoch ms the current turn started
  forfeitColor?: Color | null; // a disconnected player with a running forfeit clock
  forfeitDeadline?: number | null; // epoch ms the forfeit fires (survives restart)
  botDifficulty?: Partial<Record<Color, Difficulty>>; // which seat(s), if any, are bots
  isRanked?: boolean;
  rankedGameSlug?: string;
  rankedUserIds?: { red: string | null; silver: string | null };
  rankedSettled?: boolean; // rank already awarded - survives a restart so it can't be awarded twice
}

// Skill rating for one player in one game. `gameSlug` scopes ratings per game
// so the same account can hold a separate rank in Laser Chess, Poker, etc.
// `rating` is a rank index (see game/ranking.ts), not an Elo score.
export interface PlayerRating {
  userId: string;
  gameSlug: string;
  rating: number;
  peakRating: number;
  wins: number;
  losses: number;
  updatedAt: number; // epoch ms
}

// A registered account. `email` and `username` are stored already-lowercased so
// their uniqueness is case-insensitive. `passwordHash` is null for accounts that
// only sign in through an OAuth provider. `displayName` preserves the user's casing.
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  createdAt: number; // epoch ms
}

// A link between an account and an external identity provider (Google/GitHub).
// A single account may have several (e.g. Google + GitHub both linked).
export interface OAuthIdentity {
  provider: string; // 'google' | 'github'
  providerId: string; // the provider's stable user id (sub / numeric id)
  userId: string;
}

// A persisted Coup room (separate table/namespace from Laser Chess's rooms - see roomServer.ts).
export interface PersistedCoupRoom {
  code: string;
  state: CoupState;
  seats: string[]; // player ids in seat order
  names: Record<string, string>;
  responseDeadline: number | null; // epoch ms, survives restart
  forfeitPlayerId: string | null;
  forfeitDeadline: number | null;
}

// One side of a friendship as seen by a given user. `direction` only matters
// while `pending` (did I send it or receive it); it's 'outgoing' for accepted.
export interface FriendEdge {
  otherId: string;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
}

export interface GameMatch {
  id: string;
  gameSlug: string;
  roomCode: string;
  player1Name?: string | null;
  player1UserId?: string | null;
  player2Name?: string | null;
  player2UserId?: string | null;
  allPlayers?: Array<{ name: string; userId?: string | null; seat?: string | null }>;
  isBot?: boolean;
  botDifficulty?: string | null;
  isRanked?: boolean;
  status: 'completed' | 'forfeit' | 'timeout' | 'resigned';
  winnerName?: string | null;
  winnerColor?: string | null;
  winnerUserId?: string | null;
  movesCount: number;
  durationSeconds: number;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  createdAt?: number; // epoch ms
}

export interface ActiveRoomSummary {
  code: string;
  gameSlug: string;
  hostName: string | null;
  playerNames: Record<string, string | null> | string[];
  playerCount: number;
  isBot: boolean;
  botDifficulty: string | null;
  isRanked: boolean;
  status: string;
  updatedAt: number;
}

export interface Store {
  // custom starting configurations (defaults are merged in by the caller)
  getCustomSetups(): Promise<Record<string, SetupDef>>;
  saveSetup(def: SetupDef): Promise<void>;
  deleteSetup(name: string): Promise<void>;

  // admin session-cookie signing secret (created on first use)
  getSecret(): Promise<string>;

  // live game rooms (so games survive a server restart / redeploy / sleep)
  loadRoom(code: string): Promise<PersistedRoom | null>;
  saveRoom(room: PersistedRoom): Promise<void>;
  deleteRoom(code: string): Promise<void>;
  sweepRooms(maxAgeMs: number): Promise<void>;

  // Coup rooms (separate table/namespace from Laser Chess's rooms - see roomServer.ts)
  loadCoupRoom(code: string): Promise<PersistedCoupRoom | null>;
  saveCoupRoom(room: PersistedCoupRoom): Promise<void>;
  deleteCoupRoom(code: string): Promise<void>;
  sweepCoupRooms(maxAgeMs: number): Promise<void>;

  // user accounts (email/password + linked OAuth identities)
  createUser(user: User): Promise<void>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>; // email is matched lowercased
  getUserByUsername(username: string): Promise<User | null>; // username is matched lowercased
  updateUser(id: string, patch: Partial<Pick<User, 'username' | 'displayName' | 'passwordHash'>>): Promise<void>;
  getUserByIdentity(provider: string, providerId: string): Promise<User | null>;
  linkIdentity(identity: OAuthIdentity): Promise<void>;
  listIdentities(userId: string): Promise<OAuthIdentity[]>;

  // friendships (requests + accepted). Edges are stored once per unordered pair.
  createFriendRequest(requesterId: string, addresseeId: string): Promise<void>;
  acceptFriendRequest(addresseeId: string, requesterId: string): Promise<void>;
  deleteFriendship(userId: string, otherId: string): Promise<void>; // deny / cancel / unfriend
  listFriendships(userId: string): Promise<FriendEdge[]>;

  // per-player rank indices, scoped per game slug
  getRating(userId: string, gameSlug: string): Promise<PlayerRating | null>;
  upsertRating(r: PlayerRating): Promise<void>;

  // game match logs & history
  recordMatch(match: GameMatch): Promise<void>;
  getRecentMatches(limit?: number): Promise<GameMatch[]>;

  // active rooms
  getActiveRooms(): Promise<ActiveRoomSummary[]>;
}
