// src/components/coup/ReferenceCard.tsx
// The cheat sheet as a physical prop rather than UI chrome: a small
// face-down-style card resting in the corner of the table, the way a
// reference card sits next to you at a real game. Hovering it brings the
// full guide up, sized to show the whole table at once so there's nothing
// to scroll.
//
// Both the card and the guide are positioned against the gameboard's own
// footprint (the `relative` box in CoupGamePlay, viewport minus the docked
// ActionRail) rather than the viewport — same as ResponseModal — so the
// guide centers over the board instead of drifting under the sidebar. That
// also keeps it inside the [data-game='coup'] wrapper, so the --coup-*
// tokens resolve (a portalled dialog would render outside it and lose them).
'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import CardBack from './art/CardBack';
import ReferenceGuide from './ReferenceGuide';

// Grace period after the pointer leaves the card (or the panel) before the
// guide closes. The card sits in the corner and the panel is centered, so
// this has to cover the travel between them — too short and the guide
// closes mid-journey.
const CLOSE_DELAY_MS = 600;

export default function ReferenceCard() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => cancelClose, []);

  return (
    <>
      <button
        type="button"
        // Touch devices never fire hover, so a tap has to open it too.
        onClick={() => setOpen(true)}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => setOpen(true)}
        aria-label="Show the reference guide"
        aria-expanded={open}
        className="absolute bottom-3 right-3 z-20 w-14 overflow-hidden rounded-lg shadow-lg transition-transform duration-200 hover:-translate-y-1 lg:bottom-4 lg:right-4 lg:w-16"
      >
        <CardBack />
        <span
          className="absolute inset-x-0 bottom-0 py-1 text-center text-[9px] font-bold uppercase tracking-[0.12em] lg:text-[10px]"
          style={{ background: 'rgba(10, 12, 16, 0.82)', color: '#e0b354' }}
        >
          Rules
        </span>
      </button>

      {/* AnimatePresence keeps the panel mounted long enough to play an exit
          — a bare `open && …` unmounts it instantly, which is why it used to
          vanish abruptly while fading in smoothly. Exit is quicker than
          enter: dismissal should feel immediate, arrival shouldn't. */}
      <AnimatePresence>
        {open && (
          // Sits below ResponseModal's z-30 so a live challenge/block
          // decision always wins the foreground.
          //
          // pointer-events-none on the wrapper is load-bearing: it spans the
          // whole board, so if it swallowed the pointer it would cover the
          // card the instant it opened, fire mouseleave on that card, and
          // close the guide out from under a pointer that never actually
          // moved. Only the panel itself takes pointer events.
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
            <motion.div
              className="pointer-events-auto relative w-full max-w-3xl shadow-2xl"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.18, ease: 'easeOut' } }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: 'easeIn' } }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <ReferenceGuide />
              {/* Touch has no hover to fall out of, so there has to be an
                  explicit way back out. */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close the reference guide"
                className="absolute right-2 top-2 rounded-md p-1.5 transition-opacity hover:opacity-70"
                style={{ color: 'var(--coup-text-muted)' }}
              >
                <X className="size-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
