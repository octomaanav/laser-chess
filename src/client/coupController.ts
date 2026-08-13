import { Net } from '@/lib/net';
import type { ActionType, BlockCharacter, Character } from '@/game/coup/types';
import type { ClientMessage, ServerMessage } from '@/game/coup/messages';
import type { ClientCoupState } from '@/game/coup/redact';

export interface CoupLobbyView {
  code: string;
  seats: { id: string; name: string; connected: boolean }[];
  maxSeats: number;
  canStart: boolean;
}

export interface CoupView {
  screen: 'lobby' | 'in-lobby' | 'game';
  code: string | null;
  shareUrl: string | null; // shareable "?game=CODE" link, once a room exists
  playerId: string | null;
  lobby: CoupLobbyView | null;
  state: ClientCoupState | null;
  responseDeadline: number | null;
  error: string | null;
  rematchVotes: string[]; // player ids who've clicked "Rematch" so far
}

const INITIAL_VIEW: CoupView = {
  screen: 'lobby',
  code: null,
  shareUrl: null,
  playerId: null,
  lobby: null,
  state: null,
  responseDeadline: null,
  error: null,
  rematchVotes: [],
};

function loadOrCreatePlayerId(): string {
  const key = 'coup:playerId';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export class CoupController {
  private net = new Net<ServerMessage>('/ws/coup');
  private view: CoupView = INITIAL_VIEW;
  private listeners = new Set<() => void>();
  private playerId = '';
  // The last join we intended to make — re-sent from `net.on('open', ...)`
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

  // useSyncExternalStore-compatible store API. On the server (`typeof window ===
  // 'undefined'`) the controller never touches localStorage/WebSocket and only
  // ever produces INITIAL_VIEW via getServerSnapshot.
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = (): CoupView => this.view;
  getServerSnapshot = (): CoupView => INITIAL_VIEW;

  private setView(patch: Partial<CoupView>) {
    this.view = { ...this.view, ...patch };
    for (const cb of this.listeners) cb();
  }

  private ensureIdentity() {
    if (typeof window === 'undefined') return;
    if (!this.playerId) this.playerId = loadOrCreatePlayerId();
  }

  // Have we been seated in this room before (from this browser)? Used to decide
  // whether to auto-rejoin on returning to a /?game=CODE link, vs. showing the
  // pre-join screen so a brand-new visitor from a shared link can set their name.
  wasInRoom(code: string): boolean {
    if (typeof window === 'undefined' || !code) return false;
    return window.localStorage.getItem('coup_room_' + code.toUpperCase()) != null;
  }
  private rememberRoom(code: string) {
    if (typeof window !== 'undefined') window.localStorage.setItem('coup_room_' + code.toUpperCase(), '1');
  }

  start(opts: { code?: string; name?: string } = {}) {
    this.ensureIdentity();
    const storedName = typeof window !== 'undefined' ? localStorage.getItem('coup:name') : null;
    const name = opts.name || storedName || 'Player';
    this.joinIntent = { code: opts.code, name };
    if (this.net.isConnected()) {
      // Already open (e.g. a second join attempt) — send immediately since
      // no further 'open' event will fire to trigger it.
      this.send({ type: 'join', playerId: this.playerId, name, code: opts.code });
    } else {
      this.net.connect();
    }
  }

  startGame() {
    this.send({ type: 'start' });
  }

  declareAction(action: ActionType, targetId: string | null = null) {
    this.send({ type: 'declare-action', action, targetId });
  }

  declareBlock(character: BlockCharacter) {
    this.send({ type: 'declare-block', character });
  }

  challenge() {
    this.send({ type: 'challenge' });
  }

  pass() {
    this.send({ type: 'pass' });
  }

  chooseReveal(cardIndex: 0 | 1) {
    this.send({ type: 'choose-reveal', cardIndex });
  }

  chooseExchange(keepIndices: number[]) {
    this.send({ type: 'choose-exchange', keepIndices });
  }

  chooseStartingCharacter(character: Character) {
    this.send({ type: 'choose-starting-character', character });
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
        if (this.joinIntent) this.joinIntent.code = msg.code; // pins reconnects to the same room
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
        this.setView({ screen: 'game', state: msg.state, responseDeadline: msg.responseDeadline, error: null });
        break;
      case 'error':
        this.setView({ error: msg.message });
        break;
      case 'rematch-votes':
        this.setView({ rematchVotes: msg.ids });
        break;
      case 'forfeit':
      case 'rematch':
        break; // no dedicated view slot yet — state broadcasts cover the resulting game state
    }
  }
}
