import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/currentUser';
import { respondToRequest } from '@/server/social/friends';

export const dynamic = 'force-dynamic';

// Accept or deny an incoming friend request from `userId`.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  let body: { userId?: string; accept?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  if (!body.userId) return NextResponse.json({ error: 'missing userId' }, { status: 400 });
  await respondToRequest(me.id, body.userId, !!body.accept);
  return NextResponse.json({ ok: true });
}
