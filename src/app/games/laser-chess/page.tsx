import type { Metadata } from 'next';
import GameApp from '@/components/GameApp';

// Laser Chess keeps its own SEO under its dedicated route, independent of the
// Game Night platform metadata in the root layout.
export const metadata: Metadata = {
  title: 'Laser Chess — Play Online Free (Real-time Multiplayer)',
  description:
    'Play Laser Chess online for free — a real-time, multiplayer Khet-style strategy game. ' +
    'Rotate mirrors to bend your laser and burn the enemy Pharaoh. Share a link and play a friend in the browser, no download.',
  alternates: { canonical: '/games/laser-chess' },
  openGraph: {
    type: 'website',
    url: '/games/laser-chess',
    title: 'Laser Chess — Play Online Free',
    description: 'Rotate mirrors, bend your laser, and burn the enemy Pharaoh. Real-time multiplayer, right in the browser.',
    images: [{ url: '/og.png', width: 2400, height: 1520, alt: 'Laser Chess — a laser beam deflecting across the board' }],
  },
};

// Server component: resolve the ?game= room code up front so the server renders
// the game screen (with its loading skeleton) rather than the lobby when someone
// reloads a room link. This prevents the flash of the homepage before hydration.
export default async function LaserChessPage({ searchParams }: { searchParams: Promise<{ game?: string | string[] }> }) {
  const { game } = await searchParams;
  const raw = Array.isArray(game) ? game[0] : game;
  const initialGameCode = (raw || '').toUpperCase().trim() || null;

  return <GameApp initialGameCode={initialGameCode} />;
}
