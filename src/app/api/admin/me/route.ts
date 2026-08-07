import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, verifySession } from '@/server/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  const session = verifySession(jar.get(COOKIE)?.value);
  return NextResponse.json({ authed: !!session, email: session?.email ?? null });
}
