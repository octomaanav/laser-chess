import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/currentUser';
import { providersEnabled } from '@/server/auth/oauth';
import { getStore } from '@/server/store';
import { AuthError, updateProfile } from '@/server/auth/users';

export const dynamic = 'force-dynamic';

// Account page data: the user plus which providers are linked / available to link.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  const identities = await getStore().listIdentities(user.id);
  return NextResponse.json({
    user,
    linked: identities.map((i) => i.provider),
    providers: providersEnabled(),
  });
}

export async function PATCH(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  let body: { username?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    const user = await updateProfile(me.id, { username: body.username, displayName: body.displayName });
    return NextResponse.json({ user });
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message || 'update failed' }, { status });
  }
}
