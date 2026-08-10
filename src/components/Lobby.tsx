'use client';
import { useEffect, useState } from 'react';
import type { GameController, ViewState } from '@/client/controller';
import { useSession } from '@/client/useSession';
import { SETUP_NAMES } from '@/game/setups';
import AuthPanel from './AuthPanel';
import LogoMark from './LogoMark';

export default function Lobby({ controller, view }: { controller: GameController; view: ViewState }) {
  const [name, setName] = useState('');
  const [setup, setSetup] = useState('Classic');
  const [color, setColor] = useState<'random' | 'silver' | 'red'>('random');
  const [code, setCode] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [invited, setInvited] = useState(false);
  const [names, setNames] = useState<string[]>(SETUP_NAMES);
  const [perMove, setPerMove] = useState(0); // minutes per move; 0 = no timer
  const { user, providers, setUser } = useSession();
  const [showAuth, setShowAuth] = useState(false);

  // Signed-in players always play under their account's display name.
  useEffect(() => {
    if (user) setName(user.displayName);
  }, [user]);

  useEffect(() => {
    setName(controller.getStoredName());
    const params = new URLSearchParams(window.location.search);
    const g = (params.get('game') || '').toUpperCase();
    if (g) {
      setCode(g);
      setInvited(true);
      // Returning to a game this browser already played → reconnect seamlessly.
      if (controller.wasInRoom(g)) controller.start({ code: g });
    }
    fetch('/api/setups')
      .then((r) => r.json())
      .then((d: { setups: { name: string }[] }) => {
        if (Array.isArray(d.setups) && d.setups.length) setNames(d.setups.map((s) => s.name));
      })
      .catch(() => {});
  }, [controller]);

  const create = () => {
    controller.setName(name);
    controller.start({ setup, color, perMove });
  };
  const join = () => {
    if (!code.trim()) {
      controller.toast('Enter a game code');
      return;
    }
    controller.setName(name);
    controller.start({ code: code.trim().toUpperCase() });
  };

  const initial = (user?.displayName || user?.username || '?').trim().charAt(0).toUpperCase();

  return (
    <section id="lobby" className="screen">
      <header className="topbar">
        <a className="brand" href="/">
          <LogoMark size={28} /> <span>Laser Chess</span>
        </a>
        <nav className="topbar-actions">
          {user ? (
            <a className="nav-account" href="/account" title="Manage your account">
              <span className="nav-avatar">{initial}</span>
              <span className="nav-handle">@{user.username}</span>
            </a>
          ) : (
            <button type="button" className="nav-signin" onClick={() => setShowAuth(true)}>
              Sign in
            </button>
          )}
        </nav>
      </header>

      <div className="lobby-main">
        <div className="lobby-hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <i className="eyebrow-dot" /> Real-time multiplayer · free · no install
            </span>
            <h1 className="hero-title">
              Deflect the beam.
              <br />
              Burn the <span>Pharaoh.</span>
            </h1>
            <p className="hero-sub">
              A fast head-to-head duel of mirrors and lasers. Spin up a board, share the link, and play a
              friend in seconds — right in the browser.
            </p>
            <ul className="hero-points">
              <li>No account needed — just share a link or code</li>
              <li>Authoritative server resolves every laser trace</li>
              <li>Spectators, live presence, reconnect &amp; move timers</li>
            </ul>
            <button className="link" onClick={() => setShowRules((s) => !s)}>
              How to play ▾
            </button>
            <div className={`rules${showRules ? ' open' : ''}`}>
              <p>
                Each turn: <b>move</b> a piece one square (any direction) <b>or rotate</b> it 90°. Then{' '}
                <b>your laser fires automatically</b> from your Sphinx.
              </p>
              <ul>
                <li>
                  <b>Pharaoh</b> — your king. If a laser hits it, you lose.
                </li>
                <li>
                  <b>Pyramid</b> — one mirror; deflects the beam 90°. Hit on a flat side and it&apos;s destroyed.
                </li>
                <li>
                  <b>Scarab</b> — double mirror; always deflects, never dies. Can swap with an adjacent Pyramid/Anubis.
                </li>
                <li>
                  <b>Anubis</b> — shielded on its bright front face; hit from the side or back and it&apos;s destroyed.
                </li>
                <li>
                  <b>Sphinx</b> — your laser cannon in the corner. You can only rotate it.
                </li>
              </ul>
            </div>
          </div>

          <div className={`lobby-card${invited ? ' invited' : ''}`}>
            <div className="card-head">
              <h2 className="card-title">{invited ? 'Join the game' : 'New game'}</h2>
              <p className="card-sub">
                {invited ? `You're invited to ${code}. Enter a name and join.` : 'Set it up, then share the link.'}
              </p>
            </div>

            <label className="field">
              <span>Your name</span>
              <input
                type="text"
                maxLength={24}
                placeholder="Player"
                value={name}
                readOnly={!!user}
                onChange={(e) => setName(e.target.value)}
              />
              {user && (
                <small className="field-hint">
                  Playing as your account name. <a href="/account">Change in Account</a>.
                </small>
              )}
            </label>

            <div className="create-box">
              <div className="row2">
                <label className="field">
                  <span>Board</span>
                  <select value={setup} onChange={(e) => setSetup(e.target.value)}>
                    {names.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Play as</span>
                  <select value={color} onChange={(e) => setColor(e.target.value as 'random' | 'silver' | 'red')}>
                    <option value="random">Random</option>
                    <option value="silver">Teal (moves first)</option>
                    <option value="red">Red</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Time per move</span>
                <select value={perMove} onChange={(e) => setPerMove(Number(e.target.value))}>
                  <option value={0}>No timer</option>
                  <option value={1}>1 minute</option>
                  <option value={2}>2 minutes</option>
                  <option value={3}>3 minutes</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                </select>
              </label>
              <button className="btn primary big" onClick={create}>
                Create game &amp; get share link
              </button>
            </div>

            <div className="or">
              <span>or join a game</span>
            </div>

            <div className={`join-box${invited ? ' highlight' : ''}`}>
              <input
                type="text"
                maxLength={5}
                placeholder="CODE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && join()}
              />
              <button className="btn" onClick={join}>
                Join
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="foot">
        Teal moves first · <a href="/admin" className="foot-link">Edit starting configurations →</a>
      </div>
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
    </section>
  );
}
