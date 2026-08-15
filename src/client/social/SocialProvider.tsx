'use client';
// App-wide social layer: owns the friends/requests state, the account-gated
// `/ws/social` connection (presence + notifications), and the global game-invite
// toast. Any page can read it via useSocial(); a game registers its current room
// with setGameContext() so "Invite" knows where to pull a friend.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/client/useSession';
import { getGame } from '@/lib/games';
import { Net } from '@/lib/net';
import RankUpModal from '@/components/RankUpModal';

export interface SocialUser {
  id: string;
  username: string;
  displayName: string;
}
export interface SocialFriend extends SocialUser {
  online: boolean;
}
interface GameContext {
  slug: string;
  code: string;
}

// server → client events on /ws/social (mirrors the server's SocialEvent).
type SocialEvent =
  | { type: 'hello'; userId: string }
  | { type: 'presence'; userId: string; online: boolean }
  | { type: 'friend-request'; from: SocialUser }
  | { type: 'friend-accepted'; user: SocialUser }
  | { type: 'friend-removed'; userId: string }
  | { type: 'game-invite'; from: SocialUser; gameSlug: string; code: string }
  | { type: 'ranked-matched'; code: string; gameSlug: string; opponent: SocialUser }
  | { type: 'rating-updated'; gameSlug: string; newRating: number; delta: number; rankName: string };

export interface RankInfo {
  rating: number;
  rank: string;
}

export type RankInfoMap = Record<string, RankInfo>;

export interface RankTransition {
  oldRating: number;
  newRating: number;
  gameSlug: string;
}

interface SocialContextValue {
  friends: SocialFriend[];
  incoming: SocialUser[];
  outgoing: SocialUser[];
  pendingCount: number;
  addFriend: (username: string) => Promise<{ ok: boolean; error?: string }>;
  respond: (userId: string, accept: boolean) => Promise<void>;
  unfriend: (userId: string) => Promise<void>;
  invite: (toUserId: string) => Promise<{ ok: boolean; error?: string }>;
  setGameContext: (ctx: GameContext | null) => void;
  canInvite: boolean;
  rankInfo: RankInfoMap;
  refreshRank: (gameSlug: string) => Promise<void>;
  rankTransition: RankTransition | null;
  clearRankTransition: () => void;
}

const SocialContext = createContext<SocialContextValue | null>(null);

export function useSocial(): SocialContextValue | null {
  return useContext(SocialContext);
}

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const [friends, setFriends] = useState<SocialFriend[]>([]);
  const [incoming, setIncoming] = useState<SocialUser[]>([]);
  const [outgoing, setOutgoing] = useState<SocialUser[]>([]);
  const [gameContext, setGameContext] = useState<GameContext | null>(null);
  const [rankInfo, setRankInfo] = useState<RankInfoMap>({});
  const [rankTransition, setRankTransition] = useState<RankTransition | null>(null);

  const refreshRank = useCallback(async (gameSlug: string) => {
    if (!user) return;
    try {
      const r = await fetch(`/api/ranked/rating?gameSlug=${encodeURIComponent(gameSlug)}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setRankInfo((prev) => ({ ...prev, [gameSlug]: { rating: d.rating, rank: d.rank } }));
    } catch {
      /* offline */
    }
  }, [user]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/social/friends', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setFriends(d.friends ?? []);
      setIncoming(d.incoming ?? []);
      setOutgoing(d.outgoing ?? []);
    } catch {
      /* offline — will refresh on the next event */
    }
  }, []);

  const handleEvent = useCallback(
    (m: SocialEvent) => {
      switch (m.type) {
        case 'presence':
          setFriends((prev) => prev.map((f) => (f.id === m.userId ? { ...f, online: m.online } : f)));
          break;
        case 'friend-request':
          toast(`${m.from.displayName} sent you a friend request`, { description: `@${m.from.username}` });
          void refresh();
          break;
        case 'friend-accepted':
          toast(`${m.user.displayName} accepted your friend request`, { description: `@${m.user.username}` });
          void refresh();
          break;
        case 'friend-removed':
          void refresh();
          break;
        case 'game-invite': {
          const gameName = getGame(m.gameSlug)?.name ?? 'a game';
          toast(`${m.from.displayName} invited you to ${gameName}`, {
            description: `@${m.from.username} · tap Join to play`,
            duration: 20000,
            action: { label: 'Join', onClick: () => (window.location.href = `/games/${m.gameSlug}?game=${m.code}`) },
          });
          break;
        }
        case 'ranked-matched':
          // Navigate immediately — the room is already created server-side.
          window.location.href = `/games/${m.gameSlug}?game=${m.code}`;
          break;
        case 'rating-updated': {
          // delta 0 = already at the floor or ceiling; nothing to animate.
          if (m.delta !== 0)
            setRankTransition({ oldRating: m.newRating - m.delta, newRating: m.newRating, gameSlug: m.gameSlug });
          setRankInfo((prev) => ({ ...prev, [m.gameSlug]: { rating: m.newRating, rank: m.rankName } }));
          break;
        }
      }
    },
    [refresh],
  );

  // Open the account-gated social socket (with auto-reconnect) while signed in.
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setRankInfo({});
      return;
    }
    void refresh();
    const net = new Net<SocialEvent>('/ws/social');
    net.on('open', () => { void refresh(); }); // resync after a (re)connect
    net.on('message', (m) => handleEvent(m));
    net.connect();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !net.isConnected()) net.connect();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      net.close();
    };
  }, [user, refresh, handleEvent]);

  const addFriend = useCallback(
    async (username: string): Promise<{ ok: boolean; error?: string }> => {
      const r = await fetch('/api/social/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: d.error || 'Could not send request.' };
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  const respond = useCallback(
    async (userId: string, accept: boolean) => {
      await fetch('/api/social/requests/respond', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, accept }),
      }).catch(() => {});
      await refresh();
    },
    [refresh],
  );

  const unfriend = useCallback(
    async (userId: string) => {
      await fetch('/api/social/friends', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).catch(() => {});
      await refresh();
    },
    [refresh],
  );

  const invite = useCallback(
    async (toUserId: string): Promise<{ ok: boolean; error?: string }> => {
      if (!gameContext) return { ok: false, error: 'Open a game first.' };
      const r = await fetch('/api/social/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toUserId, gameSlug: gameContext.slug, code: gameContext.code }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: d.error || 'Could not invite.' };
      return { ok: true };
    },
    [gameContext],
  );

  const value = useMemo<SocialContextValue>(
    () => ({
      friends,
      incoming,
      outgoing,
      pendingCount: incoming.length,
      addFriend,
      respond,
      unfriend,
      invite,
      setGameContext,
      canInvite: !!gameContext,
      rankInfo,
      refreshRank,
      rankTransition,
      clearRankTransition: () => setRankTransition(null),
    }),
    [friends, incoming, outgoing, addFriend, respond, unfriend, invite, gameContext, rankInfo, refreshRank, rankTransition],
  );

  return (
    <SocialContext.Provider value={value}>
      {children}
      {rankTransition && (
        <RankUpModal
          oldRating={rankTransition.oldRating}
          newRating={rankTransition.newRating}
          gameSlug={rankTransition.gameSlug}
          onClose={() => setRankTransition(null)}
        />
      )}
    </SocialContext.Provider>
  );
}
