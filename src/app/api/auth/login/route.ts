import { NextResponse } from 'next/server';
import { AuthError, login } from '@/server/auth/users';
import { SESSION_COOKIE, sessionCookieOptions, signUserSession } from '@/server/auth/session';
import { clientIp, rateLimit } from '@/server/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const limited = rateLimit(`login:${clientIp(req)}`, 10, 15 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429, headers: { 'retry-after': String(limited.retryAfterS) } });
  }

  let body: { emailOrUsername?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  try {
    const user = await login(body.emailOrUsername || '', body.password || '');
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, await signUserSession(user.id), sessionCookieOptions);
    return res;
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message || 'login failed' }, { status });
  }
}
