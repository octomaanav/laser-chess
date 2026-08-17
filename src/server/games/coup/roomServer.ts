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
import { getStore, type PersistedCoupRoom } from '../../store';

interface Client extends WebSocket {
  isAlive?: boolean;
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
  startedAt?: number;
  matchLogged?: boolean;
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
    startedAt: Date.now(),
    matchLogged: false,
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

  if (room.state.winner && !room.matchLogged) {
    room.matchLogged = true;
    const winnerName = room.names.get(room.state.winner) || room.state.winner;
    const durationSec = Math.max(1, Math.round((Date.now() - (room.startedAt || Date.now())) / 1000));
    const allPlayers = room.seats.map((id) => ({
      name: room.names.get(id) || 'Player',
      userId: null,
      seat: id,
    }));

    void getStore()
      .recordMatch({
        id: `${room.code}-${Date.now()}`,
        gameSlug: 'coup',
        roomCode: room.code,
        player1Name: allPlayers[0]?.name,
        player2Name: allPlayers[1]?.name,
        allPlayers,
        isBot: false,
        isRanked: false,
        status: 'completed',
        winnerName,
        winnerColor: room.state.winner,
        movesCount: room.state.log.length,
        durationSeconds: durationSec,
        startedAt: room.startedAt || Date.now() - durationSec * 1000,
        endedAt: Date.now(),
      })
      .catch((e) => console.error('[coup] recordMatch failed:', e));
  }

  for (const c of room.clients) {
    if (!c.playerId) continue;
    send(c, { type: 'state', state: redactStateFor(room.state, c.playerId), responseDeadline: room.responseDeadline });
  }
}

function persist(room: Room) {
  if (!room.state) return;
  // A transient store error here must never become an unhandled rejection -
  // this runs on every broadcast in every room, and an unhandled rejection
  // crashes the whole Node process (taking down Photon's rooms too).
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

function hydrateRoom(p: PersistedCoupRoom): Room {
  return {
    code: p.code,
    seats: p.seats,
    names: new Map(Object.entries(p.names)),
    clients: new Set(),
    state: p.state,
    responseTimer: null,
    responseDeadline: p.responseDeadline,
    forfeitTimers: new Map(),
    rematchVotes: new Set(),
  };
}

export function createCoupWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: Client) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      try {
        await handleMessage(ws, msg);
      } catch (e) {
        send(ws, { type: 'error', message: e instanceof Error ? e.message : 'unknown error' });
      }
    });

    ws.on('close', () => handleDisconnect(ws));
  });

  // Half-open connections (laptop sleep, mobile network drop) never fire a
  // 'close' event on their own - without this, isConnected() stays true
  // forever for a dead socket, so the real player gets rejected on rejoin
  // with "already connected" and no forfeit timer ever arms.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<Client>) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }, 30000);
  // drop persisted rooms that haven't been touched in a day
  const sweep = setInterval(() => void getStore().sweepCoupRooms(24 * 60 * 60 * 1000).catch(() => {}), 60 * 60 * 1000);
  wss.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(sweep);
  });

  return wss;
}

async function handleMessage(ws: Client, msg: ClientMessage) {
  if (msg.type === 'join') {
    await handleJoin(ws, msg.playerId, msg.name, msg.code);
    return;
  }
  const room = ws.room;
  if (!room || !ws.playerId) throw new Error('not in a room');

  switch (msg.type) {
    case 'start':
      return handleStart(room, ws.playerId);
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

async function handleJoin(ws: Client, rawPlayerId: string, rawName: string, rawCode: string | undefined) {
  // Persisted to Postgres on every broadcast (see persist()), so these must
  // be bounded - mirrors gameServer.ts's onJoin clamping.
  const playerId = String(rawPlayerId || '').slice(0, 64);
  const name = String(rawName || 'Player').slice(0, 24);
  if (!playerId) throw new Error('missing playerId');
  const code = rawCode ? rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) : undefined;

  let room: Room;
  if (code) {
    let existing = rooms.get(code);
    // not in memory (e.g. after a restart) → try to rehydrate from the store
    if (!existing) {
      const persisted = await getStore().loadCoupRoom(code);
      existing = rooms.get(code) ?? undefined;
      if (!existing && persisted) {
        existing = hydrateRoom(persisted);
        rooms.set(code, existing);
      }
    }
    if (!existing) throw new Error('room not found');
    room = existing;
  } else {
    const newCode = makeCode();
    room = makeRoom(newCode);
    rooms.set(newCode, room);
  }

  // A player id is visible to everyone in the room (lobby/state broadcasts),
  // so it's not a secret - never trust a `join` claiming an id that's
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

function handleStart(room: Room, playerId: string) {
  if (room.state) throw new Error('already started');
  if (room.seats.length < MIN_SEATS) throw new Error('not enough players');
  // Only the room creator (first seat) may start - otherwise any seated
  // client could start the moment MIN_SEATS is reached, potentially cutting
  // off players still in the process of joining a shared link.
  if (room.seats[0] !== playerId) throw new Error('only the room creator can start the game');
  room.startedAt = Date.now();
  room.matchLogged = false;
  room.state = createGame(room.seats.map((id) => ({ id, name: room.names.get(id) ?? '?' })));
  openResponseWindowIfNeeded(room);
  broadcastState(room);
}

// Opens (or clears) the response-window timer based on the current phase.
// Only 'action_declared' and 'block_declared' have a race-to-act clock -
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
// fast path is implemented - the response window's timer, driven by
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
  // Only players who are still actually connected can be re-seated: a
  // player whose forfeit timer already fired has a socket that's long gone,
  // and no `close` event will ever fire again for it to arm a new forfeit
  // timer - re-seating them would hang the rematch on their turn forever.
  const connectedSeats = room.seats.filter((id) => isConnected(room, id));
  if (connectedSeats.length >= MIN_SEATS && room.rematchVotes.size >= connectedSeats.length) {
    room.seats = connectedSeats;
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
// room with zero connected clients must stay in the map - it still has a
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
        // state in place - forfeitPlayer() also runs the win check and
        // advances play past the forfeiting player if they held the turn,
        // the pending action/target, the pending block, or the head of the
        // reveal queue, so nothing is left pointing at a ghost.
        const phaseBefore = room.state.phase;
        room.state = forfeitPlayer(room.state, playerId);
        // Only re-arm/clear the response-window timer if the forfeit
        // actually touched the phase - a bystander forfeiting mid-window
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
