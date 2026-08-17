// src/app/api/admin/analytics/route.ts
// Authenticated admin endpoint for platform live rooms & match history
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, verifySession } from '@/server/adminAuth';
import { getStore } from '@/server/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  const session = await verifySession(jar.get(COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const store = getStore();
    const [activeRooms, recentMatches] = await Promise.all([
      store.getActiveRooms(),
      store.getRecentMatches(50),
    ]);

    return NextResponse.json({
      ok: true,
      activeRooms,
      recentMatches,
    });
  } catch (e) {
    console.error('Failed to load admin stats:', e);
    return NextResponse.json({ error: 'failed to load data' }, { status: 500 });
  }
}
