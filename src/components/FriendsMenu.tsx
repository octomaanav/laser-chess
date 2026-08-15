'use client';
import { useState } from 'react';
import { Check, Gamepad2, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/client/useSession';
import { useSocial } from '@/client/social/SocialProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The global friends panel shown in every header. Renders only for signed-in
// users; when you're inside a game, each online friend gets an Invite button.
export default function FriendsMenu() {
  const { user } = useSession();
  const social = useSocial();
  const [username, setUsername] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user || !social) return null;
  const { friends, incoming, outgoing, pendingCount, canInvite } = social;

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || busy) return;
    setBusy(true);
    setErr('');
    const res = await social.addFriend(username.trim());
    setBusy(false);
    if (res.ok) {
      setUsername('');
      toast('Friend request sent');
    } else setErr(res.error || 'Could not send request.');
  };

  const doInvite = async (id: string, name: string) => {
    const res = await social.invite(id);
    toast(res.ok ? `Invited ${name}` : res.error || 'Could not invite.');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative text-foreground" title="Friends" aria-label="Friends">
          <Users className="size-4" />
          {pendingCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-lime-500 dark:bg-[#c3f53b] px-1 text-[10px] font-extrabold leading-4 text-black shadow-xs">
              {pendingCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="border-b border-border/70 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add a friend</div>
          <form onSubmit={submitAdd} className="mt-2 flex gap-2">
            <Input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErr('');
              }}
              placeholder="@username"
              maxLength={20}
              className="h-9"
            />
            <Button type="submit" size="sm" className="h-9 shrink-0" disabled={busy || !username.trim()}>
              <UserPlus className="size-4" /> Add
            </Button>
          </form>
          {err && <p className="mt-1.5 text-xs font-medium text-destructive">{err}</p>}
        </div>

        <div className="max-h-[22rem] overflow-y-auto">
          {incoming.length > 0 && (
            <Section label={`Requests · ${incoming.length}`}>
              {incoming.map((u) => (
                <Row key={u.id} name={u.displayName} handle={u.username}>
                  <Button size="icon" className="size-7" onClick={() => void social.respond(u.id, true)} title="Accept">
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="size-7" onClick={() => void social.respond(u.id, false)} title="Deny">
                    <X className="size-4" />
                  </Button>
                </Row>
              ))}
            </Section>
          )}

          <Section label={`Friends · ${friends.length}`}>
            {friends.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">No friends yet - add someone by @username.</p>}
            {friends.map((f) => (
              <Row key={f.id} name={f.displayName} handle={f.username} online={f.online}>
                {canInvite && f.online && (
                  <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => void doInvite(f.id, f.displayName)}>
                    <Gamepad2 className="size-3.5" /> Invite
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => void social.unfriend(f.id)}
                  title="Remove friend"
                >
                  <X className="size-4" />
                </Button>
              </Row>
            ))}
          </Section>

          {outgoing.length > 0 && (
            <Section label={`Sent · ${outgoing.length}`}>
              {outgoing.map((u) => (
                <Row key={u.id} name={u.displayName} handle={u.username}>
                  <span className="text-xs text-muted-foreground">Pending</span>
                </Row>
              ))}
            </Section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Row({
  name,
  handle,
  online,
  children,
}: {
  name: string;
  handle: string;
  online?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-1.5">
      {online !== undefined && (
        <span className={cn('size-2 shrink-0 rounded-full', online ? 'bg-emerald-400' : 'bg-muted-foreground/40')} title={online ? 'online' : 'offline'} />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate font-mono text-xs text-muted-foreground">@{handle}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
