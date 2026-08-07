// Admin authentication (server-only). Zero-setup password login:
//   - admins.json (project root) holds the allowlist of authorized emails.
//   - The password is ADMIN_PASSWORD env var, or the default below.
//   - On success we issue a signed, httpOnly session cookie (HMAC-SHA256).
// No external services or dependencies — just node:crypto.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const COOKIE = 'lc_admin';
const DEFAULT_PASSWORD = 'laserchess';
const MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days

// ---- allowlist ------------------------------------------------------------
export function listAdmins(): string[] {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'admins.json'), 'utf8'));
    return (Array.isArray(j.admins) ? j.admins : []).map((e: string) => String(e).toLowerCase().trim());
  } catch {
    return [];
  }
}
export function isAdminEmail(email: string): boolean {
  return listAdmins().includes(String(email).toLowerCase().trim());
}

// ---- password -------------------------------------------------------------
export function adminPasswordIsDefault(): boolean {
  return !process.env.ADMIN_PASSWORD;
}
export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const a = Buffer.from(String(password ?? ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---- session secret (persisted, random) -----------------------------------
let cachedSecret: string | null = null;
function getSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (cachedSecret) return cachedSecret;
  const f = path.join(process.cwd(), 'data', 'adminSecret.json');
  try {
    const s = JSON.parse(fs.readFileSync(f, 'utf8')).sessionSecret;
    if (s) return (cachedSecret = s);
  } catch {
    /* generate below */
  }
  cachedSecret = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ sessionSecret: cachedSecret }, null, 2));
  } catch {
    /* ignore — falls back to in-memory secret for this run */
  }
  return cachedSecret;
}

// ---- signed session cookie ------------------------------------------------
const b64url = (s: string) => Buffer.from(s).toString('base64url');
const hmac = (payload: string) => crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');

export function signSession(email: string): string {
  const payload = b64url(JSON.stringify({ email, exp: Date.now() + MAX_AGE_S * 1000 }));
  return `${payload}.${hmac(payload)}`;
}

export function verifySession(token: string | undefined | null): { email: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!p.exp || p.exp < Date.now()) return null;
    if (!isAdminEmail(p.email)) return null; // revoked if removed from admins.json
    return { email: p.email };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_S,
  secure: process.env.NODE_ENV === 'production',
};
