// Framework-agnostic game controller. Owns the WebSocket, the canvas Renderer,
// and the move-animation queue. Exposes an immutable view snapshot so React can
// subscribe with useSyncExternalStore while the imperative renderer stays smooth.
import { applyMoveOnly, legalActionsFor } from '@/game/engine';
import type { Board, Color } from '@/game/types';
import type { ClientMessage, ServerMessage } from '@/game/messages';
import { Net } from '@/lib/net';
import { Renderer } from '@/lib/render';

export interface PlayerView {
  name: string | null;
  seated: boolean;
  online: boolean;
}
export interface ViewState {
  screen: 'lobby' | 'game';
  connected: boolean;
  roomCode: string | null;
  shareLink: string;
  setup: string;
  myColor: Color | null;
  spectator: boolean;
  turn: Color;
  winner: Color | null;
  waiting: boolean;
  players: { red: PlayerView; silver: PlayerView };
  toast: { id: number; text: string } | null;
}

const INITIAL: ViewState = {
  screen: 'lobby',
  connected: false,
  roomCode: null,
  shareLink: '',
  setup: 'Classic',
  myColor: null,
  spectator: false,
  turn: 'silver',
  winner: null,
  waiting: false,
  players: { red: blank(), silver: blank() },
  toast: null,
};
function blank(): PlayerView {
  return { name: null, seated: false, online: false };
}

export class GameController {
  private net = new Net<ServerMessage>();
  private renderer: Renderer | null = null;
  private listeners = new Set<() => void>();
  private snapshot: ViewState = INITIAL;

  private playerId = '';
  private playerName = 'Player';
  private myColor: Color | null = null;
  private spectator = false;
  private turn: Color = 'silver';
  private winner: Color | null = null;
  private roomCode: string | null = null;
  private setup = 'Classic';
  private lastState: Extract<ServerMessage, { type: 'state' }> | null = null;
  private board: Board | null = null;
  private selected: { x: number; y: number } | null = null;
  private busy = false;
  private moveQueue: Extract<ServerMessage, { type: 'move' }>[] = [];
  private joinIntent: { code?: string; setup: string; color: Color | 'random' } | null = null;
  private started = false;
  private toastId = 0;
  private onPointerBound = (e: PointerEvent) => this.onPointer(e);

  // ---- external store API ---------------------------------------------------
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = (): ViewState => this.snapshot;
  getServerSnapshot = (): ViewState => INITIAL;

  private emit() {
    const players = {
      red: this.playerView('red'),
      silver: this.playerView('silver'),
    };
    const seated = this.lastState?.seated;
    const waiting = !this.spectator && this.screenIsGame() && !!seated && (!seated.red || !seated.silver);
    this.snapshot = {
      screen: this.screenIsGame() ? 'game' : 'lobby',
      connected: this.snapshot.connected,
      roomCode: this.roomCode,
      shareLink: this.roomCode && typeof window !== 'undefined' ? `${window.location.origin}/?game=${this.roomCode}` : '',
      setup: this.lastState?.setup || this.setup,
      myColor: this.myColor,
      spectator: this.spectator,
      turn: this.turn,
      winner: this.winner,
      waiting,
      players,
      toast: this.snapshot.toast,
    };
    for (const cb of this.listeners) cb();
  }

  private screenGame = false;
  private screenIsGame() {
    return this.screenGame;
  }

  private playerView(color: Color): PlayerView {
    const s = this.lastState;
    return {
      name: s?.names?.[color] ?? null,
      seated: !!s?.seated?.[color],
      online: !!s?.online?.[color],
    };
  }

  private setConnected(v: boolean) {
    this.snapshot = { ...this.snapshot, connected: v };
    for (const cb of this.listeners) cb();
  }

  toast(text: string) {
    this.snapshot = { ...this.snapshot, toast: { id: ++this.toastId, text } };
    for (const cb of this.listeners) cb();
  }

  // ---- lifecycle ------------------------------------------------------------
  setName(name: string) {
    this.playerName = (name.trim() || 'Player').slice(0, 24);
    if (typeof window !== 'undefined') window.localStorage.setItem('lc_name', this.playerName);
  }
  getStoredName(): string {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('lc_name') || '';
  }

  private ensureIdentity() {
    if (typeof window === 'undefined') return;
    let id = window.sessionStorage.getItem('lc_pid');
    if (!id) {
      id = 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem('lc_pid', id);
    }
    this.playerId = id;
    if (!this.playerName || this.playerName === 'Player') this.playerName = this.getStoredName() || 'Player';
  }

  start(opts: { code?: string; setup?: string; color?: Color | 'random' }) {
    if (this.started) return;
    this.started = true;
    this.ensureIdentity();
    this.joinIntent = { color: 'random', setup: 'Classic', ...opts };
    this.screenGame = true;
    this.emit();

    this.net.on('open', () => {
      this.setConnected(true);
      this.send({
        type: 'join',
        playerId: this.playerId,
        name: this.playerName,
        code: this.joinIntent!.code,
        setup: this.joinIntent!.setup,
        color: this.joinIntent!.color,
      });
    });
    this.net.on('message', (m) => this.onMessage(m));
    this.net.on('close', () => this.setConnected(false));
    this.net.connect();
  }

  private send(m: ClientMessage) {
    this.net.send(m);
  }

  attach(root: HTMLElement): () => void {
    const renderer = new Renderer(root);
    this.renderer = renderer;
    const ro = new ResizeObserver(() => renderer.resize());
    ro.observe(root);
    renderer.resize();
    if (this.board) renderer.setBoard(this.board, { flip: this.myColor === 'red' });
    renderer.fxCanvas.addEventListener('pointerdown', this.onPointerBound);

    return () => {
      ro.disconnect();
      renderer.fxCanvas.removeEventListener('pointerdown', this.onPointerBound);
      renderer.destroy();
      if (this.renderer === renderer) this.renderer = null;
    };
  }

  // ---- message handling -----------------------------------------------------
  private onMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'joined':
        this.roomCode = msg.code;
        this.myColor = msg.you;
        this.spectator = msg.spectator;
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `${window.location.pathname}?game=${msg.code}`);
        }
        this.applyPerspective();
        this.emit();
        break;
      case 'state':
        this.lastState = msg;
        if (!this.busy) {
          this.turn = msg.turn;
          this.winner = msg.winner;
          this.board = msg.board;
          this.renderer?.setBoard(msg.board, { flip: this.myColor === 'red' });
        }
        this.emit();
        break;
      case 'move':
        this.moveQueue.push(msg);
        void this.runQueue();
        break;
      case 'rematch':
        this.winner = null;
        this.selected = null;
        this.renderer?.clearSelection();
        this.emit();
        break;
      case 'reseat':
        this.myColor = msg.you;
        this.spectator = !msg.you;
        this.applyPerspective();
        this.emit();
        break;
      case 'error':
        this.toast(msg.message);
        break;
      case 'chat':
        break;
    }
  }

  private applyPerspective() {
    if (this.renderer && this.board) this.renderer.setBoard(this.board, { flip: this.myColor === 'red' });
  }

  private async runQueue(): Promise<void> {
    if (this.busy) return;
    const msg = this.moveQueue.shift();
    if (!msg) return;
    this.busy = true;
    this.selected = null;
    this.renderer?.clearSelection();
    await this.processMove(msg);
    this.busy = false;
    void this.runQueue();
  }

  private async processMove(msg: Extract<ServerMessage, { type: 'move' }>) {
    const r = this.renderer;
    if (r && this.board) {
      const start = this.board;
      const pre = applyMoveOnly(start, msg.action);
      await r.animatePieceAction(msg.action, start, pre);
      await r.animateLaser(msg.laser, msg.by, () => {
        if (msg.removed) void r.explode(msg.removed.x, msg.removed.y, msg.removed.piece.color);
        r.setBoardQuiet(msg.board);
      });
      r.setBoardQuiet(msg.board);
    }
    this.board = msg.board;
    this.turn = msg.turn;
    this.winner = msg.winner;
    this.emit();
  }

  // ---- input ----------------------------------------------------------------
  private onPointer(e: PointerEvent) {
    const r = this.renderer;
    if (!r || !this.board) return;
    if (this.busy || this.spectator || this.winner) return;
    const pick = r.pick(e.clientX, e.clientY);
    if (!pick) return this.deselect();
    if (pick.kind === 'action') {
      this.send({ type: 'action', action: pick.action });
      return this.deselect();
    }
    const cell = this.board[pick.y][pick.x];
    if (this.selected && this.selected.x === pick.x && this.selected.y === pick.y) return this.deselect();
    if (cell && cell.color === this.myColor && this.turn === this.myColor) {
      this.selected = { x: pick.x, y: pick.y };
      r.select(this.selected, legalActionsFor(this.board, this.myColor, pick.x, pick.y));
    } else {
      this.deselect();
      if (cell && cell.color === this.myColor && this.turn !== this.myColor) this.toast('Not your turn');
    }
  }
  private deselect() {
    this.selected = null;
    this.renderer?.clearSelection();
  }

  // ---- actions from UI ------------------------------------------------------
  rematch() {
    this.send({ type: 'rematch', setup: this.lastState?.setup });
  }
}
