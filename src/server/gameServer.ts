// Authoritative WebSocket game server. Attaches to an existing HTTP server
// (the Next.js custom server) and manages rooms in memory.
import { WebSocketServer, WebSocket } from 'ws';

import { createGame, listSetups } from './setupStore';
import { applyAction, opposite } from '../game/engine';
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
}

const rooms = new Map<string, Room>();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');
  } while (rooms.has(code));
  return code;
}

function makeRoom(code: string, setup: string): Room {
  return {
    code,
    game: createGame(setup),
    seats: { red: null, silver: null },
    names: { red: null, silver: null },
    clients: new Set(),
  };
}

function seatOf(room: Room, playerId: string): Color | null {
  if (room.seats.red === playerId) return 'red';
  if (room.seats.silver === playerId) return 'silver';
  return null;
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

    ws.on('message', (buf) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      try {
        handle(ws, msg);
      } catch (e) {
        send(ws, { type: 'error', message: String((e as Error).message || e) });
      }
    });

    ws.on('close', () => {
      const room = ws.room;
      if (!room) return;
      room.clients.delete(ws);
      if (room.clients.size === 0) {
        setTimeout(() => {
          if (room.clients.size === 0) rooms.delete(room.code);
        }, 10 * 60 * 1000);
      } else {
        broadcast(room, snapshot(room));
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
  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}

function handle(ws: Client, msg: ClientMessage) {
  if (msg.type === 'join') return onJoin(ws, msg);
  if (msg.type === 'action') return onAction(ws, msg);
  if (msg.type === 'rematch') return onRematch(ws, msg);
  if (msg.type === 'chat') {
    const room = ws.room;
    if (room && ws.name)
      broadcast(room, { type: 'chat', name: ws.name, color: ws.color ?? null, text: String(msg.text || '').slice(0, 240) });
  }
}

function onJoin(ws: Client, msg: Extract<ClientMessage, { type: 'join' }>) {
  const playerId = String(msg.playerId || '').slice(0, 64);
  if (!playerId) return send(ws, { type: 'error', message: 'missing playerId' });
  ws.playerId = playerId;
  ws.name = String(msg.name || 'Player').slice(0, 24);

  let code = (msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  let room = code ? rooms.get(code) : undefined;

  if (!room) {
    code = makeCode();
    const known = listSetups().some((s) => s.name === msg.setup);
    const setup = msg.setup && known ? msg.setup : 'Classic';
    room = makeRoom(code, setup);
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

  send(ws, { type: 'joined', code: room.code, you: color, spectator: !color });
  broadcast(room, snapshot(room));
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

  broadcast(room, {
    type: 'move',
    by: ws.color,
    action: msg.action,
    laser: result.laser,
    removed: result.removed,
    board: result.board,
    turn: result.turn,
    winner: result.winner,
  });
}

function onRematch(ws: Client, msg: Extract<ClientMessage, { type: 'rematch' }>) {
  const room = ws.room;
  if (!room || !ws.color) return;
  const known = listSetups().some((s) => s.name === msg.setup);
  const setup = msg.setup && known ? msg.setup : room.game.setup;
  const oldSeats = { ...room.seats },
    oldNames = { ...room.names };
  room.seats = { red: oldSeats.silver, silver: oldSeats.red };
  room.names = { red: oldNames.silver, silver: oldNames.red };
  for (const c of room.clients) {
    if (c.playerId && seatOf(room, c.playerId)) c.color = seatOf(room, c.playerId);
  }
  room.game = createGame(setup);
  broadcast(room, { type: 'rematch' });
  for (const c of room.clients) send(c, { type: 'reseat', you: c.color ?? null });
  broadcast(room, snapshot(room));
}
