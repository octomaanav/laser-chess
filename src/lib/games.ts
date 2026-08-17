// The Game Night catalogue - the single source of truth for which games exist.
// Drives the homepage cards, the sitemap, and per-game routing. Adding a game =
// add an entry here + a route at src/app/games/<slug>/page.tsx + (if it needs a
// realtime backend) a WS handler registered under <slug> in src/server/games.
export type GameStatus = 'live' | 'soon';

export interface GameEntry {
  slug: string;
  name: string;
  tagline: string; // one short line for the card
  description: string; // used for the card body + per-game metadata
  status: GameStatus;
  players: string; // e.g. '2 players', '5–10 players'
  accent: string; // CSS color for the card's tint/glow (inline-styled; Tailwind can't see it)
  icon: string; // emoji placeholder until bespoke art exists
}

export const GAMES: GameEntry[] = [
  {
    slug: 'laser-chess',
    name: 'Laser Chess',
    tagline: 'Deflect the beam. Burn the Pharaoh.',
    description:
      'A fast head-to-head duel of mirrors and lasers. Rotate your pieces to bend the beam and strike the enemy Pharaoh. Share a link and play a friend in seconds.',
    status: 'live',
    players: '2 players',
    accent: '#4fc9dd',
    icon: '🔺',
  },
  {
    slug: 'coup',
    name: 'Boardroom',
    tagline: 'Bluff, deduce, betray.',
    description:
      'A fast-paced game of bluffing and deduction. Claim any character\'s power (tax, steal, assassinate) whether you hold the card or not, and survive your rivals\' challenges. Last influence standing wins.',
    status: 'live',
    players: '2–6 players',
    accent: '#c8155e',
    icon: '👑',
  },
  {
    slug: 'secret-hitler',
    name: 'Secret Hitler',
    tagline: 'Hidden roles. Trust no one.',
    description: 'A social-deduction thriller of liberals and fascists racing to enact policies while unmasking the leader hiding among you.',
    status: 'soon',
    players: '5–10 players',
    accent: '#f2766a',
    icon: '🕵️',
  },
  {
    slug: 'ranked-poker',
    name: 'Ranked Poker',
    tagline: 'Read the table. Climb the ladder.',
    description: "No-limit Texas Hold'em with slick graphics and a competitive ranked ladder. Bluff your way to the top.",
    status: 'soon',
    players: '2–9 players',
    accent: '#57cf9b',
    icon: '♠️',
  },
  {
    slug: 'werewolf',
    name: 'Werewolf',
    tagline: 'The village sleeps. The wolves hunt.',
    description: 'The classic party game of accusation and survival. Villagers hunt the wolves by day; the wolves feast by night.',
    status: 'soon',
    players: '6–16 players',
    accent: '#b49bf3',
    icon: '🐺',
  },
  {
    slug: 'codenames',
    name: 'Codenames',
    tagline: 'One word. Many meanings.',
    description: 'Two teams race to contact their agents using one-word clues from their spymaster without hitting the assassin.',
    status: 'soon',
    players: '4+ players',
    accent: '#ffc95e',
    icon: '🔡',
  },
];

export const hrefFor = (g: GameEntry): string => `/games/${g.slug}`;
export const getGame = (slug: string): GameEntry | undefined => GAMES.find((g) => g.slug === slug);
