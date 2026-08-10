import { NextResponse } from 'next/server';
import {
  authorizeUrl,
  callbackUri,
  isProvider,
  OAUTH_STATE_COOKIE,
  originFromRequest,
  providerEnabled,
  sanitizeReturnTo,
  signState,
} from '@/server/auth/oauth';

export const dynamic = 'force-dynamic';

// Kick off the OAuth dance: stash a signed CSRF `state` in a cookie and redirect
// the browser to the provider's consent screen.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = originFromRequest(req);
  if (!isProvider(provider) || !providerEnabled(provider)) {
    return NextResponse.redirect(new URL('/?auth=unavailable', origin));
  }

  const returnTo = sanitizeReturnTo(new URL(req.url).searchParams.get('returnTo'));
  const state = await signState(provider, returnTo);
  const res = NextResponse.redirect(authorizeUrl(provider, state, callbackUri(req, provider)));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
