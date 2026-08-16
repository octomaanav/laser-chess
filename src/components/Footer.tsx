import React from 'react';
import { AUTHOR_NAME, AUTHOR_URL, CO_AUTHOR_NAME, CO_AUTHOR_URL } from '@/lib/site';
import { cn } from '@/lib/utils';

export interface FooterProps {
  theme?: 'platform' | 'laser' | 'coup';
  extraContent?: React.ReactNode;
  className?: string;
}

export default function Footer({ theme = 'platform', extraContent, className }: FooterProps) {
  const isCoup = theme === 'coup';
  const isLaser = theme === 'laser';

  return (
    <footer
      className={cn(
        'flex shrink-0 flex-col sm:flex-row items-center gap-3 px-5 py-6 text-center text-xs transition-colors',
        extraContent ? 'justify-between' : 'justify-center',
        isCoup
          ? 'text-[var(--coup-text-muted)]'
          : isLaser
            ? 'border-t border-border/60 text-muted-foreground'
            : 'text-muted-foreground',
        className
      )}
    >
      {extraContent && (
        <div className="flex items-center gap-1.5">{extraContent}</div>
      )}

      <div>
        Made with ❤️ by{' '}
        <a
          href={AUTHOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'font-semibold underline underline-offset-4 transition-colors',
            isCoup
              ? 'text-[var(--coup-text)] hover:opacity-80'
              : isLaser
                ? 'text-foreground hover:text-laser decoration-laser/50'
                : 'text-foreground hover:text-primary decoration-primary/50'
          )}
        >
          {AUTHOR_NAME}
        </a>{' '}
        &{' '}
        <a
          href={CO_AUTHOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'font-semibold underline underline-offset-4 transition-colors',
            isCoup
              ? 'text-[var(--coup-text)] hover:opacity-80'
              : isLaser
                ? 'text-foreground hover:text-laser decoration-laser/50'
                : 'text-foreground hover:text-primary decoration-primary/50'
          )}
        >
          {CO_AUTHOR_NAME}
        </a>
      </div>
    </footer>
  );
}
