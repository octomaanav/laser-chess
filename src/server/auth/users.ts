// Account operations (server-only) layered over the Store: sign up, sign in, and
// find-or-create from an OAuth profile. Validation lives here so every entry point
// (API routes, OAuth callback) enforces the same rules.
import crypto from 'node:crypto';
import { getStore, type OAuthIdentity, type User } from '../store';
import type { OAuthProfile, Provider } from './oauth';
import { hashPassword, verifyPassword } from './password';

// What we expose to the client - never the password hash.
export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
}

export function toPublic(u: User): PublicUser {
  return { id: u.id, email: u.email, username: u.username, displayName: u.displayName };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function newId(): string {
  return 'u_' + crypto.randomBytes(12).toString('base64url');
}

// ---- validation ------------------------------------------------------------
export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}
export function validateEmail(email: string): string {
  const e = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new AuthError('Enter a valid email address.');
  return e;
}
export function validateUsername(username: string): string {
  const u = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(u)) {
    throw new AuthError('Username must be 3–20 characters: letters, numbers, or underscores.');
  }
  return u;
}
export function validateDisplayName(name: string): string {
  const d = String(name || '').trim().slice(0, 24);
  if (!d) throw new AuthError('Enter a display name.');
  return d;
}
export function validatePassword(password: string): string {
  const p = String(password || '');
  if (p.length < 8) throw new AuthError('Password must be at least 8 characters.');
  return p;
}

// Turn a desired handle into a unique @username, appending digits on collision.
async function uniqueUsername(desired: string): Promise<string> {
  const store = getStore();
  const base = (desired || 'player').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'player';
  const padded = base.length < 3 ? (base + '000').slice(0, 3) : base;
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? padded : `${padded}${i}`.slice(0, 20);
    if (!(await store.getUserByUsername(candidate))) return candidate;
  }
  return `${padded}${crypto.randomBytes(3).toString('hex')}`.slice(0, 20);
}

// ---- sign up / sign in -----------------------------------------------------
export async function signup(input: {
  email: string;
  username: string;
  displayName: string;
  password: string;
}): Promise<PublicUser> {
  const store = getStore();
  const email = validateEmail(input.email);
  const username = validateUsername(input.username);
  const displayName = validateDisplayName(input.displayName);
  const password = validatePassword(input.password);

  if (await store.getUserByEmail(email)) throw new AuthError('An account with that email already exists.', 409);
  if (await store.getUserByUsername(username)) throw new AuthError('That username is taken.', 409);

  const user: User = {
    id: newId(),
    email,
    username,
    displayName,
    passwordHash: await hashPassword(password),
    createdAt: Date.now(),
  };
  await store.createUser(user);
  return toPublic(user);
}

export async function login(emailOrUsername: string, password: string): Promise<PublicUser> {
  const store = getStore();
  const id = String(emailOrUsername || '').trim().toLowerCase();
  const user = id.includes('@') ? await store.getUserByEmail(id) : await store.getUserByUsername(id);
  // Verify even when the user is missing so timing doesn't leak account existence.
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !ok) throw new AuthError('Incorrect email/username or password.', 401);
  return toPublic(user);
}

// ---- OAuth -----------------------------------------------------------------
// Resolve a provider profile to an account: match the linked identity, else link
// by verified email to an existing account, else create a fresh account.
// `isNew` is true only when a brand-new account was created - the caller uses it
// to send first-time users to onboarding so they can pick their own username
// (the auto-generated one from their email/handle is just a suggested default).
export async function findOrCreateFromOAuth(
  provider: Provider,
  profile: OAuthProfile,
): Promise<{ user: PublicUser; isNew: boolean }> {
  const store = getStore();

  const linked = await store.getUserByIdentity(provider, profile.providerId);
  if (linked) return { user: toPublic(linked), isNew: false };

  const email = normalizeEmail(profile.email);
  const existing = await store.getUserByEmail(email);
  if (existing) {
    await store.linkIdentity({ provider, providerId: profile.providerId, userId: existing.id });
    return { user: toPublic(existing), isNew: false };
  }

  const user: User = {
    id: newId(),
    email,
    username: await uniqueUsername(profile.handle || email.split('@')[0]),
    displayName: (profile.name || profile.handle || email.split('@')[0]).slice(0, 24),
    passwordHash: null, // OAuth-only until they set a password
    createdAt: Date.now(),
  };
  await store.createUser(user);
  const identity: OAuthIdentity = { provider, providerId: profile.providerId, userId: user.id };
  await store.linkIdentity(identity);
  return { user: toPublic(user), isNew: true };
}

// ---- profile edits ---------------------------------------------------------
export async function updateProfile(
  userId: string,
  patch: { username?: string; displayName?: string },
): Promise<PublicUser> {
  const store = getStore();
  const user = await store.getUserById(userId);
  if (!user) throw new AuthError('Account not found.', 404);

  const next: { username?: string; displayName?: string } = {};
  if (patch.username !== undefined) {
    const username = validateUsername(patch.username);
    if (username !== user.username) {
      const taken = await store.getUserByUsername(username);
      if (taken && taken.id !== userId) throw new AuthError('That username is taken.', 409);
      next.username = username;
    }
  }
  if (patch.displayName !== undefined) next.displayName = validateDisplayName(patch.displayName);

  if (Object.keys(next).length) await store.updateUser(userId, next);
  return toPublic({ ...user, ...next });
}
