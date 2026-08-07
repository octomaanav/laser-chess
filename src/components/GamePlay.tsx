'use client';
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

  // Board renders with my colour at the bottom (spectators see silver at bottom).
  const bottomColor: Color = myColor ?? 'silver';
  const topColor = opposite(bottomColor);

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
    <section id="game" className="screen">
      <header className="topbar">
        <div className="brand-row">
          <LogoMark size={24} />
          <span className="brand">Laser Chess</span>
        </div>
        <div className={turnClass}>{view.connected ? turnText : 'Connecting…'}</div>
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
          <Board controller={controller} />
          <SeatLabel color={bottomColor} info={view.players[bottomColor]} active={turn === bottomColor && !winner} you={!spectator} />
        </div>

        <aside className="side">
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

function SeatLabel({ color, info, active, you }: { color: Color; info: PlayerView; active: boolean; you: boolean }) {
  const name = info.seated ? info.name || colorName(color) : 'Waiting…';
  return (
    <div className={`seat-label${active ? ' turn-on' : ''}`}>
      <span className={`avatar ${color}`}>
        <PersonIcon size={14} />
      </span>
      <span className="nm">{name}</span>
      {you && <span className="tag">(you)</span>}
      {info.seated && <span className="conn" data-on={info.online} style={{ background: info.online ? '#37b26a' : '#c9bfa8' }} />}
    </div>
  );
}

function WinOverlay({ controller, view }: { controller: GameController; view: ViewState }) {
  const { winner, spectator, myColor } = view;
  const won = !spectator && winner === myColor;
  const emoji = spectator ? '🎉' : won ? '🏆' : '💥';
  const title = spectator ? `${colorName(winner!)} wins!` : won ? 'Victory!' : 'Defeat';
  const sub = spectator ? 'The game is over.' : won ? 'You struck the enemy Pharaoh.' : 'Your Pharaoh was hit.';
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
