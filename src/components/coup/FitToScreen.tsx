// src/components/coup/FitToScreen.tsx
'use client';
import { useLayoutEffect, useRef, useState } from 'react';

// Measures the content's natural (unscaled) size against the space actually
// available and uniformly scales it down (never up) to guarantee it always
// fits — the real fix for "the table scrolls on a short/unmaximized
// window": per-element clamp() sizing still overflows once enough players'
// seat panels wrap to a second row, since padding/gaps don't shrink with
// it. A scale transform is content-amount-independent — it fits 2 players
// or 6 the same way, at any window size, without per-case tuning.
export default function FitToScreen({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const recompute = () => {
      const prevTransform = inner.style.transform;
      inner.style.transform = 'none';
      const contentWidth = inner.scrollWidth;
      const contentHeight = inner.scrollHeight;
      inner.style.transform = prevTransform;

      const outerWidth = outer.clientWidth;
      const outerHeight = outer.clientHeight;
      if (!contentWidth || !contentHeight || !outerWidth || !outerHeight) return;
      const next = Math.min(outerWidth / contentWidth, outerHeight / contentHeight, 1);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(outer);
    ro.observe(inner);
    recompute();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  );
}
