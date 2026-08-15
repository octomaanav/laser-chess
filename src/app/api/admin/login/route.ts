import { NextResponse } from 'next/server';
import { COOKIE, checkPassword, cookieOptions, isAdminEmail, signSession } from '@/server/adminAuth';
import { clientIp, rateLimit } from '@/server/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Strict: this is a single shared password guarding full admin access.
  const limited = rateLimit(`admin-login:${clientIp(req)}`, 5, 15 * 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429, headers: { 'retry-after': String(limited.retryAfterS) } });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const email = String(body.email || '').trim();
  if (!isAdminEmail(email)) return NextResponse.json({ error: 'That email is not an authorized admin.' }, { status: 403 });
  if (!checkPassword(body.password || '')) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });

  const res = NextResponse.json({ ok: true, email });
  res.cookies.set(COOKIE, await signSession(email), cookieOptions);
  return res;
}
