// Read a single cookie value from a raw `Cookie:` header (Node http servers,
// e.g. WebSocket upgrades, don't parse cookies for us). Shared by the game
// server and the social hub to resolve the session cookie off an upgrade request.
import type { IncomingMessage } from 'node:http';
import { SESSION_COOKIE, verifyUserSession } from './session';
import { getStore } from '../store';

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

// Resolve the signed-in account (if any) from an upgrade request's session cookie.
export async function resolveAccountFromReq(req: IncomingMessage): Promise<{ userId: string; name: string } | null> {
  const session = await verifyUserSession(readCookie(req.headers.cookie, SESSION_COOKIE));
  if (!session) return null;
  const user = await getStore().getUserById(session.uid);
  return user ? { userId: user.id, name: user.displayName } : null;
}
