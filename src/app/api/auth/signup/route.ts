import { NextResponse } from 'next/server';
import { AuthError, signup } from '@/server/auth/users';
import { SESSION_COOKIE, sessionCookieOptions, signUserSession } from '@/server/auth/session';
import { clientIp, rateLimit } from '@/server/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const limited = rateLimit(`signup:${clientIp(req)}`, 8, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many accounts created from this network. Try again later.' }, { status: 429, headers: { 'retry-after': String(limited.retryAfterS) } });
  }

  let body: { email?: string; username?: string; displayName?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    const user = await signup({
      email: body.email || '',
      username: body.username || '',
      displayName: body.displayName || '',
      password: body.password || '',
    });
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, await signUserSession(user.id), sessionCookieOptions);
    return res;
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message || 'signup failed' }, { status });
  }
}
