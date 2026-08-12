import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/currentUser';
import { AuthError } from '@/server/auth/users';
import { sendRequestByUsername } from '@/server/social/friends';

export const dynamic = 'force-dynamic';

// Send a friend request by exact @username (auto-accepts if they already asked you).
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  let body: { username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    const result = await sendRequestByUsername(me.id, body.username || '');
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message || 'request failed' }, { status });
  }
}
