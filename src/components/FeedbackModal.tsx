'use client';

import { useState } from 'react';
import { Bug, Check, Copy, Lightbulb, Loader2, MessageSquare, MessageSquarePlus, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type FeedbackType = 'bug' | 'feature' | 'general';

interface FeedbackModalProps {
  triggerClassName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  renderTrigger?: boolean;
}

export default function FeedbackModal({
  triggerClassName,
  variant = 'ghost',
  size = 'sm',
  showLabel = true,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  renderTrigger = true,
}: FeedbackModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (!isControlled) setInternalOpen(val);
    controlledOnOpenChange?.(val);
  };
  const [type, setType] = useState<FeedbackType>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sender, setSender] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const categories: { id: FeedbackType; label: string; icon: typeof Bug }[] = [
    { id: 'bug', label: 'Bug Report', icon: Bug },
    { id: 'feature', label: 'Feature Request', icon: Lightbulb },
    { id: 'general', label: 'General', icon: MessageSquare },
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() && !subject.trim()) {
      toast.error('Please enter a brief summary or message.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: categories.find((c) => c.id === type)?.label || 'General',
          subject: subject.trim(),
          message: message.trim(),
          sender: sender.trim(),
          url: typeof window !== 'undefined' ? window.location.href : 'Game Night',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      toast.success('Feedback sent directly!', {
        description: 'Thank you for helping improve Game Night.',
      });

      setOpen(false);
      setSubject('');
      setMessage('');
      setSender('');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Could not send feedback. Please try again.';
      toast.error(errMsg);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    const categoryLabel = categories.find((c) => c.id === type)?.label || 'Feedback';
    const textToCopy = `[${categoryLabel}] ${subject.trim()}\n${sender ? `From: ${sender.trim()}\n` : ''}${message.trim()}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Feedback copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {renderTrigger && (
        <DialogTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn(
              'size-8 p-0 md:size-auto md:h-9 md:px-3 text-xs md:text-sm gap-1.5 font-medium transition-colors text-muted-foreground hover:text-foreground shrink-0',
              triggerClassName
            )}
            title="Send feedback or report a bug"
          >
            <MessageSquarePlus className="size-4 text-primary" />
            {showLabel && <span className="hidden md:inline whitespace-nowrap">Feedback</span>}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground shadow-2xl backdrop-blur-xl">
        <DialogHeader className="gap-1.5">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary border border-primary/30">
              <Sparkles className="size-4" />
            </span>
            <DialogTitle className="font-display text-xl font-bold">
              Feedback & Suggestions
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Found a bug, want a new game, or have an idea? All feedback is sent directly to Manav.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {/* Category tabs */}
          <div className="flex rounded-xl border border-border bg-muted/40 p-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const active = type === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setType(cat.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Subject / Short title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb-subject" className="text-xs font-medium text-muted-foreground">
              {type === 'bug' ? 'What went wrong?' : 'Title or Idea'}
            </Label>
            <Input
              id="fb-subject"
              placeholder={
                type === 'bug'
                  ? 'e.g. Laser reflection glitched on mobile'
                  : type === 'feature'
                  ? 'e.g. Add an undo move option or sound toggle'
                  : 'Brief summary'
              }
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-input bg-background/50 text-sm"
              disabled={busy}
            />
          </div>

          {/* Details */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb-message" className="text-xs font-medium text-muted-foreground">
              Details
            </Label>
            <textarea
              id="fb-message"
              rows={4}
              placeholder={
                type === 'bug'
                  ? 'Describe what happened and how to reproduce it…'
                  : 'Tell us more about the feature or suggestions…'
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
              className="resize-none rounded-md border border-input bg-background/50 p-2.5 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Optional contact */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fb-sender" className="text-xs font-medium text-muted-foreground">
              Your Email or Name <span className="opacity-60">(optional)</span>
            </Label>
            <Input
              id="fb-sender"
              placeholder="e.g. yourname@example.com"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              disabled={busy}
              className="border-input bg-background/50 text-sm"
            />
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={busy}
              className="text-xs"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={busy}
                className="gap-1.5 font-semibold shadow-sm"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {busy ? 'Sending…' : 'Send Feedback'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
