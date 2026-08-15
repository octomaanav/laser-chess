'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import AccountMenu from './AccountMenu';
import { Button } from './ui/button';
import FeedbackModal from './FeedbackModal';
import FriendsMenu from './FriendsMenu';
import ThemeToggle from './ThemeToggle';
import LogoMark from './LogoMark';
import CoupLogoMark from './coup/CoupLogoMark';
import TutorialModal from './tutorials/TutorialModal';
import { LASER_CHESS_TUTORIAL_STEPS } from './tutorials/laserChessTutorial';
import { COUP_TUTORIAL_STEPS } from './tutorials/coupTutorial';
import { SITE_NAME } from '@/lib/site';
import { cn } from '@/lib/utils';

export type NavbarGame = 'platform' | 'laser-chess' | 'coup';

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

  const defaultBrandHref = isCoup ? '/games/coup' : isLaser ? '/games/laser-chess' : '/';
  const resolvedBrandHref = brandHref || defaultBrandHref;

  const defaultTitle = isCoup ? 'Coup' : isLaser ? 'Laser Chess' : SITE_NAME;
  const resolvedTitle = title || defaultTitle;

  const [tutorialOpen, setTutorialOpen] = React.useState(false);

  return (
    <header
      className={cn(
        'flex shrink-0 items-center justify-between px-4 py-3 sm:px-8 sm:py-4 transition-colors duration-200',
        isCoup
          ? 'border-b border-[var(--coup-panel-border)] text-[var(--coup-text)]'
          : 'border-b border-border/70 text-foreground',
        className
      )}
    >
      {/* Brand logo & title */}
      <div className="flex items-center gap-3">
        <a
          href={resolvedBrandHref}
          className={cn(
            'flex items-center gap-2.5 transition-opacity hover:opacity-90',
            isCoup ? 'text-[var(--coup-text)]' : 'text-foreground'
          )}
        >
          {isCoup ? (
            <CoupLogoMark size={26} />
          ) : isLaser ? (
            <LogoMark size={26} />
          ) : (
            <span className="grid size-9 place-items-center rounded-xl bg-lime-500 dark:bg-[#c3f53b] font-display text-sm font-extrabold text-black shadow-sm dark:shadow-[0_0_22px_rgba(195,245,59,0.45)]">
              GN
            </span>
          )}
          <span className="font-display text-lg font-bold tracking-tight">
            {resolvedTitle}
          </span>
        </a>

        {/* Center / middle content (e.g. status pill, timer, breadcrumb) */}
        {centerContent && <div className="flex items-center gap-2.5 pl-2">{centerContent}</div>}
      </div>

      {/* Right side shared controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {showBackToGames && (
          <a
            href="/"
            className={cn(
              'mr-1 hidden text-sm font-medium transition-colors sm:inline',
              isCoup
                ? 'text-[var(--coup-text-muted)] hover:text-[var(--coup-text)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ← All games
          </a>
        )}

        {(isLaser || isCoup) && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTutorialOpen(true)}
              className={cn(
                isCoup ? 'text-[var(--coup-text-muted)] hover:text-[var(--coup-text)]' : undefined
              )}
            >
              <HelpCircle className="size-4" />
              <span className="hidden sm:inline">How to play</span>
            </Button>
            <TutorialModal
              open={tutorialOpen}
              onOpenChange={setTutorialOpen}
              gameTitle={resolvedTitle}
              steps={isCoup ? COUP_TUTORIAL_STEPS : LASER_CHESS_TUTORIAL_STEPS}
              theme={isCoup ? 'coup' : 'laser'}
            />
          </>
        )}

        <FeedbackModal
          triggerClassName={
            isCoup
              ? 'text-[var(--coup-text-muted)] hover:text-[var(--coup-text)]'
              : undefined
          }
        />

        <ThemeToggle />

        <FriendsMenu />

        <AccountMenu />

        {/* Extra in-game controls (e.g. leave button, sound toggle, player badge) */}
        {rightContent}
      </div>
    </header>
  );
}
