// Canonical public URL of the site. Set NEXT_PUBLIC_SITE_URL in your host's env
// (e.g. https://laserchess.io) when you move to a custom domain — no code change
// needed. Falls back to the current Render URL.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://laser-chess-n6nu.onrender.com').replace(/\/$/, '');

export const SITE_NAME = 'Laser Chess';
export const SITE_TAGLINE = 'Play Laser Chess online — free, real-time multiplayer';
export const SITE_DESCRIPTION =
  'Play Laser Chess online for free — a real-time, multiplayer Khet-style strategy game. ' +
  'Rotate mirrors to bend your laser and burn the enemy Pharaoh. Share a link and play a friend in the browser, no download.';
