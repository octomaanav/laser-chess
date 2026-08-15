import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/currentUser';
import { getStore } from '@/server/store';
import { getRank, normalizeRating } from '@/game/ranking';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gameSlug = searchParams.get('gameSlug') ?? 'laser-chess';

  const existing = await getStore().getRating(me.id, gameSlug);
  const rating = normalizeRating(existing?.rating);
  const rank = getRank(rating);

  return NextResponse.json({
    rating,
    peakRating: Math.max(normalizeRating(existing?.peakRating), rating),
    wins: existing?.wins ?? 0,
    losses: existing?.losses ?? 0,
    rank: rank.name,
    rankInfo: rank,
  });
}
