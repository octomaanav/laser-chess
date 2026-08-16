'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eraser, LogOut, Trash2 } from 'lucide-react';
import { Renderer } from '@/lib/render';
import { buildBoardFromDef, mirrorColor, validateSetup } from '@/game/setups';
import type { Color, EditablePiece, PieceType, SetupDef } from '@/game/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import LogoMark from './LogoMark';
import ThemeToggle from './ThemeToggle';

const PanelTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>
);

const TYPES: { type: PieceType; label: string }[] = [
  { type: 'pyramid', label: 'Pyramid' },
  { type: 'scarab', label: 'Scarab' },
  { type: 'anubis', label: 'Anubis' },
  { type: 'pharaoh', label: 'Pharaoh' },
  { type: 'sphinx', label: 'Sphinx' },
];

export default function SetupEditor({ email, onLogout }: { email?: string; onLogout?: () => void } = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const piecesRef = useRef<EditablePiece[]>([]);

  const [pieces, setPieces] = useState<EditablePiece[]>([]);
  const [name, setName] = useState('MySetup');
  const [type, setType] = useState<PieceType>('pyramid');
  const [color, setColor] = useState<Color>('red');
  const [erase, setErase] = useState(false);
  const [list, setList] = useState<SetupDef[]>([]);
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  // keep refs fresh for the (once-bound) pointer handler
  piecesRef.current = pieces;
  const toolRef = useRef({ type, color, erase });
  toolRef.current = { type, color, erase };

  const val = useMemo(() => validateSetup({ name, pieces }), [name, pieces]);

  const fetchList = () =>
    fetch('/api/setups')
      .then((r) => r.json())
      .then((d: { setups: SetupDef[] }) => setList(d.setups || []))
      .catch(() => {});

  // ---- renderer lifecycle ---------------------------------------------------
  useEffect(() => {
    const root = rootRef.current!;
    const r = new Renderer(root);
    r.flip = false;
    rendererRef.current = r;
    const redraw = () => r.setBoard(buildBoardFromDef({ name: '', pieces: piecesRef.current }), { flip: false });
    const ro = new ResizeObserver(() => {
      r.resize();
      redraw();
    });
    ro.observe(root);
    r.resize();
    redraw();

    const onDown = (e: PointerEvent) => {
      const cell = r.cellFromClient(e.clientX, e.clientY);
      if (!cell) return;
      const { type, color, erase } = toolRef.current;
      setPieces((prev) => {
        const idx = prev.findIndex((p) => p.x === cell.x && p.y === cell.y);
        if (erase) {
          if (idx < 0) return prev;
          const n = [...prev];
          n.splice(idx, 1);
          return n;
        }
        if (idx >= 0) {
          const ex = prev[idx];
          const n = [...prev];
          n[idx] = ex.type === type && ex.color === color ? { ...ex, orient: (ex.orient + 1) % 4 } : { x: cell.x, y: cell.y, type, color, orient: 0 };
          return n;
        }
        return [...prev, { x: cell.x, y: cell.y, type, color, orient: 0 }];
      });
    };
    r.fxCanvas.addEventListener('pointerdown', onDown);
    fetchList();
    return () => {
      ro.disconnect();
      r.fxCanvas.removeEventListener('pointerdown', onDown);
      r.destroy();
      rendererRef.current = null;
    };
  }, []);

  // redraw whenever the pieces change
  useEffect(() => {
    rendererRef.current?.setBoard(buildBoardFromDef({ name, pieces }), { flip: false });
  }, [pieces, name]);

  // ---- actions --------------------------------------------------------------
  const save = async () => {
    const res = await fetch('/api/setups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), pieces }),
    });
    if (res.status === 401) {
      setMsg({ text: 'Your admin session expired. Please sign in again.', kind: 'err' });
      onLogout?.();
      return;
    }
    const d = await res.json();
    if (!res.ok) setMsg({ text: d.error || 'save failed', kind: 'err' });
    else {
      setMsg({ text: `Saved "${name.trim()}". It is now selectable in the lobby.`, kind: 'ok' });
      setList(d.setups || []);
    }
  };
  const load = (def: SetupDef) => {
    setName(def.name);
    setPieces(def.pieces.map((p) => ({ ...p })));
    setMsg(null);
  };
  const del = async (n: string) => {
    const res = await fetch('/api/setups?name=' + encodeURIComponent(n), { method: 'DELETE' });
    if (res.status === 401) {
      setMsg({ text: 'Your admin session expired. Please sign in again.', kind: 'err' });
      onLogout?.();
      return;
    }
    const d = await res.json();
    if (!res.ok) setMsg({ text: d.error || 'delete failed', kind: 'err' });
    else {
      setList(d.setups || []);
      setMsg({ text: `Deleted "${n}".`, kind: 'ok' });
    }
  };

  const cnt = (c: Color, t: PieceType) => val.counts[c][t] || 0;
  const brushHex = color === 'red' ? 'var(--player-red)' : 'var(--player-teal)';
  const checkTone = val.errors.length
    ? 'border-destructive/40 bg-destructive/5'
    : val.safe && !val.warnings.length
      ? 'border-player-teal/40 bg-player-teal/5'
      : 'border-amber-500/40 bg-amber-500/5';

  return (
    <div className="flex h-dvh flex-col overflow-hidden w-full max-w-full">
      <header className="flex w-full max-w-full shrink-0 items-center justify-between gap-1.5 sm:gap-3 border-b border-border/70 px-3 py-2 sm:px-4 sm:py-2.5 overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
          <a href="/" className="flex items-center gap-1.5 sm:gap-2 text-foreground shrink-0">
            <LogoMark size={22} />
            <span className="hidden font-display text-sm font-semibold tracking-tight sm:inline whitespace-nowrap">Laser Chess</span>
          </a>
          <span className="rounded-full border border-laser/40 bg-laser/10 px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold text-laser whitespace-nowrap">
            <span className="xs:hidden">Editor</span>
            <span className="hidden xs:inline">Configuration editor</span>
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {email && <span className="hidden text-xs text-muted-foreground lg:inline truncate max-w-32">{email}</span>}
          <ThemeToggle />
          <Button asChild variant="outline" size="sm" className="h-8 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm shrink-0">
            <a href="/">
              <ArrowLeft className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline sm:ml-1">Back to game</span>
            </a>
          </Button>
          {onLogout && (
            <Button variant="outline" size="sm" onClick={onLogout} className="size-8 p-0 sm:size-auto sm:h-9 sm:px-3 text-xs sm:text-sm shrink-0" title="Log out" aria-label="Log out">
              <LogOut className="size-3.5 sm:size-4" />
              <span className="hidden sm:inline sm:ml-1">Log out</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden lg:flex-row w-full max-w-full">
        <div className="relative flex flex-col items-center justify-center p-3 gap-2 min-h-[380px] xs:min-h-[440px] sm:min-h-[520px] lg:min-h-0 w-full shrink-0 lg:shrink lg:flex-1">
          <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs sm:text-sm shrink-0">
            <span className="size-2.5 rounded-full bg-player-red" /> Red (top player)
          </div>
          <div className="relative aspect-[10/8] max-h-full max-w-3xl w-full min-h-0 flex-1 my-auto overflow-hidden rounded-xl border border-border/50 bg-card/60 shadow-md">
            <div ref={rootRef} className="relative w-full h-full min-h-0" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs sm:text-sm shrink-0">
            <span className="size-2.5 rounded-full bg-player-teal" /> Teal (bottom player)
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-border/70 p-3 lg:w-80 lg:border-l lg:border-t-0">
          <Card className="gap-3 p-4">
            <PanelTitle>Brush</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => { setColor('red'); setErase(false); }}
                className={cn(color === 'red' && !erase && 'border-player-red bg-player-red/15 text-player-red')}
              >
                Red
              </Button>
              <Button
                variant="outline"
                onClick={() => { setColor('silver'); setErase(false); }}
                className={cn(color === 'silver' && !erase && 'border-player-teal bg-player-teal/15 text-player-teal')}
              >
                Teal
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <Button
                  key={t.type}
                  variant="outline"
                  onClick={() => { setType(t.type); setErase(false); }}
                  className={cn('justify-start', !erase && type === t.type && 'border-primary ring-1 ring-primary/40')}
                >
                  <span className="size-3.5 rounded-[4px] ring-1 ring-white/15" style={{ background: brushHex }} />
                  {t.label}
                </Button>
              ))}
              <Button
                variant="outline"
                onClick={() => setErase(true)}
                className={cn('justify-start', erase && 'border-destructive bg-destructive/10 text-destructive')}
              >
                <Eraser className="size-4" /> Erase
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Click an empty square to place. Click a matching piece to <b className="text-foreground">rotate</b> it 90°.
              Click with a different brush to replace.
            </p>
          </Card>

          <Card className="gap-2 p-4">
            <PanelTitle>Board</PanelTitle>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPieces(mirrorColor(pieces, 'red'))}>Mirror Red→Teal</Button>
              <Button variant="secondary" size="sm" onClick={() => setPieces(mirrorColor(pieces, 'silver'))}>Mirror Teal→Red</Button>
              <Button variant="secondary" size="sm" onClick={() => { setPieces([]); setMsg(null); }}>Clear</Button>
              <Button variant="secondary" size="sm" onClick={() => { setPieces([]); setName('MySetup'); setMsg(null); }}>New</Button>
            </div>
          </Card>

          <Card className={cn('gap-1.5 p-4', checkTone)}>
            <PanelTitle>Validation</PanelTitle>
            <div className="text-sm">
              <span className="text-muted-foreground">Red:</span> P{cnt('red', 'pharaoh')} · X{cnt('red', 'sphinx')} · A
              {cnt('red', 'anubis')} · S{cnt('red', 'scarab')} · Y{cnt('red', 'pyramid')}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Teal:</span> P{cnt('silver', 'pharaoh')} · X{cnt('silver', 'sphinx')} · A
              {cnt('silver', 'anubis')} · S{cnt('silver', 'scarab')} · Y{cnt('silver', 'pyramid')}
            </div>
            <div className="text-sm">Opening laser: {val.safe ? '✅ safe (destroys nothing)' : '❌ hits a piece'}</div>
            {val.redHit && <div className="text-sm text-destructive">Red beam → {val.redHit}</div>}
            {val.silverHit && <div className="text-sm text-destructive">Teal beam → {val.silverHit}</div>}
            {val.errors.map((e, i) => (
              <div key={i} className="text-sm text-destructive">⚠ {e}</div>
            ))}
            {val.warnings.map((w, i) => (
              <div key={i} className="text-sm text-amber-400">• {w}</div>
            ))}
          </Card>

          <Card className="gap-2 p-4">
            <PanelTitle>Save</PanelTitle>
            <div className="flex gap-2">
              <Input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              <Button className="glow-primary" disabled={!!val.errors.length || !name.trim()} onClick={save}>
                Save
              </Button>
            </div>
            {msg && <p className={cn('text-sm font-medium', msg.kind === 'ok' ? 'text-laser' : 'text-destructive')}>{msg.text}</p>}
          </Card>

          <Card className="gap-2 p-4">
            <PanelTitle>Load existing</PanelTitle>
            <div className="flex flex-col gap-1.5">
              {list.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <button
                    className="flex-1 rounded-md border border-border bg-secondary/50 px-3 py-2 text-left text-sm font-medium hover:border-laser/50"
                    onClick={() => load(s)}
                  >
                    {s.name}
                  </button>
                  <Button variant="ghost" size="icon" title="delete" onClick={() => del(s.name)}>
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
}
