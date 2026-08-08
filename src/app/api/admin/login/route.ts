import { NextResponse } from 'next/server';
import { COOKIE, checkPassword, cookieOptions, isAdminEmail, signSession } from '@/server/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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
