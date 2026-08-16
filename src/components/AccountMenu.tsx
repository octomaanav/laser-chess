'use client';
import { useState } from 'react';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import { useSession } from '@/client/useSession';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AuthPanel from './AuthPanel';

// The signed-in account dropdown (or a "Sign in" button when logged out), shared
// by the Game Night catalogue header and the Laser Chess lobby. Owns its own
// sign-in dialog via useSession.
export default function AccountMenu() {
  const { user, providers, setUser, logout } = useSession();
  const [showAuth, setShowAuth] = useState(false);
  const initial = (user?.displayName || user?.username || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-8 md:size-auto md:h-9 md:px-2.5 md:gap-2 font-medium text-foreground border-border shrink-0 aspect-square md:aspect-auto"
              title={`@${user.username}`}
              aria-label={`User account @${user.username}`}
            >
              <span className="grid size-5 md:size-5.5 place-items-center rounded-full bg-lime-500 dark:bg-[#c3f53b] text-[10px] md:text-[11px] font-extrabold text-black shadow-xs shrink-0 aspect-square">
                {initial}
              </span>
              <span className="hidden md:inline max-w-28 truncate font-mono text-xs font-semibold text-foreground">@{user.username}</span>
              <ChevronDown className="hidden md:inline size-3.5 text-muted-foreground opacity-70 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <a href="/account">
                <UserRound className="size-4" /> Account
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void logout()}>
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button variant="outline" size="sm" className="h-8 px-2.5 md:h-9 md:px-3 text-xs md:text-sm shrink-0" onClick={() => setShowAuth(true)}>
          Sign in
        </Button>
      )}

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
    </>
  );
}
