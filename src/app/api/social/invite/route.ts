import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/currentUser';
import { areFriends } from '@/server/social/friends';
import { socialHub } from '@/server/social/socialHub';
import { toSocialUser } from '@/server/social/types';
import { getGame } from '@/lib/games';

export const dynamic = 'force-dynamic';

// Invite an online friend straight into the game room you're currently in.
// Ephemeral - nothing is stored; the invitee gets a realtime toast to join.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  let body: { toUserId?: string; gameSlug?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const toUserId = String(body.toUserId || '');
  const gameSlug = String(body.gameSlug || '');
  const code = String(body.code || '').toUpperCase().trim();
  if (!toUserId || !code) return NextResponse.json({ error: 'missing target or room' }, { status: 400 });
  if (!getGame(gameSlug)) return NextResponse.json({ error: 'unknown game' }, { status: 400 });
  if (!(await areFriends(me.id, toUserId))) return NextResponse.json({ error: 'not friends' }, { status: 403 });
  if (!socialHub.isOnline(toUserId)) return NextResponse.json({ error: 'friend is offline' }, { status: 409 });

  socialHub.notify(toUserId, { type: 'game-invite', from: toSocialUser(me), gameSlug, code });
  return NextResponse.json({ ok: true });
}
