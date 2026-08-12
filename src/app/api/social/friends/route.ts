import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/currentUser';
import { getSocialState, unfriend } from '@/server/social/friends';

export const dynamic = 'force-dynamic';

// The signed-in user's full social state: friends (with presence), incoming and
// outgoing requests.
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  return NextResponse.json(await getSocialState(me.id));
}

// Remove a friend (or cancel an outgoing request) by id.
export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  if (!body.userId) return NextResponse.json({ error: 'missing userId' }, { status: 400 });
  await unfriend(me.id, body.userId);
  return NextResponse.json({ ok: true });
}
