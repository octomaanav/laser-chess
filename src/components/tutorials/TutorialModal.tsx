'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface TutorialStep {
  title: string;
  visual?: React.ReactNode;
  body: React.ReactNode;
}

interface TutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameTitle: string;
  steps: TutorialStep[];
  // Coup/Flip 7's surfaces are themed via the [data-game='...'] CSS scope,
  // but a Radix Dialog portals to document.body and escapes that wrapper -
  // so the --coup-*/--flip7-* tokens go undefined unless this content
  // carries the attribute itself (see ReferenceCard.tsx for the same
  // portal-escape problem).
  theme?: 'laser' | 'coup' | 'flip7';
}

export default function TutorialModal({ open, onOpenChange, gameTitle, steps, theme = 'laser' }: TutorialModalProps) {
  const [index, setIndex] = useState(0);
  const isCoup = theme === 'coup';
  const isFlip7 = theme === 'flip7';

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  const next = () => (isLast ? onOpenChange(false) : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-game={isCoup ? 'coup' : isFlip7 ? 'flip7' : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') next();
          if (e.key === 'ArrowLeft') back();
        }}
        className={cn(
          'flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl',
          isCoup && 'border-[var(--coup-panel-border)] bg-[var(--coup-panel-bg)] text-[var(--coup-text)]',
          isFlip7 && 'border-[var(--flip7-panel-border)] bg-[var(--flip7-panel-bg)] text-[var(--flip7-text)]'
        )}
      >
        <div
          className={cn(
            'shrink-0 border-b px-6 py-4',
            isCoup ? 'border-[var(--coup-panel-border)]' : isFlip7 ? 'border-[var(--flip7-panel-border)]' : 'border-border'
          )}
        >
          <p
            className={cn(
              'text-xs font-semibold uppercase tracking-widest',
              isCoup ? 'text-[var(--coup-text-muted)]' : isFlip7 ? 'text-[var(--flip7-text-muted)]' : 'text-muted-foreground'
            )}
          >
            {gameTitle} · How to play
          </p>
          <DialogTitle
            className={cn(
              'font-display text-xl font-bold',
              isCoup ? 'text-[var(--coup-text)]' : isFlip7 ? 'text-[var(--flip7-text)]' : 'text-foreground'
            )}
          >
            {step.title}
          </DialogTitle>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step.visual && <div className="mb-5 flex justify-center">{step.visual}</div>}
          <div
            className={cn(
              'space-y-3 text-[14px] leading-relaxed',
              isCoup ? 'text-[var(--coup-text)]' : isFlip7 ? 'text-[var(--flip7-text)]' : 'text-foreground/90'
            )}
          >
            {step.body}
          </div>
        </div>

        <div
          className={cn(
            'flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4',
            isCoup ? 'border-[var(--coup-panel-border)]' : isFlip7 ? 'border-[var(--flip7-panel-border)]' : 'border-border'
          )}
        >
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  i === index
                    ? isCoup
                      ? 'bg-[var(--coup-gold)]'
                      : isFlip7
                        ? 'bg-[var(--flip7-amber)]'
                        : 'bg-laser'
                    : isCoup
                      ? 'bg-[var(--coup-panel-border)]'
                      : isFlip7
                        ? 'bg-[var(--flip7-panel-border)]'
                        : 'bg-border'
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={back} disabled={isFirst}>
              <ChevronLeft className="size-4" /> Back
            </Button>
            <Button
              size="sm"
              onClick={next}
              className={
                isCoup
                  ? 'bg-[var(--coup-gold)] text-black hover:bg-[var(--coup-gold-dark)]'
                  : isFlip7
                    ? 'bg-[var(--flip7-amber)] text-black hover:bg-[var(--flip7-amber-dark)]'
                    : undefined
              }
            >
              {isLast ? 'Got it' : 'Next'} {!isLast && <ChevronRight className="size-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
