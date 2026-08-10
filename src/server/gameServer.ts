// Authoritative WebSocket game server. Attaches to an existing HTTP server
// (the Next.js custom server) and manages rooms in memory.
import { WebSocketServer, WebSocket } from 'ws';

import { createGame, listSetups } from './setupStore';
import { applyAction, opposite } from '../game/engine';
import { getStore, type PersistedRoom } from './store';
import type { Color, GameState } from '../game/types';
import type { ClientMessage, Names, PlayerSlots, ServerMessage } from '../game/messages';

interface Client extends WebSocket {
  isAlive?: boolean;
  room?: Room;
  playerId?: string;
  name?: string;
  color?: Color | null;
}

interface Room {
  code: string;
  game: GameState;
  seats: { red: string | null; silver: string | null };
  names: Names;
  clients: Set<Client>;
  perMoveMs: number; // 0 = no per-move timer
  turnStartedAt: number | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  forfeitTimer: ReturnType<typeof setTimeout> | null;
  forfeitColor: Color | null; // who is about to forfeit (the disconnected player)
  forfeitDeadline: number | null; // epoch ms when the forfeit fires
  rematch: PlayerSlots; // rematch consent votes (both must agree)
}

const rooms = new Map<string, Room>();

// If a seated player disconnects while their opponent is present, they have this
// long to return before forfeiting the game. Override with FORFEIT_MS.
const DISCONNECT_FORFEIT_MS = Number(process.env.FORFEIT_MS) || 90_000;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
  } while (rooms.has(code));
  return code;
}

function makeRoom(code: string, game: GameState, perMoveMs: number): Room {
  return {
    code,
    game,
    seats: { red: null, silver: null },
    names: { red: null, silver: null },
    clients: new Set(),
    perMoveMs,
    turnStartedAt: null,
    turnTimer: null,
    forfeitTimer: null,
    forfeitColor: null,
    forfeitDeadline: null,
    rematch: { red: false, silver: false },
  };
}

// ---- persistence (so games survive a restart / redeploy / sleep) -----------
function toPersisted(room: Room): PersistedRoom {
  return {
    code: room.code,
    game: room.game,
    seats: room.seats,
    names: room.names,
    perMoveMs: room.perMoveMs,
    forfeitColor: room.forfeitColor,
    forfeitDeadline: room.forfeitDeadline,
  };
}
function persist(room: Room) {
  void getStore()
    .saveRoom(toPersisted(room))
    .catch((e) => console.error('saveRoom failed:', e));
}
function hydrateRoom(p: PersistedRoom): Room {
  return {
    code: p.code,
    game: p.game,
    seats: p.seats,
    names: p.names,
    clients: new Set(),
    perMoveMs: p.perMoveMs ?? 0,
    turnStartedAt: null,
    turnTimer: null,
    forfeitTimer: null,
    forfeitColor: p.forfeitColor ?? null,
    forfeitDeadline: p.forfeitDeadline ?? null,
    rematch: { red: false, silver: false },
  };
}

function seatOf(room: Room, playerId: string): Color | null {
  if (room.seats.red === playerId) return 'red';
  if (room.seats.silver === playerId) return 'silver';
  return null;
}

const bothSeated = (room: Room) => !!room.seats.red && !!room.seats.silver;

// ---- per-move clock (authoritative) ---------------------------------------
function stopTurnClock(room: Room) {
  if (room.turnTimer) clearTimeout(room.turnTimer);
  room.turnTimer = null;
  room.turnStartedAt = null;
}
function startTurnClock(room: Room) {
  stopTurnClock(room);
  if (room.perMoveMs <= 0 || room.game.winner || !bothSeated(room)) return;
  const on = presence(room);
  if (!on.red || !on.silver) return; // don't run the move clock while a player is offline
  room.turnStartedAt = Date.now();
  room.turnTimer = setTimeout(() => onTimeout(room), room.perMoveMs);
}
function turnEndsIn(room: Room): number | null {
  if (room.perMoveMs <= 0 || !room.turnTimer || room.turnStartedAt == null) return null;
  return Math.max(0, room.perMoveMs - (Date.now() - room.turnStartedAt));
}
function onTimeout(room: Room) {
  if (room.game.winner) return;
  room.game.winner = opposite(room.game.turn); // the player on the clock loses
  stopTurnClock(room);
  persist(room);
  broadcast(room, { type: 'timeout', winner: room.game.winner });
  broadcast(room, snapshot(room));
}

// ---- disconnect handling / forfeit ----------------------------------------
function clearForfeit(room: Room) {
  if (room.forfeitTimer) clearTimeout(room.forfeitTimer);
  room.forfeitTimer = null;
  room.forfeitColor = null;
  room.forfeitDeadline = null;
}
// Arm the OS timer to fire at the (already-decided) forfeit deadline. Idempotent —
// safe to call on every presence change / after rehydrating from the store.
function armForfeit(room: Room) {
  if (room.forfeitTimer) clearTimeout(room.forfeitTimer);
  room.forfeitTimer = null;
  if (room.forfeitColor == null || room.forfeitDeadline == null) return;
  room.forfeitTimer = setTimeout(() => doForfeit(room), Math.max(0, room.forfeitDeadline - Date.now()));
}
// Decide whether a forfeit countdown should be running — WITHOUT resetting one that's
// already ticking. The deadline is anchored to when the player first went offline, so
// the opponent reloading (or the server restarting) never restarts the clock.
function refreshForfeit(room: Room) {
  if (room.game.winner || !bothSeated(room)) return clearForfeit(room);
  const online = presence(room);
  if (room.forfeitColor) {
    if (online[room.forfeitColor]) clearForfeit(room); // they came back → cancel
    else armForfeit(room); // still gone → keep the existing deadline
    return;
  }
  // no countdown yet → start one for a seated player who is now offline
  const offline: Color | null = !online.red && room.seats.red ? 'red' : !online.silver && room.seats.silver ? 'silver' : null;
  if (!offline) return;
  room.forfeitColor = offline;
  room.forfeitDeadline = Date.now() + DISCONNECT_FORFEIT_MS;
  armForfeit(room);
}
function doForfeit(room: Room) {
  const loser = room.forfeitColor;
  room.forfeitTimer = null;
  if (room.game.winner || !loser || presence(room)[loser]) return clearForfeit(room);
  room.game.winner = opposite(loser);
  clearForfeit(room);
  stopTurnClock(room);
  persist(room);
  broadcast(room, { type: 'forfeit', winner: room.game.winner });
  broadcast(room, snapshot(room));
}

function presence(room: Room): PlayerSlots {
  const online: PlayerSlots = { red: false, silver: false };
  for (const ws of room.clients) if (ws.readyState === ws.OPEN && ws.color) online[ws.color] = true;
  return online;
}

function snapshot(room: Room): ServerMessage {
  return {
    type: 'state',
    code: room.code,
    setup: room.game.setup,
    board: room.game.board,
    turn: room.game.turn,
    winner: room.game.winner,
    names: room.names,
    seated: { red: !!room.seats.red, silver: !!room.seats.silver },
    online: presence(room),
    perMoveMs: room.perMoveMs,
    turnEndsIn: turnEndsIn(room),
    forfeitOf: room.forfeitColor,
    forfeitEndsIn: room.forfeitColor && room.forfeitDeadline ? Math.max(0, room.forfeitDeadline - Date.now()) : null,
    rematch: room.rematch,
  };
}

function broadcast(room: Room, msg: ServerMessage) {
  const data = JSON.stringify(msg);
  for (const ws of room.clients) if (ws.readyState === ws.OPEN) ws.send(data);
}
const send = (ws: Client, msg: ServerMessage) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
};

// Created in `noServer` mode; the custom server routes `/ws` upgrades to it and
// leaves everything else (e.g. Next's HMR socket) for Next to handle.
export function createGameWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: Client) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (buf) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      try {
        await handle(ws, msg);
      } catch (e) {
        send(ws, { type: 'error', message: String((e as Error).message || e) });
      }
    });

    ws.on('close', () => {
      const room = ws.room;
      if (!room) return;
      room.clients.delete(ws);
      // Pause the move clock while a player is gone (they shouldn't lose on it),
      // and drop any pending rematch request.
      if (ws.color) {
        stopTurnClock(room);
        room.rematch = { red: false, silver: false };
      }
      // Start/keep the forfeit countdown (anchored to the first drop — never reset here),
      // then persist so the deadline survives even a server restart.
      refreshForfeit(room);
      persist(room);
      if (room.clients.size > 0) broadcast(room, snapshot(room));
      else {
        // no one connected → drop from memory after a while (the store row remains so the
        // game can be rehydrated, forfeit deadline included, if someone returns)
        setTimeout(() => {
          if (room.clients.size === 0) {
            clearForfeit(room);
            stopTurnClock(room);
            rooms.delete(room.code);
          }
        }, 10 * 60 * 1000);
      }
    });
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
  // drop persisted rooms that haven't been touched in a day
  const sweep = setInterval(() => void getStore().sweepRooms(24 * 60 * 60 * 1000).catch(() => {}), 60 * 60 * 1000);
  wss.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(sweep);
  });

  return wss;
}

async function handle(ws: Client, msg: ClientMessage) {
  if (msg.type === 'join') return onJoin(ws, msg);
  if (msg.type === 'action') return onAction(ws, msg);
  if (msg.type === 'rematch') return onRematch(ws, msg);
  if (msg.type === 'rematch-decline') return onRematchDecline(ws);
  if (msg.type === 'chat') {
    const room = ws.room;
    if (room && ws.name)
      broadcast(room, { type: 'chat', name: ws.name, color: ws.color ?? null, text: String(msg.text || '').slice(0, 240) });
  }
}

async function onJoin(ws: Client, msg: Extract<ClientMessage, { type: 'join' }>) {
  const playerId = String(msg.playerId || '').slice(0, 64);
  if (!playerId) return send(ws, { type: 'error', message: 'missing playerId' });
  ws.playerId = playerId;
  ws.name = String(msg.name || 'Player').slice(0, 24);

  let code = (msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  let room = code ? rooms.get(code) : undefined;

  // not in memory (e.g. after a restart) → try to rehydrate from the store
  if (!room && code) {
    const persisted = await getStore().loadRoom(code);
    room = rooms.get(code) ?? undefined;
    if (!room && persisted) {
      room = hydrateRoom(persisted);
      rooms.set(code, room);
    }
  }

  if (!room) {
    code = makeCode();
    const known = (await listSetups()).some((s) => s.name === msg.setup);
    const setup = msg.setup && known ? msg.setup : 'Classic';
    const minutes = Math.min(60, Math.max(0, Number(msg.perMove) || 0));
    room = makeRoom(code, await createGame(setup), Math.round(minutes * 60000));
    rooms.set(code, room);
  }

  let color = seatOf(room, playerId);
  if (!color) {
    const want: Color = msg.color === 'red' || msg.color === 'silver' ? msg.color : Math.random() < 0.5 ? 'red' : 'silver';
    if (!room.seats[want]) color = want;
    else if (!room.seats[opposite(want)]) color = opposite(want);
  }
  if (color) {
    room.seats[color] = playerId;
    room.names[color] = ws.name;
  }

  ws.room = room;
  ws.color = color;
  room.clients.add(ws);

  // (Re)start the clock once a seat is taken and both players are present.
  if (color && bothSeated(room) && !room.game.winner) startTurnClock(room);
  refreshForfeit(room); // a returning player cancels their own forfeit; keeps the opponent's ticking

  send(ws, { type: 'joined', code: room.code, you: color, spectator: !color });
  broadcast(room, snapshot(room));
  if (color) persist(room); // seat/name changes are durable
}

function onAction(ws: Client, msg: Extract<ClientMessage, { type: 'action' }>) {
  const room = ws.room;
  if (!room) return;
  if (!ws.color) return send(ws, { type: 'error', message: 'spectators cannot move' });
  if (room.game.winner) return send(ws, { type: 'error', message: 'game over' });

  const result = applyAction(room.game, ws.color, msg.action);
  if (!result.ok) return send(ws, { type: 'error', message: result.error! });

  room.game.board = result.board;
  room.game.turn = result.turn;
  room.game.winner = result.winner;
  room.game.moveCount++;

  if (result.winner) stopTurnClock(room);
  else startTurnClock(room); // reset the clock for the next player

  persist(room);

  broadcast(room, {
    type: 'move',
    by: ws.color,
    action: msg.action,
    laser: result.laser,
    removed: result.removed,
    board: result.board,
    turn: result.turn,
    winner: result.winner,
    perMoveMs: room.perMoveMs,
    turnEndsIn: turnEndsIn(room),
  });
}

// A rematch needs BOTH players to agree. The first click records that player's
// vote and the opponent is shown "… wants a rematch"; once both have voted the
// game actually resets (with sides swapped).
async function onRematch(ws: Client, msg: Extract<ClientMessage, { type: 'rematch' }>) {
  const room = ws.room;
  if (!room || !ws.color) return;
  if (!room.game.winner) return; // rematch only makes sense once the game is over
  room.rematch[ws.color] = true;
  if (room.rematch.red && room.rematch.silver) {
    await performRematch(room, msg.setup);
  } else {
    broadcast(room, snapshot(room)); // tells the opponent someone wants a rematch
  }
}

function onRematchDecline(ws: Client) {
  const room = ws.room;
  if (!room || !ws.color) return;
  const hadRequest = room.rematch.red || room.rematch.silver;
  room.rematch = { red: false, silver: false };
  if (hadRequest) broadcast(room, { type: 'rematch-declined', by: ws.color });
  broadcast(room, snapshot(room));
}

async function performRematch(room: Room, requestedSetup?: string) {
  const known = (await listSetups()).some((s) => s.name === requestedSetup);
  const setup = requestedSetup && known ? requestedSetup : room.game.setup;
  const oldSeats = { ...room.seats },
    oldNames = { ...room.names };
  room.seats = { red: oldSeats.silver, silver: oldSeats.red };
  room.names = { red: oldNames.silver, silver: oldNames.red };
  for (const c of room.clients) {
    if (c.playerId && seatOf(room, c.playerId)) c.color = seatOf(room, c.playerId);
  }
  room.game = await createGame(setup);
  room.rematch = { red: false, silver: false };
  clearForfeit(room);
  if (bothSeated(room)) startTurnClock(room);
  else stopTurnClock(room);
  persist(room);
  broadcast(room, { type: 'rematch' });
  for (const c of room.clients) send(c, { type: 'reseat', you: c.color ?? null });
  broadcast(room, snapshot(room));
}
