'use client';
import { useEffect, useState } from 'react';
import type { GameController, PlayerView, ViewState } from '@/client/controller';
import type { Color } from '@/game/types';
import { opposite } from '@/game/engine';
import { colorName } from '@/lib/labels';
import Board from './Board';
import LogoMark, { PersonIcon } from './LogoMark';

export default function GamePlay({ controller, view }: { controller: GameController; view: ViewState }) {
  const { myColor, spectator, turn, winner } = view;
  const yours = !spectator && turn === myColor && !winner;

  const turnText = winner ? `${colorName(winner)} wins` : yours ? 'Your move' : `${colorName(turn)} to move`;
  const turnClass = `turn ${winner ?? turn}${yours ? ' you' : ''}`;
  const reviewing = view.reviewIndex != null;

  // Board renders with my colour at the bottom (spectators see teal at bottom).
  const bottomColor: Color = myColor ?? 'silver';
  const topColor = opposite(bottomColor);
  // Opponent was here but dropped mid-game — show a reconnect notice.
  const oppOffline =
    !spectator && view.bothSeated && !winner && view.players[topColor].seated && !view.players[topColor].online;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(view.shareLink);
      controller.toast('Link copied — send it to a friend!');
    } catch {
      controller.toast('Copy failed — select and copy the link');
    }
  };
  const leave = () => {
    window.location.href = window.location.pathname;
  };

  return (
    <section id="game" className={`screen turn-${winner ?? turn}`}>
      <header className="topbar">
        <div className="brand-row">
          <LogoMark size={24} />
          <span className="brand">Laser Chess</span>
        </div>
        <div className={turnClass}>{view.connected ? turnText : 'Connecting…'}</div>
        {view.perMoveMs > 0 && view.turnEndsAt != null && !winner && <MoveTimer endsAt={view.turnEndsAt} />}
        <div className="right">
          <span className={`badge ${spectator ? 'spec' : myColor ?? 'spec'}`}>
            {spectator ? 'Spectating' : `You: ${colorName(myColor as Color)}`}
          </span>
          <span className={`conn ${view.connected ? 'ok' : 'bad'}`} title="connection" />
          <button className="btn tiny" onClick={leave}>
            Leave
          </button>
        </div>
      </header>

      <main className="play">
        <div className="board-area">
          <SeatLabel color={topColor} info={view.players[topColor]} active={turn === topColor && !winner} you={false} />
          {view.waiting && (
            <div className="waiting">
              <b>Waiting for an opponent…</b> Share your link to invite someone.
            </div>
          )}
          {!winner && view.forfeitOf && view.forfeitEndsAt != null ? (
            <ForfeitBanner
              label={spectator ? colorName(view.forfeitOf) : view.forfeitOf === myColor ? 'You' : 'Your opponent'}
              endsAt={view.forfeitEndsAt}
            />
          ) : oppOffline ? (
            <div className="waiting disconnected">
              <b>Opponent disconnected</b> — waiting to reconnect…
            </div>
          ) : null}
          {reviewing && (
            <div className="review-banner">
              🔍 {view.reviewLabel}
              <button className="linkbtn" onClick={() => controller.reviewLive()}>
                Back to live
              </button>
            </div>
          )}
          <Board controller={controller} />
          <SeatLabel color={bottomColor} info={view.players[bottomColor]} active={turn === bottomColor && !winner} you={!spectator} />
        </div>

        <aside className="side">
          {!spectator && !view.bothSeated && (
            <div className="panel share">
              <div className="panel-title">Invite a friend</div>
              <div className="share-row">
                <input readOnly value={view.shareLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button className="btn" onClick={copyLink}>
                  Copy
                </button>
              </div>
              <div className="code-line">
                Room code: <b>{view.roomCode ?? '—'}</b>
              </div>
            </div>
          )}

          {view.moves > 0 && (
            <div className="panel review-panel">
              <div className="panel-title">Moves · {view.moves}</div>
              <div className="review-row">
                <button className="btn nav" onClick={() => controller.reviewPrev()} title="previous move">
                  ◀
                </button>
                <span className="review-label">{view.reviewLabel ?? 'Live'}</span>
                <button className="btn nav" onClick={() => controller.reviewNext()} disabled={!reviewing} title="next move">
                  ▶
                </button>
              </div>
              {reviewing && (
                <button className="btn tiny live-btn" onClick={() => controller.reviewLive()}>
                  ● Back to live
                </button>
              )}
            </div>
          )}

          <div className="panel legend">
            <div className="panel-title">Pieces</div>
            <ul>
              <li>
                <span className="chip" style={{ background: '#f5b73f' }} />
                <span>
                  <b>Pharaoh</b> — protect it at all costs.
                </span>
              </li>
              <li>
                <span className="chip" style={{ background: '#ef5a40' }} />
                <span>
                  <b>Pyramid</b> — single mirror, deflects 90°.
                </span>
              </li>
              <li>
                <span className="chip" style={{ background: '#2fb0ab' }} />
                <span>
                  <b>Scarab</b> — double mirror, indestructible; can swap.
                </span>
              </li>
              <li>
                <span className="chip" style={{ background: '#23262e' }} />
                <span>
                  <b>Anubis</b> — shielded front, vulnerable behind.
                </span>
              </li>
              <li>
                <span className="chip" style={{ background: '#8b8471' }} />
                <span>
                  <b>Sphinx</b> — your laser; rotate only.
                </span>
              </li>
            </ul>
            <p className="hint">Tap a piece → tap a dot to move, or the ↻ handles to rotate.</p>
          </div>
        </aside>
      </main>

      {winner && <WinOverlay controller={controller} view={view} />}
    </section>
  );
}

function MoveTimer({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, endsAt - now);
  const total = Math.ceil(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return (
    <span className={`clock${ms <= 10000 ? ' low' : ''}`}>
      ⏱ {mm}:{String(ss).padStart(2, '0')}
    </span>
  );
}

function ForfeitBanner({ label, endsAt }: { label: string; endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <div className="waiting disconnected">
      <b>{label} disconnected.</b> Forfeit in {secs}s unless they reconnect…
    </div>
  );
}

function SeatLabel({ color, info, active, you }: { color: Color; info: PlayerView; active: boolean; you: boolean }) {
  const name = info.seated ? info.name || colorName(color) : 'Waiting…';
  return (
    <div className={`seat-label${active ? ' turn-on' : ''}`}>
      <span className={`avatar ${color}`}>
        <PersonIcon size={14} />
      </span>
      <span className="nm">{name}</span>
      {you && <span className="tag">(you)</span>}
      {info.seated && <span className="conn" style={{ background: info.online ? '#37b26a' : '#c9bfa8' }} />}
    </div>
  );
}

function WinOverlay({ controller, view }: { controller: GameController; view: ViewState }) {
  const { winner, spectator, myColor, overReason } = view;
  const won = !spectator && winner === myColor;
  const byTimeout = overReason === 'timeout';
  const byForfeit = overReason === 'forfeit';
  const loser = colorName(opposite(winner!));
  const emoji = spectator ? '🎉' : won ? '🏆' : '💥';
  const title = spectator ? `${colorName(winner!)} wins!` : won ? 'Victory!' : 'Defeat';
  const sub = spectator
    ? byTimeout
      ? `${loser} ran out of time.`
      : byForfeit
        ? `${loser} disconnected.`
        : 'The game is over.'
    : won
      ? byTimeout
        ? 'Your opponent ran out of time.'
        : byForfeit
          ? 'Your opponent left the game.'
          : 'You struck the enemy Pharaoh.'
      : byTimeout
        ? 'You ran out of time.'
        : byForfeit
          ? 'You were disconnected too long.'
          : 'Your Pharaoh was hit.';
  return (
    <div className="overlay">
      <div className="ov-card">
        <div className="ov-emoji">{emoji}</div>
        <div className={`ov-title ${winner}`}>{title}</div>
        <div className="ov-sub">{sub}</div>
        <div className="ov-actions">
          {!spectator && (
            <button className="btn primary" onClick={() => controller.rematch()}>
              Rematch (swap sides)
            </button>
          )}
          <button className="btn" onClick={() => (window.location.href = window.location.pathname)}>
            New game
          </button>
        </div>
      </div>
    </div>
  );
}
