// Password hashing (server-only), zero dependencies — just node:crypto scrypt.
// Stored format: `scrypt$<saltB64url>$<hashB64url>`. Verification is constant-time.
import crypto from 'node:crypto';

const KEYLEN = 64;
const SALT_BYTES = 16;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false; // OAuth-only account: no password to match
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64url'));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
