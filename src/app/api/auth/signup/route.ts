import { NextResponse } from 'next/server';
import { AuthError, signup } from '@/server/auth/users';
import { SESSION_COOKIE, sessionCookieOptions, signUserSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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
