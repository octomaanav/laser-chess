// OAuth (server-only), done by hand with the standard authorization-code flow —
// no SDK, just `fetch`. Google and GitHub are supported; a provider is only
// "enabled" when both its CLIENT_ID and CLIENT_SECRET env vars are configured,
// so local dev without credentials cleanly falls back to email+password only.
import { signToken, verifyToken } from './session';

export type Provider = 'google' | 'github';
export const PROVIDERS: Provider[] = ['google', 'github'];

// Normalized profile returned to the account layer regardless of provider.
export interface OAuthProfile {
  providerId: string;
  email: string;
  name: string | null;
  handle: string | null; // provider username (GitHub login); used to seed a @username
}

interface ProviderConfig {
  authorize: string;
  token: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
}

function configFor(provider: Provider): ProviderConfig {
  if (provider === 'google') {
    return {
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  return {
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

export function isProvider(v: string): v is Provider {
  return (PROVIDERS as string[]).includes(v);
}

export function providerEnabled(provider: Provider): boolean {
  const c = configFor(provider);
  return !!c.clientId && !!c.clientSecret;
}

export function providersEnabled(): Record<Provider, boolean> {
  return { google: providerEnabled('google'), github: providerEnabled('github') };
}

// ---- CSRF state (double-submit: same signed token in the URL and a cookie) ----
const STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_STATE_COOKIE = 'lc_oauth_state';

export function signState(provider: Provider, returnTo: string): Promise<string> {
  return signToken({ p: provider, r: returnTo }, STATE_TTL_MS);
}

export async function verifyState(
  provider: Provider,
  fromQuery: string | null,
  fromCookie: string | undefined,
): Promise<{ returnTo: string } | null> {
  if (!fromQuery || !fromCookie || fromQuery !== fromCookie) return null;
  const p = await verifyToken<{ p?: string; r?: string }>(fromQuery);
  if (!p || p.p !== provider) return null;
  return { returnTo: typeof p.r === 'string' ? p.r : '/' };
}

// ---- flow ------------------------------------------------------------------
export function authorizeUrl(provider: Provider, state: string, redirectUri: string): string {
  const c = configFor(provider);
  const params = new URLSearchParams({
    client_id: c.clientId!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: c.scope,
    state,
  });
  if (provider === 'google') params.set('prompt', 'select_account');
  return `${c.authorize}?${params.toString()}`;
}

async function fetchToken(provider: Provider, code: string, redirectUri: string): Promise<string> {
  const c = configFor(provider);
  const res = await fetch(c.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      client_id: c.clientId!,
      client_secret: c.clientSecret!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error || 'token exchange failed');
  return data.access_token;
}

async function googleProfile(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const u = (await res.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  if (!u.sub) throw new Error('could not read Google profile');
  if (!u.email || u.email_verified === false) throw new Error('a verified Google email is required');
  return { providerId: u.sub, email: u.email, name: u.name ?? null, handle: null };
}

async function githubProfile(accessToken: string): Promise<OAuthProfile> {
  const headers = { authorization: `Bearer ${accessToken}`, accept: 'application/vnd.github+json', 'user-agent': 'game-night' };
  const uRes = await fetch('https://api.github.com/user', { headers });
  const u = (await uRes.json()) as { id?: number; login?: string; name?: string };
  if (!u.id) throw new Error('could not read GitHub profile');
  // The primary, verified email may be private on /user, so ask /user/emails.
  const eRes = await fetch('https://api.github.com/user/emails', { headers });
  const emails = (await eRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
  const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified) : null;
  if (!primary) throw new Error('a verified GitHub email is required');
  return { providerId: String(u.id), email: primary.email, name: u.name ?? null, handle: u.login ?? null };
}

export async function exchange(provider: Provider, code: string, redirectUri: string): Promise<OAuthProfile> {
  const accessToken = await fetchToken(provider, code, redirectUri);
  return provider === 'google' ? googleProfile(accessToken) : githubProfile(accessToken);
}

// ---- request helpers (honor the proxy, allow an explicit override) ----------
export function originFromRequest(req: Request): string {
  if (process.env.AUTH_BASE_URL) return process.env.AUTH_BASE_URL.replace(/\/$/, '');
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  return `${proto}://${host}`;
}

export function callbackUri(req: Request, provider: Provider): string {
  return `${originFromRequest(req)}/api/auth/oauth/${provider}/callback`;
}

// Only allow same-site relative paths as a post-login destination (no open redirects).
export function sanitizeReturnTo(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
