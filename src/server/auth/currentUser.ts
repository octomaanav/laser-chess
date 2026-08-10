// Resolve the signed-in account from the request's session cookie. Used by the
// auth API routes (route handlers can read cookies via next/headers).
import { cookies } from 'next/headers';
import { getStore } from '../store';
import { SESSION_COOKIE, verifyUserSession } from './session';
import { toPublic, type PublicUser } from './users';

export async function currentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const session = await verifyUserSession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await getStore().getUserById(session.uid);
  return user ? toPublic(user) : null;
}
