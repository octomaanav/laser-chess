// src/server/games/coup/roomServer.ts
// Authoritative WebSocket server for Coup rooms.
import { WebSocketServer, WebSocket } from 'ws';
import {
  chooseExchange,
  chooseReveal,
  chooseStartingCharacter,
  createGame,
  declareAction,
  declareBlock,
  declareChallenge,
  resolveWindow,
} from '../../../game/coup/engine';
import { redactStateFor } from '../../../game/coup/redact';
import type { CoupState, ActionType, BlockCharacter, Character } from '../../../game/coup/types';
import type { ClientMessage, ServerMessage } from '../../../game/coup/messages';
import { getStore } from '../../store';

interface Client extends WebSocket {
  playerId?: string;
  name?: string;
  room?: Room;
}

interface Room {
  code: string;
  seats: string[]; // player ids in seat order, filled as players join, max 6
  names: Map<string, string>;
  clients: Set<Client>;
  state: CoupState | null; // null until `start`
  responseTimer: ReturnType<typeof setTimeout> | null;
  responseDeadline: number | null;
  forfeitTimers: Map<string, ReturnType<typeof setTimeout>>;
  rematchVotes: Set<string>;
}

const MIN_SEATS = 2;
const MAX_SEATS = 6;
const RESPONSE_WINDOW_MS = 7000;
const DISCONNECT_FORFEIT_MS = Number(process.env.FORFEIT_MS) || 90_000;

const rooms = new Map<string, Room>();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
  } while (rooms.has(code));
  return code;
}

function makeRoom(code: string): Room {
  return {
    code,
    seats: [],
    names: new Map(),
    clients: new Set(),
    state: null,
    responseTimer: null,
    responseDeadline: null,
    forfeitTimers: new Map(),
    rematchVotes: new Set(),
  };
}

function send(ws: Client, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastLobby(room: Room) {
  const seats = room.seats.map((id) => ({ id, name: room.names.get(id) ?? '?', connected: isConnected(room, id) }));
  for (const c of room.clients) {
    send(c, { type: 'lobby', code: room.code, seats, maxSeats: MAX_SEATS, canStart: room.seats.length >= MIN_SEATS });
  }
}

function isConnected(room: Room, playerId: string): boolean {
  for (const c of room.clients) if (c.playerId === playerId) return true;
  return false;
}

function broadcastState(room: Room) {
  if (!room.state) return;
  persist(room);
  for (const c of room.clients) {
    if (!c.playerId) continue;
    send(c, { type: 'state', state: redactStateFor(room.state, c.playerId), responseDeadline: room.responseDeadline });
  }
}

function persist(room: Room) {
  if (!room.state) return;
  void getStore().saveCoupRoom({
    code: room.code,
    state: room.state,
    seats: room.seats,
    names: Object.fromEntries(room.names),
    responseDeadline: room.responseDeadline,
    forfeitPlayerId: null,
    forfeitDeadline: null,
  });
}

export function createCoupWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: Client) => {
    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      try {
        handleMessage(ws, msg);
      } catch (e) {
        send(ws, { type: 'error', message: e instanceof Error ? e.message : 'unknown error' });
      }
    });

    ws.on('close', () => handleDisconnect(ws));
  });

  return wss;
}

function handleMessage(ws: Client, msg: ClientMessage) {
  if (msg.type === 'join') {
    handleJoin(ws, msg.playerId, msg.name, msg.code);
    return;
  }
  const room = ws.room;
  if (!room || !ws.playerId) throw new Error('not in a room');

  switch (msg.type) {
    case 'start':
      return handleStart(room);
    case 'declare-action':
      return handleDeclareAction(room, ws.playerId, msg.action, msg.targetId);
    case 'declare-block':
      return handleDeclareBlock(room, ws.playerId, msg.character);
    case 'challenge':
      return handleChallenge(room, ws.playerId);
    case 'pass':
      return handlePass(room, ws.playerId);
    case 'choose-reveal':
      return handleChooseReveal(room, ws.playerId, msg.cardIndex);
    case 'choose-exchange':
      return handleChooseExchange(room, ws.playerId, msg.keepIndices);
    case 'choose-starting-character':
      return handleChooseStartingCharacter(room, ws.playerId, msg.character);
    case 'rematch':
      return handleRematchVote(room, ws.playerId);
    case 'rematch-decline':
      room.rematchVotes.clear();
      return;
  }
}

function handleJoin(ws: Client, playerId: string, name: string, code: string | undefined) {
  let room: Room;
  if (code) {
    const existing = rooms.get(code.toUpperCase());
    if (!existing) throw new Error('room not found');
    room = existing;
  } else {
    const newCode = makeCode();
    room = makeRoom(newCode);
    rooms.set(newCode, room);
  }

  if (!room.seats.includes(playerId)) {
    if (room.state) throw new Error('game already in progress');
    if (room.seats.length >= MAX_SEATS) throw new Error('room is full');
    room.seats.push(playerId);
  }
  room.names.set(playerId, name);

  ws.playerId = playerId;
  ws.name = name;
  ws.room = room;
  room.clients.add(ws);

  send(ws, { type: 'joined', code: room.code, playerId, seated: true });
  if (room.state) {
    send(ws, { type: 'state', state: redactStateFor(room.state, playerId), responseDeadline: room.responseDeadline });
    for (const p of room.state.players) if (p.id === playerId) p.connected = true;
  } else {
    broadcastLobby(room);
  }
}

function handleStart(room: Room) {
  if (room.state) throw new Error('already started');
  if (room.seats.length < MIN_SEATS) throw new Error('not enough players');
  room.state = createGame(room.seats.map((id) => ({ id, name: room.names.get(id) ?? '?' })));
  openResponseWindowIfNeeded(room);
  broadcastState(room);
}

// Opens (or clears) the response-window timer based on the current phase.
// Only 'action_declared' and 'block_declared' have a race-to-act clock —
// every other phase (awaiting_reveal, exchange_choice, variant-setup) waits
// on a specific player's explicit choice instead, with no clock.
function openResponseWindowIfNeeded(room: Room) {
  clearResponseTimer(room);
  if (!room.state) return;
  if (room.state.phase !== 'action_declared' && room.state.phase !== 'block_declared') {
    room.responseDeadline = null;
    return;
  }
  room.responseDeadline = Date.now() + RESPONSE_WINDOW_MS;
  room.responseTimer = setTimeout(() => {
    if (!room.state) return;
    room.state = resolveWindow(room.state);
    openResponseWindowIfNeeded(room);
    broadcastState(room);
  }, RESPONSE_WINDOW_MS);
}

function clearResponseTimer(room: Room) {
  if (room.responseTimer) clearTimeout(room.responseTimer);
  room.responseTimer = null;
}

function handleDeclareAction(room: Room, playerId: string, action: ActionType, targetId: string | null) {
  if (!room.state) throw new Error('game not started');
  room.state = declareAction(room.state, playerId, action, targetId);
  openResponseWindowIfNeeded(room);
  broadcastState(room);
}

function handleDeclareBlock(room: Room, playerId: string, character: BlockCharacter) {
  if (!room.state) throw new Error('game not started');
  room.state = declareBlock(room.state, playerId, character);
  openResponseWindowIfNeeded(room);
  broadcastState(room);
}

function handleChallenge(room: Room, playerId: string) {
  if (!room.state) throw new Error('game not started');
  room.state = declareChallenge(room.state, playerId);
  openResponseWindowIfNeeded(room);
  broadcastState(room);
}

// A pass is advisory only — it lets the UI mark that player as "done
// responding" so a fast, unanimous pass can feel snappier, but the actual
// resolution is always driven by the server's timer (openResponseWindowIfNeeded),
// so a client that never sends `pass` still resolves correctly at the deadline.
function handlePass(_room: Room, _playerId: string) {
  // No state change: engine.ts has no concept of an individual pass. This
  // handler exists so the client can send the message without an error;
  // the response window's timer is the single source of truth for when a
  // window closes.
}

function handleChooseReveal(room: Room, playerId: string, cardIndex: 0 | 1) {
  if (!room.state) throw new Error('game not started');
  room.state = chooseReveal(room.state, playerId, cardIndex);
  openResponseWindowIfNeeded(room);
  broadcastState(room);
}

function handleChooseExchange(room: Room, playerId: string, keepIndices: number[]) {
  if (!room.state) throw new Error('game not started');
  room.state = chooseExchange(room.state, playerId, keepIndices);
  openResponseWindowIfNeeded(room);
  broadcastState(room);
}

function handleChooseStartingCharacter(room: Room, playerId: string, character: Character) {
  if (!room.state) throw new Error('game not started');
  room.state = chooseStartingCharacter(room.state, playerId, character);
  broadcastState(room);
}

function handleRematchVote(room: Room, playerId: string) {
  room.rematchVotes.add(playerId);
  if (room.rematchVotes.size >= room.seats.length) {
    room.state = createGame(room.seats.map((id) => ({ id, name: room.names.get(id) ?? '?' })));
    room.rematchVotes.clear();
    openResponseWindowIfNeeded(room);
    broadcastState(room);
  } else {
    for (const c of room.clients) send(c, { type: 'rematch-votes', ids: [...room.rematchVotes] });
  }
}

function handleDisconnect(ws: Client) {
  const room = ws.room;
  if (!room || !ws.playerId) return;
  room.clients.delete(ws);
  const playerId = ws.playerId;

  if (isConnected(room, playerId)) return; // another tab/connection for the same player is still open

  if (room.state) {
    const player = room.state.players.find((p) => p.id === playerId);
    if (player) player.connected = false;
    broadcastState(room);

    if (!room.forfeitTimers.has(playerId)) {
      const timer = setTimeout(() => {
        room.forfeitTimers.delete(playerId);
        if (!room.state) return;
        const p = room.state.players.find((x) => x.id === playerId);
        if (!p || p.connected || p.eliminated) return;
        // Forfeit: reveal both cards, remove from turn order via the same
        // elimination path a normal loss uses.
        p.influence = [
          { character: p.influence[0].character, revealed: true },
          { character: p.influence[1].character, revealed: true },
        ];
        p.eliminated = true;
        for (const c of room.clients) send(c, { type: 'forfeit', playerId });
        broadcastState(room);
      }, DISCONNECT_FORFEIT_MS);
      room.forfeitTimers.set(playerId, timer);
    }
  } else {
    broadcastLobby(room);
  }
}
