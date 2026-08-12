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
  playerId: string | null;
  lobby: CoupLobbyView | null;
  state: ClientCoupState | null;
  responseDeadline: number | null;
  error: string | null;
}

const INITIAL_VIEW: CoupView = {
  screen: 'lobby',
  code: null,
  playerId: null,
  lobby: null,
  state: null,
  responseDeadline: null,
  error: null,
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

  constructor() {
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

  start(opts: { code?: string; name?: string } = {}) {
    this.ensureIdentity();
    this.net.connect();
    const storedName = typeof window !== 'undefined' ? localStorage.getItem('coup:name') : null;
    const name = opts.name || storedName || 'Player';
    this.send({ type: 'join', playerId: this.playerId, name, code: opts.code });
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
      case 'joined':
        this.setView({ screen: 'in-lobby', code: msg.code, playerId: msg.playerId, error: null });
        break;
      case 'lobby':
        this.setView({ lobby: { code: msg.code, seats: msg.seats, maxSeats: msg.maxSeats, canStart: msg.canStart } });
        break;
      case 'state':
        this.setView({ screen: 'game', state: msg.state, responseDeadline: msg.responseDeadline, error: null });
        break;
      case 'error':
        this.setView({ error: msg.message });
        break;
      case 'forfeit':
      case 'rematch-votes':
      case 'rematch':
        break; // no dedicated view slot yet — state broadcasts cover the resulting game state
    }
  }
}
