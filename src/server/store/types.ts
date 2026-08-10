// Storage abstraction. Two backends implement this: a file backend (local dev,
// zero setup) and a Postgres backend (production, via DATABASE_URL).
import type { Color, GameState, SetupDef } from '../../game/types';

export interface PersistedRoom {
  code: string;
  game: GameState;
  seats: { red: string | null; silver: string | null };
  names: { red: string | null; silver: string | null };
  perMoveMs: number;
  forfeitColor?: Color | null; // a disconnected player with a running forfeit clock
  forfeitDeadline?: number | null; // epoch ms the forfeit fires (survives restart)
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

  // user accounts (email/password + linked OAuth identities)
  createUser(user: User): Promise<void>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>; // email is matched lowercased
  getUserByUsername(username: string): Promise<User | null>; // username is matched lowercased
  updateUser(id: string, patch: Partial<Pick<User, 'username' | 'displayName' | 'passwordHash'>>): Promise<void>;
  getUserByIdentity(provider: string, providerId: string): Promise<User | null>;
  linkIdentity(identity: OAuthIdentity): Promise<void>;
  listIdentities(userId: string): Promise<OAuthIdentity[]>;
}
