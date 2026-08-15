'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RankBadge from '@/components/RankBadge';
import { useSocial } from '@/client/social/SocialProvider';

interface Props {
  gameSlug?: string;
  onClose: () => void;
}

export default function MatchmakingModal({ gameSlug = 'laser-chess', onClose }: Props) {
  const social = useSocial();
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);

  // Tick elapsed time
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll the queue. The `ranked-matched` socket push is best-effort - if the
  // social socket is down or reconnecting when the pairing happens, this is
  // what actually gets us into the room. It also re-joins the queue if the
  // server no longer has us (process restart, or a match that fell through).
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled || doneRef.current) return;
      try {
        const r = await fetch(`/api/ranked/queue?gameSlug=${encodeURIComponent(gameSlug)}`, { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled || doneRef.current) return;

        if (d.match?.code) {
          doneRef.current = true;
          window.location.href = `/games/${d.match.gameSlug}?game=${d.match.code}`;
          return;
        }
        if (!d.queued) {
          await fetch('/api/ranked/queue', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ gameSlug }),
          });
        }
      } catch {
        /* offline - the next tick retries */
      }
    };

    const id = setInterval(poll, 2000);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [gameSlug]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const cancel = async () => {
    doneRef.current = true;
    setCancelling(true);
    await fetch('/api/ranked/queue', { method: 'DELETE' }).catch(() => {});
    onClose();
  };

  const rating = social?.rankInfo?.[gameSlug]?.rating ?? null;

  return (
    // pointer-events-auto: guards against the same body-lock a Radix Dialog
    // (e.g. GamePlay's end-of-game screen) can leave in place - see RankUpModal.
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <button
          onClick={cancel}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Cancel search"
        >
          <X className="size-4" />
        </button>

        {/* Animated radar rings */}
        <div className="mb-6 flex justify-center">
          <div className="relative flex size-20 items-center justify-center">
            <span className="absolute size-20 animate-ping rounded-full bg-primary opacity-10" />
            <span className="absolute size-14 animate-ping rounded-full bg-primary opacity-15 [animation-delay:0.4s]" />
            <span className="relative flex size-10 items-center justify-center rounded-full bg-primary/20 text-2xl">
              🎮
            </span>
          </div>
        </div>

        <h2 className="mb-1 text-center font-display text-xl font-bold tracking-tight">
          Finding an opponent…
        </h2>
        <p className="mb-5 text-center text-sm text-muted-foreground">
          {formatTime(elapsed)} elapsed
        </p>

        <div className="mb-6 flex items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <RankBadge rating={rating} />
        </div>

        <p className="mb-4 text-center text-xs text-muted-foreground">
          You&apos;ll be taken to the game automatically when a match is found.
        </p>

        <Button
          variant="outline"
          className="w-full"
          onClick={cancel}
          disabled={cancelling}
        >
          {cancelling ? 'Cancelling…' : 'Cancel search'}
        </Button>
      </div>
    </div>
  );
}
