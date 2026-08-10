import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  callbackUri,
  exchange,
  isProvider,
  OAUTH_STATE_COOKIE,
  originFromRequest,
  providerEnabled,
  verifyState,
} from '@/server/auth/oauth';
import { SESSION_COOKIE, sessionCookieOptions, signUserSession } from '@/server/auth/session';
import { findOrCreateFromOAuth } from '@/server/auth/users';

export const dynamic = 'force-dynamic';

// The provider redirects back here with `?code&state`. Verify state, exchange the
// code for the profile, resolve it to an account, and drop a session cookie.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = originFromRequest(req);
  const fail = (returnTo = '/') => NextResponse.redirect(new URL(`${returnTo}?auth=error`, origin));

  if (!isProvider(provider) || !providerEnabled(provider)) return fail();

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const jar = await cookies();
  const state = await verifyState(provider, url.searchParams.get('state'), jar.get(OAUTH_STATE_COOKIE)?.value);
  if (!state) return fail();
  if (url.searchParams.get('error') || !code) return fail(state.returnTo);

  try {
    const profile = await exchange(provider, code, callbackUri(req, provider));
    const { user, isNew } = await findOrCreateFromOAuth(provider, profile);
    // First-time accounts land on onboarding to choose a username; returning users go straight in.
    const dest = isNew ? `/welcome?returnTo=${encodeURIComponent(state.returnTo)}` : state.returnTo;
    const res = NextResponse.redirect(new URL(dest, origin));
    res.cookies.set(SESSION_COOKIE, await signUserSession(user.id), sessionCookieOptions);
    res.cookies.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  } catch (e) {
    console.error(`oauth ${provider} callback failed:`, e);
    return fail(state.returnTo);
  }
}
