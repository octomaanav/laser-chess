import { NextResponse } from 'next/server';
import { currentUser } from '@/server/auth/currentUser';
import { providersEnabled } from '@/server/auth/oauth';

export const dynamic = 'force-dynamic';

// Tells the client who is signed in (if anyone) and which OAuth buttons to show.
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ user, providers: providersEnabled() });
}
