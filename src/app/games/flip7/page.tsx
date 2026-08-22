import type { Metadata } from 'next';
import Flip7App from '@/components/flip7/Flip7App';

export const metadata: Metadata = {
  title: 'Flip 7: Play Online Free (Real-time Multiplayer Push-Your-Luck Card Game)',
  description:
    'Play Flip 7 online for free in a real-time multiplayer push-your-luck card game. Draw unique numbers, dodge duplicates, and bank your score before you bust. 2–7 players, share a link, no download.',
  alternates: { canonical: '/games/flip7' },
  openGraph: {
    type: 'website',
    url: '/games/flip7',
    title: 'Flip 7: Play Online Free',
    description: 'Push your luck. Don’t flip twice. Real-time multiplayer, right in the browser.',
  },
};

export default async function Flip7Page({ searchParams }: { searchParams: Promise<{ game?: string | string[] }> }) {
  const { game } = await searchParams;
  const raw = Array.isArray(game) ? game[0] : game;
  const initialRoomCode = (raw || '').toUpperCase().trim() || null;

  return <Flip7App initialRoomCode={initialRoomCode} />;
}
