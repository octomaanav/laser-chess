'use client';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useController } from '@/client/useController';
import { useSocial } from '@/client/social/SocialProvider';
import Lobby from '@/components/Lobby';
import GamePlay from '@/components/GamePlay';

// Client shell for the app. `initialGameCode` is resolved on the server from the
// ?game= query param, so the very first paint already knows whether to render the
// game (skeleton) or the lobby - no homepage flash, no hydration mismatch.
export default function GameApp({ initialGameCode, gameSlug }: { initialGameCode: string | null; gameSlug: string }) {
  const { controller, view } = useController();

  // Bridge the controller's toast events (delivered via the view snapshot) to sonner.
  const lastToast = useRef(0);
  useEffect(() => {
    if (view.toast && view.toast.id !== lastToast.current) {
      lastToast.current = view.toast.id;
      toast(view.toast.text);
    }
  }, [view.toast]);

  // Auto-start the game session immediately when arriving on a room link (?game=CODE).
  useEffect(() => {
    if (initialGameCode) controller.start({ code: initialGameCode });
  }, [controller, initialGameCode]);

  // Publish the current room so the global Friends panel can invite friends into
  // it. Any game does this one-liner; the setter is stable so this only re-runs
  // when the room code changes.
  const social = useSocial();
  const setGameContext = social?.setGameContext;
  useEffect(() => {
    if (!setGameContext) return;
    setGameContext(view.roomCode ? { slug: gameSlug, code: view.roomCode } : null);
    return () => setGameContext(null);
  }, [setGameContext, view.roomCode, gameSlug]);

  // Load the player's rank so GamePlay's badge has something to show. Arriving
  // on a room link (the ranked flow) never mounts the Lobby, which is the only
  // other place that fetches it.
  const refreshRank = social?.refreshRank;
  useEffect(() => {
    void refreshRank?.(gameSlug);
  }, [refreshRank, gameSlug]);

  // A game link goes straight to GamePlay (which shows its own loading skeleton
  // until the socket connects and the first state arrives).
  const showGameScreen = view.screen === 'game' || initialGameCode != null;

  return showGameScreen ? <GamePlay controller={controller} view={view} gameSlug={gameSlug} /> : <Lobby controller={controller} view={view} gameSlug={gameSlug} />;
}
