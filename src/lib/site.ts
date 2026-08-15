// Canonical public URL of the site. Set NEXT_PUBLIC_SITE_URL in your host's env
// (e.g. https://gamenight.example) when you move to a custom domain - no code
// change needed. Falls back to the current Render URL.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://laser-chess-n6nu.onrender.com').replace(/\/$/, '');

export const SITE_NAME = 'Game Night';
export const SITE_TAGLINE = 'Play fun multiplayer games online for free in real time, with no install';
export const SITE_DESCRIPTION =
  'Game Night is a collection of fast, fun multiplayer games you can play with friends right in the browser, ' +
  'featuring Laser Chess and more. Pick a game, share a link, and play in seconds with instant free rooms and no download.';

