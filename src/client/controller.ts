// Framework-agnostic game controller. Owns the WebSocket, the canvas Renderer,
// and the move-animation queue. Exposes an immutable view snapshot so React can
// subscribe with useSyncExternalStore while the imperative renderer stays smooth.
import { applyMoveOnly, legalActionsFor, opposite } from '@/game/engine';
import type { Action, Board, Color, Hit, LaserPoint, RotateAction } from '@/game/types';
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
  rematchMine: boolean; // I've requested a rematch
  rematchOpp: boolean; // my opponent has requested a rematch
  players: { red: PlayerView; silver: PlayerView };
  perMoveMs: number;
  turnEndsAt: number | null; // client epoch ms when the current turn's clock expires
  forfeitOf: Color | null; // a disconnected player about to forfeit
  forfeitEndsAt: number | null; // client epoch ms when that forfeit fires
  moves: number; // number of moves played
  reviewIndex: number | null; // null = live; otherwise index into move history
  reviewLabel: string | null;
  selection: { x: number; y: number } | null; // the piece the player has selected
  rotations: { spin: 1 | -1 }[]; // rotation options for the selected piece (Action Panel)
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
  rematchMine: false,
  rematchOpp: false,
  players: { red: blank(), silver: blank() },
  perMoveMs: 0,
  turnEndsAt: null,
  forfeitOf: null,
  forfeitEndsAt: null,
  moves: 0,
  reviewIndex: null,
  reviewLabel: null,
  selection: null,
  rotations: [],
  toast: null,
};
function blank(): PlayerView {
  return { name: null, seated: false, online: false };
}

interface HistoryEntry {
  board: Board; // resolved position AFTER this move
  action: Action | null; // the move that produced this position (null for the start)
  by: Color | null;
  removed: Hit | null;
  laser: LaserPoint[] | null; // laser path fired by this move (for replay)
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
  private selectedRotations: { spin: 1 | -1; action: RotateAction }[] = [];
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
  private reviewSeq = 0; // bumped on each navigation to cancel superseded replays
  private onPointerBound = (e: PointerEvent) => this.onPointer(e);

  constructor() {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const g = (params.get('game') || '').toUpperCase();
      if (g) {
        this.roomCode = g;
        this.joinIntent = { code: g, setup: 'Classic', color: 'random', perMove: 0 };
        this.screenGame = true;
        this.snapshot = { ...INITIAL, screen: 'game', roomCode: g };
      }
    }
  }

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
      rematchMine: this.myColor ? !!this.lastState?.rematch?.[this.myColor] : false,
      rematchOpp: this.myColor ? !!this.lastState?.rematch?.[opposite(this.myColor)] : false,
      players,
      perMoveMs: this.perMoveMs,
      turnEndsAt: this.turnEndsAt,
      forfeitOf: this.forfeitOf,
      forfeitEndsAt: this.forfeitEndsAt,
      moves: Math.max(0, this.history.length - 1),
      reviewIndex: this.reviewIndex,
      reviewLabel: this.reviewLabelFor(),
      selection: this.selected,
      rotations: this.selected ? this.selectedRotations.map((r) => ({ spin: r.spin })) : [],
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
      const codeToJoin = this.roomCode || this.joinIntent?.code;
      this.send({
        type: 'join',
        playerId: this.playerId,
        name: this.playerName,
        code: codeToJoin,
        setup: this.joinIntent!.setup,
        color: this.joinIntent!.color,
        perMove: this.joinIntent!.perMove,
      });
    });
    this.net.on('message', (m) => this.onMessage(m));
    this.net.on('close', () => this.setConnected(false));
    this.net.connect();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.snapshot.connected || !this.net.isConnected()) {
            this.net.connect();
          }
        }
      });
    }
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
        if (this.joinIntent) {
          this.joinIntent.code = msg.code;
        } else {
          this.joinIntent = { code: msg.code, setup: this.setup, color: msg.you || 'random', perMove: 0 };
        }
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
        if (this.history.length === 0) this.history = [{ board: msg.board, action: null, by: null, removed: null, laser: null }];
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
        this.history.push({ board: msg.board, action: msg.action, by: msg.by, removed: msg.removed, laser: msg.laser });
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
      case 'rematch-declined':
        if (msg.by !== this.myColor) {
          const who = this.lastState?.names?.[msg.by] ?? colorName(msg.by);
          this.toast(`${who} declined the rematch`);
        }
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
  // Steps through EVERY move from both players (indices 0..N, N = latest) and
  // replays that move's piece + laser animation. Index 0 is the start position.
  reviewPrev() {
    if (this.busy || this.history.length <= 1) return; // don't interrupt a live move
    const last = this.history.length - 1;
    // from live, the first ◀ replays the most recent move (the one you likely missed)
    const target = this.reviewIndex == null ? last : Math.max(0, this.reviewIndex - 1);
    this.enterReview(target);
  }
  reviewNext() {
    if (this.busy || this.reviewIndex == null) return;
    const last = this.history.length - 1;
    const target = this.reviewIndex + 1;
    if (target > last) this.reviewLive();
    else this.enterReview(target);
  }
  reviewLive() {
    this.reviewIndex = null;
    this.reviewSeq++; // cancel any in-flight replay
    this.renderer?.cancelAnimations();
    this.renderer?.setReviewMark(null);
    this.renderDisplayed();
    this.emit();
  }
  private enterReview(idx: number) {
    this.reviewIndex = idx;
    this.selected = null;
    this.renderer?.clearSelection();
    this.emit();
    void this.playHistoryMove(idx);
  }

  private pause(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  // Replay move `idx` by animating from the previous position (piece slide/rotate,
  // then the laser fired on that turn, then the capture).
  private async playHistoryMove(idx: number) {
    const r = this.renderer;
    const seq = ++this.reviewSeq;
    if (!r) return;
    r.cancelAnimations();
    const h = this.history[idx];
    if (!h) return;
    const prevEntry = this.history[idx - 1];
    // start position (or missing data) → just show it, no animation
    if (idx === 0 || !h.action || !prevEntry) {
      r.setBoard(h.board, { flip: this.myColor === 'red' });
      r.setReviewMark(null);
      return;
    }
    const prev = prevEntry.board;
    r.setBoard(prev, { flip: this.myColor === 'red' }); // rewind to before the move
    r.setReviewMark(null);
    // hold on the old position for a beat so the move reads clearly, then slide slowly
    await this.pause(250);
    if (seq !== this.reviewSeq) return;
    await r.animatePieceAction(h.action, prev, applyMoveOnly(prev, h.action), 550);
    if (seq !== this.reviewSeq) return; // a newer navigation took over
    if (h.laser && h.laser.length && h.by) {
      await r.animateLaser(h.laser, h.by, () => {
        if (h.removed) void r.explode(h.removed.x, h.removed.y, h.removed.piece.color);
        r.setBoardQuiet(h.board);
      });
      if (seq !== this.reviewSeq) return;
    }
    r.setBoardQuiet(h.board);
    r.setReviewMark(h.action);
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
      const actions = legalActionsFor(this.board, this.myColor, pick.x, pick.y);
      r.select(this.selected, actions);
      // Rotation moves off the board into the Action Panel: normalize each rotate
      // action to a spin direction (sphinx rotates carry `orient` instead of `spin`).
      this.selectedRotations = actions
        .filter((a): a is RotateAction => a.type === 'rotate')
        .map((a) => ({ spin: (a.spin ?? ((a.orient - cell.orient + 4) % 4 === 1 ? 1 : -1)) as 1 | -1, action: a }));
      this.emit();
    } else {
      this.deselect();
      if (cell && cell.color === this.myColor && this.turn !== this.myColor) this.toast('Not your turn');
    }
  }
  private deselect() {
    this.selected = null;
    this.selectedRotations = [];
    this.renderer?.clearSelection();
    this.emit();
  }

  // Rotate the selected piece from the Action Panel (keeps the piece highlighted
  // until the rotation is committed). No-op if the rotation isn't currently legal.
  rotateSelected(spin: 1 | -1) {
    if (!this.renderer || !this.board || this.reviewIndex != null) return;
    if (this.busy || this.spectator || this.winner || this.turn !== this.myColor) return;
    const rot = this.selectedRotations.find((r) => r.spin === spin);
    if (!rot) return;
    this.send({ type: 'action', action: rot.action });
    this.deselect();
  }

  // ---- actions from UI ------------------------------------------------------
  rematch() {
    this.send({ type: 'rematch', setup: this.lastState?.setup });
  }
  declineRematch() {
    this.send({ type: 'rematch-decline' });
  }
}
