'use client';
import { useState } from 'react';
import { Check, Gamepad2, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSocial } from '@/client/social/SocialProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export interface FriendsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FriendsModal({ open, onOpenChange }: FriendsModalProps) {
  const social = useSocial();
  const [username, setUsername] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!social) return null;
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
      toast.success('Friend request sent');
    } else {
      setErr(res.error || 'Could not send request.');
    }
  };

  const doInvite = async (id: string, name: string) => {
    const res = await social.invite(id);
    if (res.ok) {
      toast.success(`Invited ${name} to game`);
    } else {
      toast.error(res.error || 'Could not invite.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground shadow-2xl backdrop-blur-xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-lime-500/15 dark:bg-[#c3f53b]/15 text-lime-600 dark:text-[#c3f53b] border border-lime-500/30">
              <Users className="size-4" />
            </span>
            <DialogTitle className="font-display text-lg font-bold flex items-center gap-2">
              Friends & Invites
              {pendingCount > 0 && (
                <span className="rounded-full bg-lime-500 dark:bg-[#c3f53b] px-1.5 py-0.5 text-[10px] font-extrabold text-black leading-none">
                  {pendingCount} new
                </span>
              )}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect with friends, invite them to your current game room, or manage requests.
          </DialogDescription>
        </DialogHeader>

        {/* Add Friend Input */}
        <div className="px-5 py-3 border-b border-border/60 bg-muted/20">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Add by Username</div>
          <form onSubmit={submitAdd} className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErr('');
              }}
              placeholder="@username"
              maxLength={20}
              className="h-9 text-xs sm:text-sm bg-background/60"
            />
            <Button type="submit" size="sm" className="h-9 shrink-0 gap-1.5 text-xs font-semibold" disabled={busy || !username.trim()}>
              <UserPlus className="size-3.5" /> Add
            </Button>
          </form>
          {err && <p className="mt-1.5 text-xs font-medium text-destructive">{err}</p>}
        </div>

        {/* Friends & Requests List */}
        <div className="max-h-[22rem] overflow-y-auto divide-y divide-border/40">
          {incoming.length > 0 && (
            <Section label={`Incoming Requests (${incoming.length})`}>
              {incoming.map((u) => (
                <Row key={u.id} name={u.displayName} handle={u.username}>
                  <Button size="icon" className="size-7 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => void social.respond(u.id, true)} title="Accept">
                    <Check className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="outline" className="size-7" onClick={() => void social.respond(u.id, false)} title="Deny">
                    <X className="size-3.5" />
                  </Button>
                </Row>
              ))}
            </Section>
          )}

          <Section label={`Friends (${friends.length})`}>
            {friends.length === 0 && (
              <p className="px-5 py-4 text-center text-xs text-muted-foreground">
                No friends added yet. Share your @username with friends to play together!
              </p>
            )}
            {friends.map((f) => (
              <Row key={f.id} name={f.displayName} handle={f.username} online={f.online}>
                {canInvite && f.online && (
                  <Button size="sm" className="h-7 px-2.5 text-xs gap-1 font-semibold" onClick={() => void doInvite(f.id, f.displayName)}>
                    <Gamepad2 className="size-3" /> Invite
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => void social.unfriend(f.id)}
                  title="Remove friend"
                >
                  <X className="size-3.5" />
                </Button>
              </Row>
            ))}
          </Section>

          {outgoing.length > 0 && (
            <Section label={`Sent Requests (${outgoing.length})`}>
              {outgoing.map((u) => (
                <Row key={u.id} name={u.displayName} handle={u.username}>
                  <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">Pending</span>
                </Row>
              ))}
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <div className="px-5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
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
    <div className="flex items-center gap-2.5 px-5 py-2 hover:bg-muted/30 transition-colors">
      {online !== undefined && (
        <span
          className={cn('size-2 shrink-0 rounded-full', online ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-muted-foreground/40')}
          title={online ? 'Online' : 'Offline'}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-foreground">{name}</div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">@{handle}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
