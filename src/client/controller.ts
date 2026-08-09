// Framework-agnostic game controller. Owns the WebSocket, the canvas Renderer,
// and the move-animation queue. Exposes an immutable view snapshot so React can
// subscribe with useSyncExternalStore while the imperative renderer stays smooth.
import { applyMoveOnly, legalActionsFor } from '@/game/engine';
import type { Action, Board, Color, Hit } from '@/game/types';
import type { ClientMessage, ServerMessage } from '@/game/messages';
import { colorName } from '@/lib/labels';
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
  overReason: 'pharaoh' | 'timeout' | 'forfeit' | null;
  waiting: boolean;
  bothSeated: boolean;
  players: { red: PlayerView; silver: PlayerView };
  perMoveMs: number;
  turnEndsAt: number | null; // client epoch ms when the current turn's clock expires
  forfeitOf: Color | null; // a disconnected player about to forfeit
  forfeitEndsAt: number | null; // client epoch ms when that forfeit fires
  moves: number; // number of moves played
  reviewIndex: number | null; // null = live; otherwise index into move history
  reviewLabel: string | null;
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
  overReason: null,
  waiting: false,
  bothSeated: false,
  players: { red: blank(), silver: blank() },
  perMoveMs: 0,
  turnEndsAt: null,
  forfeitOf: null,
  forfeitEndsAt: null,
  moves: 0,
  reviewIndex: null,
  reviewLabel: null,
  toast: null,
};
function blank(): PlayerView {
  return { name: null, seated: false, online: false };
}

interface HistoryEntry {
  board: Board;
  action: Action | null;
  by: Color | null;
  removed: Hit | null;
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
  private overReason: 'pharaoh' | 'timeout' | 'forfeit' | null = null;
  private roomCode: string | null = null;
  private setup = 'Classic';
  private lastState: Extract<ServerMessage, { type: 'state' }> | null = null;
  private board: Board | null = null;
  private selected: { x: number; y: number } | null = null;
  private busy = false;
  private moveQueue: Extract<ServerMessage, { type: 'move' }>[] = [];
  private joinIntent: { code?: string; setup: string; color: Color | 'random'; perMove: number } | null = null;
  private started = false;
  private toastId = 0;
  private perMoveMs = 0;
  private turnEndsAt: number | null = null;
  private forfeitOf: Color | null = null;
  private forfeitEndsAt: number | null = null;
  private history: HistoryEntry[] = [];
  private reviewIndex: number | null = null;
  private onPointerBound = (e: PointerEvent) => this.onPointer(e);

  // ---- external store API ---------------------------------------------------
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = (): ViewState => this.snapshot;
  getServerSnapshot = (): ViewState => INITIAL;

  private emit() {
    const players = { red: this.playerView('red'), silver: this.playerView('silver') };
    const seated = this.lastState?.seated;
    const both = !!seated?.red && !!seated?.silver;
    const waiting = !this.spectator && this.screenIsGame() && !!seated && !both;
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
      overReason: this.overReason,
      waiting,
      bothSeated: both,
      players,
      perMoveMs: this.perMoveMs,
      turnEndsAt: this.turnEndsAt,
      forfeitOf: this.forfeitOf,
      forfeitEndsAt: this.forfeitEndsAt,
      moves: Math.max(0, this.history.length - 1),
      reviewIndex: this.reviewIndex,
      reviewLabel: this.reviewLabelFor(),
      toast: this.snapshot.toast,
    };
    for (const cb of this.listeners) cb();
  }

  private reviewLabelFor(): string | null {
    if (this.reviewIndex == null) return null;
    if (this.reviewIndex === 0) return 'Starting position';
    const h = this.history[this.reviewIndex];
    if (!h || !h.action || !h.by) return `Move ${this.reviewIndex}`;
    const verb = h.action.type === 'move' ? 'moved' : 'rotated';
    const cap = colorName(h.by).slice(0, 1) + colorName(h.by).slice(1);
    return `Move ${this.reviewIndex}/${this.history.length - 1} · ${cap} ${verb}`;
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
    // Persistent (localStorage) so a closed/reopened tab keeps the same identity
    // and can reclaim its seat. Two players in one browser need separate profiles
    // (e.g. a normal + an incognito window) since they'd share this id.
    let id = window.localStorage.getItem('lc_pid');
    if (!id) {
      id = 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem('lc_pid', id);
    }
    this.playerId = id;
    if (!this.playerName || this.playerName === 'Player') this.playerName = this.getStoredName() || 'Player';
  }

  // Have we been seated in this room before (from this browser)? Used to decide
  // whether to auto-rejoin on returning to a /?game=CODE link.
  wasInRoom(code: string): boolean {
    if (typeof window === 'undefined' || !code) return false;
    return window.localStorage.getItem('lc_room_' + code.toUpperCase()) != null;
  }
  private rememberRoom(code: string, color: Color) {
    if (typeof window !== 'undefined') window.localStorage.setItem('lc_room_' + code.toUpperCase(), color);
  }

  start(opts: { code?: string; setup?: string; color?: Color | 'random'; perMove?: number }) {
    if (this.started) return;
    this.started = true;
    this.ensureIdentity();
    this.joinIntent = { color: 'random', setup: 'Classic', perMove: 0, ...opts };
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
        perMove: this.joinIntent!.perMove,
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
    renderer.flip = this.myColor === 'red';
    const ro = new ResizeObserver(() => renderer.resize());
    ro.observe(root);
    renderer.resize();
    this.renderDisplayed();
    renderer.fxCanvas.addEventListener('pointerdown', this.onPointerBound);

    return () => {
      ro.disconnect();
      renderer.fxCanvas.removeEventListener('pointerdown', this.onPointerBound);
      renderer.destroy();
      if (this.renderer === renderer) this.renderer = null;
    };
  }

  // Render whatever should currently be shown (a reviewed position, or live).
  private renderDisplayed() {
    const r = this.renderer;
    if (!r) return;
    if (this.reviewIndex != null && this.history[this.reviewIndex]) {
      const h = this.history[this.reviewIndex];
      r.setBoard(h.board, { flip: this.myColor === 'red' });
      r.setReviewMark(this.reviewIndex > 0 ? h.action : null);
    } else if (this.board) {
      r.setBoard(this.board, { flip: this.myColor === 'red' });
      r.setReviewMark(null);
    }
  }

  // ---- message handling -----------------------------------------------------
  private onMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'joined':
        this.roomCode = msg.code;
        this.myColor = msg.you;
        this.spectator = !!msg.spectator;
        if (msg.you) this.rememberRoom(msg.code, msg.you); // enables seamless auto-rejoin later
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `${window.location.pathname}?game=${msg.code}`);
        }
        if (this.renderer) this.renderer.flip = this.myColor === 'red';
        this.renderDisplayed();
        this.emit();
        break;
      case 'state':
        this.lastState = msg;
        this.perMoveMs = msg.perMoveMs;
        this.turnEndsAt = msg.turnEndsIn != null ? Date.now() + msg.turnEndsIn : null;
        this.forfeitOf = msg.forfeitOf;
        this.forfeitEndsAt = msg.forfeitEndsIn != null ? Date.now() + msg.forfeitEndsIn : null;
        if (this.history.length === 0) this.history = [{ board: msg.board, action: null, by: null, removed: null }];
        if (!this.busy) {
          this.turn = msg.turn;
          this.winner = msg.winner;
          if (msg.winner && !this.overReason) this.overReason = 'pharaoh';
          this.board = msg.board;
          if (this.reviewIndex == null) this.renderDisplayed();
        }
        this.emit();
        break;
      case 'move':
        this.history.push({ board: msg.board, action: msg.action, by: msg.by, removed: msg.removed });
        this.perMoveMs = msg.perMoveMs;
        this.turnEndsAt = msg.winner ? null : msg.turnEndsIn != null ? Date.now() + msg.turnEndsIn : null;
        if (msg.winner) this.overReason = 'pharaoh';
        if (this.reviewIndex != null) {
          // reviewing history: apply silently, keep the reviewed board on screen
          this.board = msg.board;
          this.turn = msg.turn;
          this.winner = msg.winner;
          this.emit();
        } else {
          this.moveQueue.push(msg);
          void this.runQueue();
        }
        break;
      case 'timeout':
        this.winner = msg.winner;
        this.overReason = 'timeout';
        this.turnEndsAt = null;
        this.selected = null;
        this.renderer?.clearSelection();
        this.emit();
        break;
      case 'forfeit':
        this.winner = msg.winner;
        this.overReason = 'forfeit';
        this.turnEndsAt = null;
        this.selected = null;
        this.renderer?.clearSelection();
        this.emit();
        break;
      case 'rematch':
        this.winner = null;
        this.overReason = null;
        this.turnEndsAt = null;
        this.forfeitOf = null;
        this.forfeitEndsAt = null;
        this.selected = null;
        this.history = [];
        this.reviewIndex = null;
        this.renderer?.clearSelection();
        this.renderer?.setReviewMark(null);
        this.emit();
        break;
      case 'reseat':
        this.myColor = msg.you;
        this.spectator = !msg.you;
        if (this.renderer) this.renderer.flip = this.myColor === 'red';
        this.renderDisplayed();
        this.emit();
        break;
      case 'error':
        this.toast(msg.message);
        break;
      case 'chat':
        break;
    }
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
    if (r && this.board && this.reviewIndex == null) {
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

  // ---- move-history review (view-only; no undo) -----------------------------
  reviewPrev() {
    if (this.history.length <= 1) return;
    const from = this.reviewIndex == null ? this.history.length - 1 : this.reviewIndex;
    this.enterReview(Math.max(0, from - 1));
  }
  reviewNext() {
    if (this.reviewIndex == null) return;
    const next = this.reviewIndex + 1;
    if (next >= this.history.length - 1) this.reviewLive();
    else this.enterReview(next);
  }
  reviewLive() {
    this.reviewIndex = null;
    this.renderDisplayed();
    this.emit();
  }
  private enterReview(idx: number) {
    this.reviewIndex = idx;
    this.selected = null;
    this.renderer?.clearSelection();
    this.renderDisplayed();
    this.emit();
  }

  // ---- input ----------------------------------------------------------------
  private onPointer(e: PointerEvent) {
    const r = this.renderer;
    if (!r || !this.board) return;
    if (this.reviewIndex != null) {
      this.toast('Return to the live game to move');
      return;
    }
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
