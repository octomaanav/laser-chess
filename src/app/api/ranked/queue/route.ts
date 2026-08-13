import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/currentUser';
import { getStore } from '@/server/store';
import { matchmakingQueue } from '@/server/matchmaking';
import { getRank, normalizeRating } from '@/game/ranking';
import { GAMES } from '@/lib/games';

export const dynamic = 'force-dynamic';

// POST { gameSlug } — join the ranked queue for a game.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  let body: { gameSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const gameSlug = body.gameSlug ?? 'laser-chess';
  if (!GAMES.find((g) => g.slug === gameSlug && g.status === 'live')) {
    return NextResponse.json({ error: 'unknown game slug' }, { status: 400 });
  }

  const store = getStore();
  const existing = await store.getRating(me.id, gameSlug);
  const rating = normalizeRating(existing?.rating);

  matchmakingQueue.joinQueue(me.id, me.displayName, me.username, rating, gameSlug);

  const rank = getRank(rating);
  return NextResponse.json({ queued: true, rating, rank: rank.name });
}

// DELETE — leave the queue.
export async function DELETE() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  matchmakingQueue.leaveQueue(me.id);
  return NextResponse.json({ ok: true });
}

// GET — poll queue status. Doubles as the delivery channel for a made match:
// the socket push is best-effort, so a match found while the client's socket
// was down is claimed here instead.
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gameSlug = searchParams.get('gameSlug') ?? 'laser-chess';

  const existing = await getStore().getRating(me.id, gameSlug);
  const rating = normalizeRating(existing?.rating);
  const rank = getRank(rating);

  const match = matchmakingQueue.takePendingMatch(me.id);

  return NextResponse.json({
    queued: matchmakingQueue.isQueued(me.id),
    queueSize: matchmakingQueue.getQueueSize(gameSlug),
    rating,
    rank: rank.name,
    match: match ? { code: match.code, gameSlug: match.gameSlug, opponent: match.opponent } : null,
  });
}
