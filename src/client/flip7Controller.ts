import { Net } from '@/lib/net';
import type { ClientMessage, ServerMessage } from '@/game/flip7/messages';
import type { ClientFlip7State } from '@/game/flip7/redact';

export interface Flip7LobbyView {
  code: string;
  seats: { id: string; name: string; connected: boolean }[];
  maxSeats: number;
  canStart: boolean;
}

export interface Flip7View {
  screen: 'lobby' | 'in-lobby' | 'game';
  code: string | null;
  shareUrl: string | null;
  playerId: string | null;
  lobby: Flip7LobbyView | null;
  state: ClientFlip7State | null;
  error: string | null;
  rematchVotes: string[];
}

const INITIAL_VIEW: Flip7View = {
  screen: 'lobby',
  code: null,
  shareUrl: null,
  playerId: null,
  lobby: null,
  state: null,
  error: null,
  rematchVotes: [],
};

function loadOrCreatePlayerId(): string {
  const key = 'flip7:playerId';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export class Flip7Controller {
  private net = new Net<ServerMessage>('/ws/flip7');
  private view: Flip7View = INITIAL_VIEW;
  private listeners = new Set<() => void>();
  private playerId = '';
  // The last join we intended to make - re-sent from `net.on('open', ...)`
  // rather than right after `connect()`, since `Net.send()` silently drops
  // messages while the socket is still CONNECTING. This also covers
  // reconnects: Net auto-reconnects on drop, and this makes sure `join` goes
  // out again every time the socket reopens, not just the first time.
  private joinIntent: { code?: string; name: string } | null = null;

  constructor() {
    this.net.on('open', () => {
      if (this.joinIntent) {
        this.send({ type: 'join', playerId: this.playerId, name: this.joinIntent.name, code: this.joinIntent.code });
      }
    });
    this.net.on('message', (msg) => this.handleMessage(msg));
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = (): Flip7View => this.view;
  getServerSnapshot = (): Flip7View => INITIAL_VIEW;

  private setView(patch: Partial<Flip7View>) {
    this.view = { ...this.view, ...patch };
    for (const cb of this.listeners) cb();
  }

  private ensureIdentity() {
    if (typeof window === 'undefined') return;
    if (!this.playerId) this.playerId = loadOrCreatePlayerId();
  }

  wasInRoom(code: string): boolean {
    if (typeof window === 'undefined' || !code) return false;
    return window.localStorage.getItem('flip7_room_' + code.toUpperCase()) != null;
  }
  private rememberRoom(code: string) {
    if (typeof window !== 'undefined') window.localStorage.setItem('flip7_room_' + code.toUpperCase(), '1');
  }

  start(opts: { code?: string; name?: string } = {}) {
    this.ensureIdentity();
    const storedName = typeof window !== 'undefined' ? localStorage.getItem('flip7:name') : null;
    const name = opts.name || storedName || 'Player';
    this.joinIntent = { code: opts.code, name };
    if (this.net.isConnected()) {
      this.send({ type: 'join', playerId: this.playerId, name, code: opts.code });
    } else {
      this.net.connect();
    }
  }

  startGame() {
    this.send({ type: 'start' });
  }

  hit() {
    this.send({ type: 'hit' });
  }

  stay() {
    this.send({ type: 'stay' });
  }

  chooseFreezeTarget(targetId: string) {
    this.send({ type: 'choose-freeze-target', targetId });
  }

  chooseFlipThreeTarget(targetId: string) {
    this.send({ type: 'choose-flip-three-target', targetId });
  }

  chooseSecondChanceRecipient(recipientId: string) {
    this.send({ type: 'choose-second-chance-recipient', recipientId });
  }

  startNextRound() {
    this.send({ type: 'start-next-round' });
  }

  rematch() {
    this.send({ type: 'rematch' });
  }

  private send(msg: ClientMessage) {
    this.net.send(msg);
  }

  private handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'joined': {
        if (this.joinIntent) this.joinIntent.code = msg.code;
        let shareUrl: string | null = null;
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `${window.location.pathname}?game=${msg.code}`);
          shareUrl = `${window.location.origin}${window.location.pathname}?game=${msg.code}`;
        }
        this.rememberRoom(msg.code);
        this.setView({ screen: 'in-lobby', code: msg.code, shareUrl, playerId: msg.playerId, error: null });
        break;
      }
      case 'lobby':
        this.setView({ lobby: { code: msg.code, seats: msg.seats, maxSeats: msg.maxSeats, canStart: msg.canStart } });
        break;
      case 'state':
        this.setView({ screen: 'game', state: msg.state, error: null });
        break;
      case 'error':
        this.setView({ error: msg.message });
        break;
      case 'rematch-votes':
        this.setView({ rematchVotes: msg.ids });
        break;
      case 'forfeit':
      case 'rematch':
        break; // no dedicated view slot yet - state broadcasts cover the resulting game state
    }
  }
}
