import GameApp from '@/components/GameApp';

// Server component: resolve the ?game= room code up front so the server renders
// the game screen (with its loading skeleton) rather than the lobby when someone
// reloads a room link. This prevents the flash of the homepage before hydration.
export default async function Page({ searchParams }: { searchParams: Promise<{ game?: string | string[] }> }) {
  const { game } = await searchParams;
  const raw = Array.isArray(game) ? game[0] : game;
  const initialGameCode = (raw || '').toUpperCase().trim() || null;

  return <GameApp initialGameCode={initialGameCode} />;
}
