// src/server/games/flip7/roomServer.ts
// Authoritative WebSocket server for Flip 7 rooms with Easy/Medium/Hard Bot AI.
import { WebSocketServer, WebSocket } from 'ws';
import {
  chooseFlipThreeTarget,
  chooseFreezeTarget,
  chooseSecondChanceRecipient,
  createGame,
  forfeitPlayer,
  hit,
  stay,
  startNextRound,
} from '../../../game/flip7/engine';
import { redactStateFor } from '../../../game/flip7/redact';
import type { Flip7State } from '../../../game/flip7/types';
import type { ClientMessage, ServerMessage, LobbySeat } from '../../../game/flip7/messages';
import { decideBotMove, decideBotTarget, BOT_NAMES, type BotDifficulty } from '../../../game/flip7/bot';
import { getStore, type PersistedFlip7Room } from '../../store';

interface Client extends WebSocket {
  isAlive?: boolean;
  playerId?: string;
  name?: string;
  room?: Room;
}

interface Room {
  code: string;
  seats: string[]; // player ids in seat order, filled as players join, max MAX_SEATS
  names: Map<string, string>;
  clients: Set<Client>;
  state: Flip7State | null; // null until `start`
  botDifficulty: Map<string, BotDifficulty>;
  botTimer: ReturnType<typeof setTimeout> | null;
  forfeitTimers: Map<string, ReturnType<typeof setTimeout>>;
  rematchVotes: Set<string>;
  startedAt?: number;
  matchLogged?: boolean;
}

const MIN_SEATS = 2;
const MAX_SEATS = 7;
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
    botDifficulty: new Map(),
    botTimer: null,
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
  const seats: LobbySeat[] = room.seats.map((id) => ({
    id,
    name: room.names.get(id) ?? '?',
    connected: isConnected(room, id) || room.botDifficulty.has(id),
    isBot: room.botDifficulty.has(id),
    botDifficulty: room.botDifficulty.get(id),
  }));
  for (const c of room.clients) {
    send(c, { type: 'lobby', code: room.code, seats, maxSeats: MAX_SEATS, canStart: room.seats.length >= MIN_SEATS });
  }
}

function isConnected(room: Room, playerId: string): boolean {
  if (room.botDifficulty.has(playerId)) return true;
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
        gameSlug: 'flip7',
        roomCode: room.code,
        player1Name: allPlayers[0]?.name,
        player2Name: allPlayers[1]?.name,
        allPlayers,
        isBot: room.botDifficulty.size > 0,
        isRanked: false,
        status: 'completed',
        winnerName,
        winnerColor: room.state.winner,
        movesCount: room.state.log.length,
        durationSeconds: durationSec,
        startedAt: room.startedAt || Date.now() - durationSec * 1000,
        endedAt: Date.now(),
      })
      .catch((e) => console.error('[flip7] recordMatch failed:', e));
  }

  for (const c of room.clients) {
    if (!c.playerId) continue;
    send(c, { type: 'state', state: redactStateFor(room.state, c.playerId) });
  }

  // Trigger any bot turns or target resolutions
  maybeTriggerBot(room);
}

function maybeTriggerBot(room: Room) {
  if (!room.state) return;
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }

  // 1. AWAITING TARGET CHOICE (Freeze, Flip Three, Second Chance)
  if (room.state.phase === 'awaiting_target' && room.state.pendingTarget) {
    const drawerId = room.state.pendingTarget.drawerId;
    const difficulty = room.botDifficulty.get(drawerId);
    if (difficulty) {
      const delay = 800 + Math.floor(Math.random() * 400); // 800ms - 1200ms
      room.botTimer = setTimeout(() => {
        room.botTimer = null;
        if (!room.state || room.state.phase !== 'awaiting_target' || !room.state.pendingTarget) return;
        const targetId = decideBotTarget(room.state, drawerId, room.state.pendingTarget.kind, difficulty);
        const kind = room.state.pendingTarget.kind;
        if (kind === 'freeze') {
          handleChooseFreezeTarget(room, drawerId, targetId);
        } else if (kind === 'flip-three') {
          handleChooseFlipThreeTarget(room, drawerId, targetId);
        } else {
          handleChooseSecondChanceRecipient(room, drawerId, targetId);
        }
      }, delay);
    }
    return;
  }

  // 2. ACTIVE TURN: BOT DECIDES DRAW (HIT) OR STAY
  if (room.state.phase === 'round_active' && room.state.flipThreeQueue.length === 0) {
    const currentP = room.state.players[room.state.turn];
    if (currentP && room.botDifficulty.has(currentP.id) && currentP.status === 'active') {
      const difficulty = room.botDifficulty.get(currentP.id)!;
      const delay = 700 + Math.floor(Math.random() * 500); // 700ms - 1200ms
      room.botTimer = setTimeout(() => {
        room.botTimer = null;
        if (!room.state || room.state.phase !== 'round_active') return;
        const p = room.state.players[room.state.turn];
        if (!p || p.id !== currentP.id || p.status !== 'active') return;

        const move = decideBotMove(room.state, p.id, difficulty);
        if (move === 'hit') {
          handleHit(room, p.id);
        } else {
          handleStay(room, p.id);
        }
      }, delay);
    }
  }
}

function persist(room: Room) {
  if (!room.state) return;
  getStore()
    .saveFlip7Room({
      code: room.code,
      state: room.state,
      seats: room.seats,
      names: Object.fromEntries(room.names),
      forfeitPlayerId: null,
      forfeitDeadline: null,
    })
    .catch((e) => {
      console.error(`[flip7] failed to persist room ${room.code}:`, e);
    });
}

function hydrateRoom(p: PersistedFlip7Room): Room {
  return {
    code: p.code,
    seats: p.seats,
    names: new Map(Object.entries(p.names)),
    clients: new Set(),
    state: p.state,
    botDifficulty: new Map(),
    botTimer: null,
    forfeitTimers: new Map(),
    rematchVotes: new Set(),
  };
}

export function createFlip7Wss(): WebSocketServer {
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

  const sweep = setInterval(() => void getStore().sweepFlip7Rooms(24 * 60 * 60 * 1000).catch(() => {}), 60 * 60 * 1000);
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
    case 'add-bot':
      return handleAddBot(room, ws.playerId, msg.difficulty);
    case 'remove-bot':
      return handleRemoveBot(room, ws.playerId, msg.botId);
    case 'hit':
      return handleHit(room, ws.playerId);
    case 'stay':
      return handleStay(room, ws.playerId);
    case 'choose-freeze-target':
      return handleChooseFreezeTarget(room, ws.playerId, msg.targetId);
    case 'choose-flip-three-target':
      return handleChooseFlipThreeTarget(room, ws.playerId, msg.targetId);
    case 'choose-second-chance-recipient':
      return handleChooseSecondChanceRecipient(room, ws.playerId, msg.recipientId);
    case 'start-next-round':
      return handleStartNextRound(room, ws.playerId);
    case 'rematch':
      return handleRematchVote(room, ws.playerId);
    case 'rematch-decline':
      room.rematchVotes.clear();
      return;
  }
}

function handleAddBot(room: Room, hostPlayerId: string, difficulty: BotDifficulty) {
  if (room.state) throw new Error('game already in progress');
  if (room.seats[0] !== hostPlayerId) throw new Error('only room host can add bots');
  if (room.seats.length >= MAX_SEATS) throw new Error('room is full');

  // Choose a distinct bot name
  const existingNames = new Set(room.names.values());
  const unusedNames = BOT_NAMES.filter((n) => !existingNames.has(`${n} (Bot)`));
  const chosenBase = unusedNames.length > 0
    ? unusedNames[Math.floor(Math.random() * unusedNames.length)]
    : `Bot ${room.seats.length + 1}`;
  const diffLabel = difficulty[0].toUpperCase() + difficulty.slice(1);
  const botName = `${chosenBase} (${diffLabel})`;

  const botId = `bot_${difficulty}_${Math.random().toString(36).slice(2, 8)}`;
  room.seats.push(botId);
  room.names.set(botId, botName);
  room.botDifficulty.set(botId, difficulty);

  broadcastLobby(room);
}

function handleRemoveBot(room: Room, hostPlayerId: string, botId: string) {
  if (room.state) throw new Error('game already in progress');
  if (room.seats[0] !== hostPlayerId) throw new Error('only room host can remove bots');
  if (!room.botDifficulty.has(botId)) throw new Error('seat is not a bot');

  room.seats = room.seats.filter((id) => id !== botId);
  room.names.delete(botId);
  room.botDifficulty.delete(botId);

  broadcastLobby(room);
}

async function handleJoin(ws: Client, rawPlayerId: string, rawName: string, rawCode: string | undefined) {
  const playerId = String(rawPlayerId || '').slice(0, 64);
  const name = String(rawName || 'Player').slice(0, 24);
  if (!playerId) throw new Error('missing playerId');
  const code = rawCode ? rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) : undefined;

  let room: Room;
  if (code) {
    let existing = rooms.get(code);
    if (!existing) {
      const persisted = await getStore().loadFlip7Room(code);
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

  if (isConnected(room, playerId) && !room.botDifficulty.has(playerId)) {
    throw new Error('that player is already connected');
  }

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
    broadcastState(room);
  } else {
    broadcastLobby(room);
  }
}

function handleStart(room: Room, playerId: string) {
  if (room.state) throw new Error('already started');
  if (room.seats.length < MIN_SEATS) throw new Error('not enough players');
  if (room.seats[0] !== playerId) throw new Error('only the room creator can start the game');
  room.startedAt = Date.now();
  room.matchLogged = false;
  room.state = createGame(room.seats.map((id) => ({ id, name: room.names.get(id) ?? '?' })));
  broadcastState(room);
}

function handleHit(room: Room, playerId: string) {
  if (!room.state) throw new Error('game not started');
  room.state = hit(room.state, playerId);
  broadcastState(room);
}

function handleStay(room: Room, playerId: string) {
  if (!room.state) throw new Error('game not started');
  room.state = stay(room.state, playerId);
  broadcastState(room);
}

function handleChooseFreezeTarget(room: Room, playerId: string, targetId: string) {
  if (!room.state) throw new Error('game not started');
  room.state = chooseFreezeTarget(room.state, playerId, targetId);
  broadcastState(room);
}

function handleChooseFlipThreeTarget(room: Room, playerId: string, targetId: string) {
  if (!room.state) throw new Error('game not started');
  room.state = chooseFlipThreeTarget(room.state, playerId, targetId);
  broadcastState(room);
}

function handleChooseSecondChanceRecipient(room: Room, playerId: string, recipientId: string) {
  if (!room.state) throw new Error('game not started');
  room.state = chooseSecondChanceRecipient(room.state, playerId, recipientId);
  broadcastState(room);
}

function handleStartNextRound(room: Room, playerId: string) {
  if (!room.state) throw new Error('game not started');
  room.state = startNextRound(room.state, playerId);
  broadcastState(room);
}

function handleRematchVote(room: Room, playerId: string) {
  room.rematchVotes.add(playerId);
  // Bots automatically agree to rematch
  for (const botId of room.botDifficulty.keys()) {
    if (room.seats.includes(botId)) room.rematchVotes.add(botId);
  }

  const connectedSeats = room.seats.filter((id) => isConnected(room, id));
  if (connectedSeats.length >= MIN_SEATS && room.rematchVotes.size >= connectedSeats.length) {
    room.seats = connectedSeats;
    room.state = createGame(room.seats.map((id) => ({ id, name: room.names.get(id) ?? '?' })));
    room.rematchVotes.clear();
    broadcastState(room);
  } else {
    for (const c of room.clients) send(c, { type: 'rematch-votes', ids: [...room.rematchVotes] });
  }
}

function maybeReclaimRoom(room: Room) {
  const reclaimable = !room.state || room.state.phase === 'game_over';
  if (room.clients.size === 0 && reclaimable) {
    if (room.botTimer) clearTimeout(room.botTimer);
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

  if (isConnected(room, playerId)) return;

  if (room.state) {
    const player = room.state.players.find((p) => p.id === playerId);
    if (player) player.connected = false;
    broadcastState(room);

    if (!room.forfeitTimers.has(playerId)) {
      const timer = setTimeout(() => {
        room.forfeitTimers.delete(playerId);
        if (!room.state) return;
        const p = room.state.players.find((x) => x.id === playerId);
        if (!p || p.connected || p.status === 'forfeited') return;
        room.state = forfeitPlayer(room.state, playerId);
        for (const c of room.clients) send(c, { type: 'forfeit', playerId });
        broadcastState(room);
        maybeReclaimRoom(room);
      }, DISCONNECT_FORFEIT_MS);
      room.forfeitTimers.set(playerId, timer);
    }
  } else {
    room.seats = room.seats.filter((id) => id !== playerId);
    room.names.delete(playerId);
    broadcastLobby(room);
  }

  maybeReclaimRoom(room);
}
