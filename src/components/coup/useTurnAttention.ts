// src/components/coup/useTurnAttention.ts
'use client';
import { useEffect, useRef } from 'react';

const FLASH_MS = 1000;
let originalFavicon: string | null = null;

function getFaviconLink(): HTMLLinkElement | null {
  return document.querySelector('link[rel="icon"]');
}

// Draws a small gold dot over whatever the current favicon is, so a
// backgrounded tab has a visible cue in the tab strip, not just the title.
function buildPingFavicon(baseHref: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size - 7, 7, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#e0b354';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1c1420';
      ctx.stroke();
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = baseHref;
  });
}

// While the tab is backgrounded and it becomes the viewer's turn, flash the
// document title and badge the favicon so a turn in a 3-6 player game isn't
// silently missed just because the tab wasn't focused.
export function useTurnAttention(isYourTurn: boolean) {
  const flashingRef = useRef(false);

  useEffect(() => {
    const link = getFaviconLink();
    if (link && originalFavicon == null) originalFavicon = link.href;
    const baseTitle = document.title.replace(/^▶ Your turn! — /, '');

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let pingHref: string | null = null;
    let cancelled = false;

    const stop = () => {
      flashingRef.current = false;
      if (intervalId != null) clearInterval(intervalId);
      intervalId = null;
      document.title = baseTitle;
      if (link && originalFavicon) link.href = originalFavicon;
    };

    const start = async () => {
      if (flashingRef.current || !link || !originalFavicon) return;
      flashingRef.current = true;
      try {
        pingHref = await buildPingFavicon(originalFavicon);
      } catch {
        pingHref = null;
      }
      if (cancelled) return;
      let on = false;
      intervalId = setInterval(() => {
        on = !on;
        document.title = on ? `▶ Your turn! — ${baseTitle}` : baseTitle;
        if (link && pingHref) link.href = on ? pingHref : originalFavicon!;
      }, FLASH_MS);
    };

    const onVisibility = () => {
      if (document.hidden && isYourTurn) start();
      else stop();
    };

    if (document.hidden && isYourTurn) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [isYourTurn]);
}
