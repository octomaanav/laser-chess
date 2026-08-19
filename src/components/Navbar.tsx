'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import AccountMenu from './AccountMenu';
import { Button } from './ui/button';
import LogoMark from './LogoMark';
import CoupLogoMark from './coup/CoupLogoMark';
import Flip7LogoMark from './flip7/Flip7LogoMark';
import TutorialModal from './tutorials/TutorialModal';
import { LASER_CHESS_TUTORIAL_STEPS } from './tutorials/laserChessTutorial';
import { COUP_TUTORIAL_STEPS } from './tutorials/coupTutorial';
import { FLIP7_TUTORIAL_STEPS } from './tutorials/flip7Tutorial';
import { SITE_NAME } from '@/lib/site';
import { cn } from '@/lib/utils';

export type NavbarGame = 'platform' | 'laser-chess' | 'coup' | 'flip7';

export interface NavbarProps {
  game?: NavbarGame;
  title?: string;
  brandHref?: string;
  showBackToGames?: boolean;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export default function Navbar({
  game = 'platform',
  title,
  brandHref,
  showBackToGames = false,
  centerContent,
  rightContent,
  className,
}: NavbarProps) {
  // Determine game theme styling tokens
  const isCoup = game === 'coup';
  const isLaser = game === 'laser-chess';
  const isFlip7 = game === 'flip7';

  const defaultBrandHref = isCoup ? '/games/coup' : isLaser ? '/games/laser-chess' : isFlip7 ? '/games/flip7' : '/';
  const resolvedBrandHref = brandHref || defaultBrandHref;

  const defaultTitle = isCoup ? 'Boardroom' : isLaser ? 'Laser Chess' : isFlip7 ? 'Flip 7' : SITE_NAME;
  const resolvedTitle = title || defaultTitle;

  const [tutorialOpen, setTutorialOpen] = React.useState(false);

  return (
    <header
      className={cn(
        'flex w-full max-w-full shrink-0 items-center justify-between px-2.5 py-2 sm:px-5 lg:px-8 sm:py-3 transition-colors duration-200 gap-1.5 sm:gap-2 overflow-hidden',
        isCoup
          ? 'border-b border-[var(--coup-panel-border)] text-[var(--coup-text)]'
          : isFlip7
            ? 'border-b border-[var(--flip7-panel-border)] text-[var(--flip7-text)]'
            : 'border-b border-border/70 text-foreground',
        className
      )}
    >
      {/* Brand logo & title */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
        <a
          href={resolvedBrandHref}
          className={cn(
            'flex items-center gap-1.5 sm:gap-2.5 transition-opacity hover:opacity-90 shrink-0',
            isCoup ? 'text-[var(--coup-text)]' : isFlip7 ? 'text-[var(--flip7-text)]' : 'text-foreground'
          )}
        >
          {isCoup ? (
            <CoupLogoMark size={24} />
          ) : isFlip7 ? (
            <Flip7LogoMark size={24} />
          ) : isLaser ? (
            <LogoMark size={24} />
          ) : (
            <span className="grid size-8 sm:size-9 place-items-center rounded-xl bg-lime-500 dark:bg-[#c3f53b] font-display text-xs sm:text-sm font-extrabold text-black shadow-sm dark:shadow-[0_0_22px_rgba(195,245,59,0.45)]">
              GN
            </span>
          )}
          <span className="font-display text-sm sm:text-base lg:text-lg font-bold tracking-tight whitespace-nowrap hidden xs:inline sm:inline">
            {resolvedTitle}
          </span>
        </a>

        {/* Center / middle content (e.g. status pill, timer, breadcrumb) */}
        {centerContent && <div className="flex items-center gap-1 sm:gap-2 pl-0.5 sm:pl-1 min-w-0 shrink">{centerContent}</div>}
      </div>

      {/* Right side shared controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0">
        {showBackToGames && (
          <a
            href="/"
            className={cn(
              'mr-1 hidden md:inline text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
              isCoup
                ? 'text-[var(--coup-text-muted)] hover:text-[var(--coup-text)]'
                : isFlip7
                  ? 'text-[var(--flip7-text-muted)] hover:text-[var(--flip7-text)]'
                  : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ← All games
          </a>
        )}

        {(isLaser || isCoup || isFlip7) && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTutorialOpen(true)}
              className={cn(
                'size-8 sm:size-8 lg:size-auto lg:h-9 lg:px-2.5 shrink-0',
                isCoup
                  ? 'text-[var(--coup-text-muted)] hover:text-[var(--coup-text)]'
                  : isFlip7
                    ? 'text-[var(--flip7-text-muted)] hover:text-[var(--flip7-text)]'
                    : undefined
              )}
              title="How to play"
              aria-label="How to play"
            >
              <HelpCircle className="size-4" />
              <span className="hidden lg:inline lg:ml-1.5 text-xs sm:text-sm font-medium whitespace-nowrap">How to play</span>
            </Button>
            <TutorialModal
              open={tutorialOpen}
              onOpenChange={setTutorialOpen}
              gameTitle={resolvedTitle}
              steps={isCoup ? COUP_TUTORIAL_STEPS : isFlip7 ? FLIP7_TUTORIAL_STEPS : LASER_CHESS_TUTORIAL_STEPS}
              theme={isCoup ? 'coup' : isFlip7 ? 'flip7' : 'laser'}
            />
          </>
        )}

        <AccountMenu />

        {/* Extra in-game controls (e.g. leave button, sound toggle, player badge) */}
        {rightContent}
      </div>
    </header>
  );
}
