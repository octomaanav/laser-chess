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
  forfeitPlayer,
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
  // A transient store error here must never become an unhandled rejection —
  // this runs on every broadcast in every room, and an unhandled rejection
  // crashes the whole Node process (taking down Laser Chess's rooms too).
  getStore()
    .saveCoupRoom({
      code: room.code,
      state: room.state,
      seats: room.seats,
      names: Object.fromEntries(room.names),
      responseDeadline: room.responseDeadline,
      forfeitPlayerId: null,
      forfeitDeadline: null,
    })
    .catch((e) => {
      console.error(`[coup] failed to persist room ${room.code}:`, e);
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

  // A player id is visible to everyone in the room (lobby/state broadcasts),
  // so it's not a secret — never trust a `join` claiming an id that's
  // already live under a different socket, or that socket's holder would
  // have their hidden hand handed straight to an impostor.
  if (isConnected(room, playerId)) throw new Error('that player is already connected');

  if (!room.seats.includes(playerId)) {
    if (room.state) throw new Error('game already in progress');
    if (room.seats.length >= MAX_SEATS) throw new Error('room is full');
    room.seats.push(playerId);
  }
  room.names.set(playerId, name);

  const pendingForfeit = room.forfeitTimers.get(playerId);
  if (pendingForfeit) {
    clearTimeout(pendingForfeit);
    room.forfeitTimers.delete(playerId);
  }

  ws.playerId = playerId;
  ws.name = name;
  ws.room = room;
  room.clients.add(ws);

  send(ws, { type: 'joined', code: room.code, playerId, seated: true });
  if (room.state) {
    for (const p of room.state.players) if (p.id === playerId) p.connected = true;
    broadcastState(room); // so every other player's view flips this player back to connected
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

// A pass is advisory only: it's currently not tracked at all. It exists so
// the client can send the message without an error, but no unanimous-pass
// fast path is implemented — the response window's timer, driven by
// openResponseWindowIfNeeded, is the single source of truth for when a
// window closes, and a client that never sends `pass` resolves identically.
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

// Reclaims a room once nothing is left that still needs it: an abandoned
// pre-game lobby, or a finished game nobody's still watching. A mid-game
// room with zero connected clients must stay in the map — it still has a
// live forfeit timer and disconnected players need `join` to find it again
// by code when they reconnect. Called both right after a `close` event and
// after a forfeit-timeout fires (the latter has no `close` event of its own
// to trigger this, so a room abandoned entirely via forfeit would otherwise
// never be swept).
function maybeReclaimRoom(room: Room) {
  const reclaimable = !room.state || room.state.phase === 'game_over';
  if (room.clients.size === 0 && reclaimable) {
    clearResponseTimer(room);
    for (const timer of room.forfeitTimers.values()) clearTimeout(timer);
    room.forfeitTimers.clear();
    rooms.delete(room.code);
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
        // Route the forfeit through the rules engine rather than mutating
        // state in place — forfeitPlayer() also runs the win check and
        // advances play past the forfeiting player if they held the turn,
        // the pending action/target, the pending block, or the head of the
        // reveal queue, so nothing is left pointing at a ghost.
        const phaseBefore = room.state.phase;
        room.state = forfeitPlayer(room.state, playerId);
        // Only re-arm/clear the response-window timer if the forfeit
        // actually touched the phase — a bystander forfeiting mid-window
        // (not the actor/target/blocker) leaves phase untouched, and
        // re-running this would silently reset an in-progress countdown
        // for everyone else.
        if (room.state.phase !== phaseBefore) openResponseWindowIfNeeded(room);
        for (const c of room.clients) send(c, { type: 'forfeit', playerId });
        broadcastState(room);
        maybeReclaimRoom(room);
      }, DISCONNECT_FORFEIT_MS);
      room.forfeitTimers.set(playerId, timer);
    }
  } else {
    // Pre-game: release the seat rather than burning it forever, and drop
    // the player's name so a fully-abandoned lobby can be reclaimed (see
    // maybeReclaimRoom below) or rejoined cleanly by someone else.
    room.seats = room.seats.filter((id) => id !== playerId);
    room.names.delete(playerId);
    broadcastLobby(room);
  }

  maybeReclaimRoom(room);
}
