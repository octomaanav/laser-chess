'use client';
import { useEffect, useState } from 'react';
import {
  ChevronDown,
  LogOut,
  MessageSquarePlus,
  Moon,
  MoreVertical,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSession } from '@/client/useSession';
import { useSocial } from '@/client/social/SocialProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AuthPanel from './AuthPanel';
import FeedbackModal from './FeedbackModal';
import FriendsModal from './FriendsModal';

// Unified Profile & Navigation Dropdown Menu
// When logged in: houses Profile, Account, Friends & Invites, Theme Toggle, Feedback, and Sign Out.
// When logged out: houses a clean "Sign in" button + a sleek options dropdown (Theme, Feedback, Sign in).
export default function AccountMenu() {
  const { user, providers, setUser, logout } = useSession();
  const social = useSocial();
  const { resolvedTheme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === 'dark';
  const pendingCount = social?.pendingCount || 0;
  const initial = (user?.displayName || user?.username || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      {user ? (
        /* Logged In: Profile Button with unified dropdown */
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="relative h-8 px-2 md:h-9 md:px-2.5 md:gap-2 font-medium text-foreground border-border shrink-0"
              title={`@${user.username}`}
              aria-label={`User account @${user.username}`}
            >
              <span className="relative grid size-5 md:size-5.5 place-items-center rounded-full bg-lime-500 dark:bg-[#c3f53b] text-[10px] md:text-[11px] font-extrabold text-black shadow-xs shrink-0 aspect-square">
                {initial}
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-red-500 border-2 border-background animate-pulse" />
                )}
              </span>
              <span className="hidden md:inline max-w-28 truncate font-mono text-xs font-semibold text-foreground">
                @{user.username}
              </span>
              <ChevronDown className="hidden md:inline size-3.5 text-muted-foreground opacity-70 shrink-0" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl border-border bg-card">
            {/* User Header */}
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <span className="grid size-8 place-items-center rounded-full bg-lime-500 dark:bg-[#c3f53b] text-xs font-extrabold text-black shrink-0">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-foreground">{user.displayName || user.username}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">@{user.username}</div>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Account Settings */}
            <DropdownMenuItem asChild className="cursor-pointer gap-2 py-2 text-xs">
              <a href="/account">
                <UserRound className="size-4 text-muted-foreground" />
                <span>Account Settings</span>
              </a>
            </DropdownMenuItem>

            {/* Friends & Invites */}
            <DropdownMenuItem
              onClick={() => setShowFriends(true)}
              className="cursor-pointer gap-2 py-2 text-xs justify-between"
            >
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span>Friends & Invites</span>
              </div>
              {pendingCount > 0 && (
                <span className="rounded-full bg-lime-500 dark:bg-[#c3f53b] px-1.5 py-0.5 text-[10px] font-extrabold text-black leading-none">
                  {pendingCount}
                </span>
              )}
            </DropdownMenuItem>

            {/* Theme Toggle */}
            <DropdownMenuItem
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="cursor-pointer gap-2 py-2 text-xs justify-between"
            >
              <div className="flex items-center gap-2">
                {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-sky-400" />}
                <span>Theme</span>
              </div>
              <span className="text-[11px] text-muted-foreground capitalize font-medium">
                {isDark ? 'Dark' : 'Light'}
              </span>
            </DropdownMenuItem>

            {/* Feedback */}
            <DropdownMenuItem
              onClick={() => setShowFeedback(true)}
              className="cursor-pointer gap-2 py-2 text-xs"
            >
              <MessageSquarePlus className="size-4 text-primary" />
              <span>Feedback & Ideas</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Sign out */}
            <DropdownMenuItem
              onClick={() => void logout()}
              className="cursor-pointer gap-2 py-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="size-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        /* Logged Out: Compact Sign in + Options dropdown */
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 sm:h-9 sm:px-3 text-xs sm:text-sm font-semibold shrink-0"
            onClick={() => setShowAuth(true)}
          >
            Sign in
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 sm:size-9 text-muted-foreground hover:text-foreground shrink-0"
                title="Options"
                aria-label="Options menu"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1.5 shadow-xl border-border bg-card">
              {/* Theme Toggle */}
              <DropdownMenuItem
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="cursor-pointer gap-2 py-2 text-xs justify-between"
              >
                <div className="flex items-center gap-2">
                  {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-sky-400" />}
                  <span>Theme</span>
                </div>
                <span className="text-[11px] text-muted-foreground capitalize font-medium">
                  {isDark ? 'Dark' : 'Light'}
                </span>
              </DropdownMenuItem>

              {/* Feedback */}
              <DropdownMenuItem
                onClick={() => setShowFeedback(true)}
                className="cursor-pointer gap-2 py-2 text-xs"
              >
                <MessageSquarePlus className="size-4 text-primary" />
                <span>Feedback & Ideas</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Sign in shortcut */}
              <DropdownMenuItem
                onClick={() => setShowAuth(true)}
                className="cursor-pointer gap-2 py-2 text-xs text-primary font-medium"
              >
                <UserRound className="size-4" />
                <span>Sign in / Register</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Controlled Modals */}
      {showAuth && (
        <AuthPanel
          providers={providers}
          onAuthed={(u) => {
            setUser(u);
            setShowAuth(false);
          }}
          onClose={() => setShowAuth(false)}
        />
      )}

      <FriendsModal
        open={showFriends}
        onOpenChange={setShowFriends}
      />

      <FeedbackModal
        open={showFeedback}
        onOpenChange={setShowFeedback}
        renderTrigger={false}
      />
    </>
  );
}
