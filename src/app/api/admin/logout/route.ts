import { NextResponse } from 'next/server';
import { COOKIE } from '@/server/adminAuth';

export const dynamic = 'force-dynamic';

export function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
