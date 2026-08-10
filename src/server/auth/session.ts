// User session cookie (server-only). Same self-contained HMAC-SHA256 scheme as
// the admin cookie (see ../adminAuth.ts), but keyed to a user id and stored under
// a separate cookie so the two auth systems stay independent.
import crypto from 'node:crypto';
import { getStore } from '../store';

export const SESSION_COOKIE = 'lc_session';
const MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days

// ---- signing secret (durable, shared with the admin cookie via the Store) ----
let cachedSecret: string | null = null;
async function getSecret(): Promise<string> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (cachedSecret) return cachedSecret;
  cachedSecret = await getStore().getSecret();
  return cachedSecret;
}

// ---- generic signed token: `<b64url(json)>.<hmac>` with an embedded expiry -----
const hmac = async (payload: string) => crypto.createHmac('sha256', await getSecret()).update(payload).digest('base64url');

export async function signToken(data: Record<string, unknown>, ttlMs: number): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlMs })).toString('base64url');
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyToken<T = Record<string, unknown>>(token: string | undefined | null): Promise<T | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = await hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!p.exp || p.exp < Date.now()) return null;
    return p as T;
  } catch {
    return null;
  }
}

// ---- user session ----------------------------------------------------------
export async function signUserSession(userId: string): Promise<string> {
  return signToken({ uid: userId }, MAX_AGE_S * 1000);
}

export async function verifyUserSession(token: string | undefined | null): Promise<{ uid: string } | null> {
  const p = await verifyToken<{ uid?: string }>(token);
  return p?.uid ? { uid: p.uid } : null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_S,
  secure: process.env.NODE_ENV === 'production',
};
