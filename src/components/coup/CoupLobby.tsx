// src/components/coup/CoupLobby.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CoupController, CoupView } from '@/client/coupController';

export default function CoupLobby({ controller, view }: { controller: CoupController; view: CoupView }) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!view.shareUrl) return;
    try {
      await navigator.clipboard.writeText(view.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard permission denied — the room code is still visible to copy manually */
    }
  };

  if (view.screen === 'lobby') {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-3 p-6">
        <h1 className="text-xl font-bold" style={{ color: '#c8155e' }}>
          Coup
        </h1>
        <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => controller.start({ name })}>Create room</Button>
        <div className="flex gap-2">
          <Input placeholder="Room code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} />
          <Button variant="secondary" onClick={() => controller.start({ name, code: joinCode })}>
            Join
          </Button>
        </div>
        {view.error && <p className="text-sm text-red-400">{view.error}</p>}
      </div>
    );
  }

  const lobby = view.lobby;
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 p-6">
      <h1 className="text-xl font-bold" style={{ color: '#c8155e' }}>
        Room {view.code}
      </h1>
      <div className="flex gap-2">
        <Input readOnly value={view.shareUrl ?? ''} onFocus={(e) => e.currentTarget.select()} />
        <Button variant="secondary" onClick={copyLink}>
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
      </div>
      <ul className="space-y-1 text-sm text-[#8a909b]">
        {lobby?.seats.map((s) => (
          <li key={s.id}>
            {s.name} {s.connected ? '' : '(disconnected)'}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[#5a6070]">
        {lobby?.seats.length ?? 0} / {lobby?.maxSeats ?? 6} players
      </p>
      <Button disabled={!lobby?.canStart} onClick={() => controller.startGame()}>
        Start game
      </Button>
      {view.error && <p className="text-sm text-red-400">{view.error}</p>}
    </div>
  );
}
