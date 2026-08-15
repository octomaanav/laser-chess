import type { Metadata } from 'next';
import CoupApp from '@/components/coup/CoupApp';

export const metadata: Metadata = {
  title: 'Coup: Play Online Free (Real-time Multiplayer Bluffing Game)',
  description:
    'Play Coup online for free in a real-time multiplayer game of bluffing and deduction. Claim any character’s power and survive your rivals’ challenges. 2–6 players, share a link, no download.',
  alternates: { canonical: '/games/coup' },
  openGraph: {
    type: 'website',
    url: '/games/coup',
    title: 'Coup: Play Online Free',
    description: 'Bluff, deduce, betray. Real-time multiplayer, right in the browser.',
  },
};

export default async function CoupPage({ searchParams }: { searchParams: Promise<{ game?: string | string[] }> }) {
  const { game } = await searchParams;
  const raw = Array.isArray(game) ? game[0] : game;
  const initialRoomCode = (raw || '').toUpperCase().trim() || null;

  return <CoupApp initialRoomCode={initialRoomCode} />;
}
