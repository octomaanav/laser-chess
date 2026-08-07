'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Renderer } from '@/lib/render';
import { buildBoardFromDef, mirrorColor, validateSetup } from '@/game/setups';
import type { Color, EditablePiece, PieceType, SetupDef } from '@/game/types';
import LogoMark from './LogoMark';

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
      setMsg({ text: 'Your admin session expired — please sign in again.', kind: 'err' });
      onLogout?.();
      return;
    }
    const d = await res.json();
    if (!res.ok) setMsg({ text: d.error || 'save failed', kind: 'err' });
    else {
      setMsg({ text: `Saved "${name.trim()}" — it's now selectable in the lobby.`, kind: 'ok' });
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
      setMsg({ text: 'Your admin session expired — please sign in again.', kind: 'err' });
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

  return (
    <div className="admin">
      <header className="topbar">
        <a href="/" className="brand-row" style={{ textDecoration: 'none' }}>
          <LogoMark size={24} />
          <span className="brand">Laser Chess</span>
        </a>
        <span className="turn silver">Configuration editor</span>
        <div className="right">
          {email && <span className="badge silver">{email}</span>}
          <a href="/" className="btn tiny">
            ← Back to game
          </a>
          {onLogout && (
            <button className="btn tiny" onClick={onLogout}>
              Log out
            </button>
          )}
        </div>
      </header>

      <main className="admin-main">
        <div className="admin-board-area">
          <div className="seat-label">
            <span className="avatar red" />
            <span className="nm">Red — top player</span>
          </div>
          <div ref={rootRef} className="board-wrap" />
          <div className="seat-label">
            <span className="avatar silver" />
            <span className="nm">Teal — bottom player</span>
          </div>
        </div>

        <aside className="admin-side">
          <div className="panel">
            <div className="panel-title">Brush</div>
            <div className="seg">
              <button className={`seg-btn ${color === 'red' ? 'on red' : ''}`} onClick={() => { setColor('red'); setErase(false); }}>
                Red
              </button>
              <button className={`seg-btn ${color === 'silver' ? 'on silver' : ''}`} onClick={() => { setColor('silver'); setErase(false); }}>
                Teal
              </button>
            </div>
            <div className="type-grid">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  className={`type-btn ${!erase && type === t.type ? 'on' : ''}`}
                  onClick={() => { setType(t.type); setErase(false); }}
                >
                  <span className="tsw" style={{ background: color === 'red' ? '#ef5a40' : '#2fb0ab' }} />
                  {t.label}
                </button>
              ))}
              <button className={`type-btn ${erase ? 'on erase' : ''}`} onClick={() => setErase(true)}>
                🧽 Erase
              </button>
            </div>
            <p className="tip">
              Click an empty square to place. Click a matching piece to <b>rotate</b> it 90°. Click with a different brush to
              replace.
            </p>
          </div>

          <div className="panel">
            <div className="panel-title">Board</div>
            <div className="btn-row">
              <button className="btn" onClick={() => setPieces(mirrorColor(pieces, 'red'))}>Mirror Red→Teal</button>
              <button className="btn" onClick={() => setPieces(mirrorColor(pieces, 'silver'))}>Mirror Teal→Red</button>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={() => { setPieces([]); setMsg(null); }}>Clear</button>
              <button className="btn" onClick={() => { setPieces([]); setName('MySetup'); setMsg(null); }}>New</button>
            </div>
          </div>

          <div className={`panel check ${val.errors.length ? 'bad' : val.safe && !val.warnings.length ? 'good' : 'warn'}`}>
            <div className="panel-title">Validation</div>
            <div className="counts">
              <span>Red:</span> P{cnt('red', 'pharaoh')} · X{cnt('red', 'sphinx')} · A{cnt('red', 'anubis')} · S{cnt('red', 'scarab')} · Y{cnt('red', 'pyramid')}
            </div>
            <div className="counts">
              <span>Teal:</span> P{cnt('silver', 'pharaoh')} · X{cnt('silver', 'sphinx')} · A{cnt('silver', 'anubis')} · S{cnt('silver', 'scarab')} · Y{cnt('silver', 'pyramid')}
            </div>
            <div className="laser-line">Opening laser: {val.safe ? '✅ safe (destroys nothing)' : '❌ hits a piece'}</div>
            {val.redHit && <div className="laser-line err">Red beam → {val.redHit}</div>}
            {val.silverHit && <div className="laser-line err">Teal beam → {val.silverHit}</div>}
            {val.errors.map((e, i) => (
              <div key={i} className="laser-line err">⚠ {e}</div>
            ))}
            {val.warnings.map((w, i) => (
              <div key={i} className="laser-line warnline">• {w}</div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-title">Save</div>
            <div className="btn-row">
              <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              <button className="btn primary" disabled={!!val.errors.length || !name.trim()} onClick={save}>
                Save
              </button>
            </div>
            {msg && <div className={`save-msg ${msg.kind}`}>{msg.text}</div>}
          </div>

          <div className="panel">
            <div className="panel-title">Load existing</div>
            <div className="load-list">
              {list.map((s) => (
                <div key={s.name} className="load-item">
                  <button className="load-name" onClick={() => load(s)}>
                    {s.name}
                  </button>
                  <button className="load-del" title="delete" onClick={() => del(s.name)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
