// Authoritative WebSocket game server. Attaches to an existing HTTP server
// (the Next.js custom server) and manages rooms in memory.
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

import { createGame, listSetups } from './setupStore';
import { applyAction, opposite } from '../game/engine';
import { requestBotMove } from './botWorker';
import { DIFFICULTIES, type Difficulty } from '../game/bot/types';
import crypto from 'node:crypto';
import { resolveAccountFromReq } from './auth/cookies';
import { getStore, type PersistedRoom } from './store';
import { applyResult, getRank, normalizeRating } from '../game/ranking';
import { socialHub } from './social/socialHub';
import { registerCreateRankedRoom } from './matchmaking';
import type { Action, Color, GameState } from '../game/types';
import type { ClientMessage, Names, PlayerSlots, ServerMessage } from '../game/messages';

interface Client extends WebSocket {
  isAlive?: boolean;
  room?: Room;
  playerId?: string;
  name?: string;
  color?: Color | null;
  userId?: string | null; // set when the connection carries a valid session cookie
  accountName?: string | null; // the account's display name (used in place of a free-text name)
  authReady?: Promise<void>; // resolves once userId/accountName are populated
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
  botDifficulty: Partial<Record<Color, Difficulty>>; // seats occupied by a bot
  botThinking: boolean; // true while a requestBotMove() call is in flight for this room
  isRanked: boolean;
  rankedGameSlug: string;
  rankedUserIds: { red: string | null; silver: string | null };
  rankedSettled: boolean; // prevents double rating settlement if multiple end-events fire
}

const rooms = new Map<string, Room>();

// ---- account identity (from the session cookie on the WS upgrade) ----------
// Anonymous quick-play never sets this; ranked rooms rely on it to seat players
// by account rather than by arrival order, without changing the join protocol.
// (cookie parsing lives in ./auth/cookies, shared with the social hub)

// If a seated player disconnects while their opponent is present, they have this
// long to return before forfeiting the game. Override with FORFEIT_MS.
const DISCONNECT_FORFEIT_MS = Number(process.env.FORFEIT_MS) || 90_000;
// Ranked games get a much shorter leash: long enough to survive a refresh or a
// brief network drop, short enough that a quitter doesn't strand their opponent.
// A deliberate Leave (the `leave` message) skips the countdown entirely.
const RANKED_FORFEIT_MS = Number(process.env.RANKED_FORFEIT_MS) || 20_000;

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
    botDifficulty: {},
    botThinking: false,
    isRanked: false,
    rankedGameSlug: '',
    rankedUserIds: { red: null, silver: null },
    rankedSettled: false,
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
    turnStartedAt: room.turnStartedAt,
    forfeitColor: room.forfeitColor,
    forfeitDeadline: room.forfeitDeadline,
    botDifficulty: room.botDifficulty,
    isRanked: room.isRanked,
    rankedGameSlug: room.rankedGameSlug,
    rankedUserIds: room.rankedUserIds,
    rankedSettled: room.rankedSettled,
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
    turnStartedAt: p.turnStartedAt ?? null,
    turnTimer: null,
    forfeitTimer: null,
    forfeitColor: p.forfeitColor ?? null,
    forfeitDeadline: p.forfeitDeadline ?? null,
    rematch: { red: false, silver: false },
    botDifficulty: p.botDifficulty ?? {},
    botThinking: false,
    isRanked: p.isRanked ?? false,
    rankedGameSlug: p.rankedGameSlug ?? '',
    rankedUserIds: p.rankedUserIds ?? { red: null, silver: null },
    rankedSettled: p.rankedSettled ?? false, // settlement is NOT idempotent (±1 rank, +1 win/loss)
  };
}

// ---- ranked rooms ---------------------------------------------------------
// Called by the matchmaking queue once two players are paired. Creates a room
// pre-loaded with both player IDs so rating settlement can find them after the game.
export async function createRankedRoom(redUserId: string, silverUserId: string, gameSlug: string): Promise<string> {
  const code = makeCode();
  const room = makeRoom(code, await createGame('Classic'), 0);
  room.isRanked = true;
  room.rankedGameSlug = gameSlug;
  room.rankedUserIds = { red: redUserId, silver: silverUserId };
  rooms.set(code, room);
  persist(room);
  return code;
}

// Register with the matchmaking module so it can create ranked rooms without a
// circular module dependency (matchmaking imports socialHub, gameServer imports matchmaking).
registerCreateRankedRoom('laser-chess', createRankedRoom);

// Settle rank after a ranked game ends. Called from every game-ending path
// (move win, timeout, forfeit). `rankedSettled` prevents double-execution.
async function finalizeRanked(room: Room, winner: Color) {
  if (!room.isRanked || room.rankedSettled) return;
  const { red: redId, silver: silverId } = room.rankedUserIds;
  if (!redId || !silverId) return;
  room.rankedSettled = true;
  persist(room); // durable before the awaits below, so a restart can't re-award

  const store = getStore();
  const gameSlug = room.rankedGameSlug;
  const [redRec, silverRec] = await Promise.all([
    store.getRating(redId, gameSlug),
    store.getRating(silverId, gameSlug),
  ]);

  const redRating = normalizeRating(redRec?.rating);
  const silverRating = normalizeRating(silverRec?.rating);

  const newRedRating = applyResult(redRating, winner === 'red');
  const newSilverRating = applyResult(silverRating, winner === 'silver');
  const now = Date.now();

  await Promise.all([
    store.upsertRating({
      userId: redId, gameSlug,
      rating: newRedRating,
      peakRating: Math.max(normalizeRating(redRec?.peakRating), newRedRating),
      wins: (redRec?.wins ?? 0) + (winner === 'red' ? 1 : 0),
      losses: (redRec?.losses ?? 0) + (winner === 'red' ? 0 : 1),
      updatedAt: now,
    }),
    store.upsertRating({
      userId: silverId, gameSlug,
      rating: newSilverRating,
      peakRating: Math.max(normalizeRating(silverRec?.peakRating), newSilverRating),
      wins: (silverRec?.wins ?? 0) + (winner === 'silver' ? 1 : 0),
      losses: (silverRec?.losses ?? 0) + (winner === 'silver' ? 0 : 1),
      updatedAt: now,
    }),
  ]);

  socialHub.notify(redId, {
    type: 'rating-updated',
    gameSlug,
    newRating: newRedRating,
    delta: newRedRating - redRating,
    rankName: getRank(newRedRating).name,
  });
  socialHub.notify(silverId, {
    type: 'rating-updated',
    gameSlug,
    newRating: newSilverRating,
    delta: newSilverRating - silverRating,
    rankName: getRank(newSilverRating).name,
  });
}

// Which side a signed-in account is entitled to in a ranked room, if any.
function rankedSeatFor(room: Room, userId: string | null | undefined): Color | null {
  if (!userId) return null;
  if (room.rankedUserIds.red === userId) return 'red';
  if (room.rankedUserIds.silver === userId) return 'silver';
  return null;
}

function seatOf(room: Room, playerId: string): Color | null {
  if (room.seats.red === playerId) return 'red';
  if (room.seats.silver === playerId) return 'silver';
  return null;
}

const bothSeated = (room: Room) => !!room.seats.red && !!room.seats.silver;

// ---- per-move clock (authoritative) ---------------------------------------
function stopTurnClockTimer(room: Room) {
  if (room.turnTimer) clearTimeout(room.turnTimer);
  room.turnTimer = null;
}

function stopTurnClock(room: Room) {
  stopTurnClockTimer(room);
  room.turnStartedAt = null;
}

function resetTurnClockForNewTurn(room: Room) {
  stopTurnClockTimer(room);
  room.turnStartedAt = Date.now();
  startTurnClock(room);
}

function startTurnClock(room: Room) {
  stopTurnClockTimer(room);
  if (room.perMoveMs <= 0 || room.game.winner || !bothSeated(room)) return;
  const on = presence(room);
  if (!on.red || !on.silver) return; // don't run the move clock while a player is offline

  if (room.turnStartedAt == null) {
    room.turnStartedAt = Date.now();
  }

  const elapsed = Date.now() - room.turnStartedAt;
  const remaining = room.perMoveMs - elapsed;

  if (remaining <= 0) {
    onTimeout(room);
  } else {
    room.turnTimer = setTimeout(() => onTimeout(room), remaining);
  }
}

function turnEndsIn(room: Room): number | null {
  if (room.perMoveMs <= 0 || room.turnStartedAt == null || room.game.winner) return null;
  return Math.max(0, room.perMoveMs - (Date.now() - room.turnStartedAt));
}
function onTimeout(room: Room) {
  if (room.game.winner) return;
  room.game.winner = opposite(room.game.turn); // the player on the clock loses
  stopTurnClock(room);
  persist(room);
  broadcast(room, { type: 'timeout', winner: room.game.winner });
  broadcast(room, snapshot(room));
  void finalizeRanked(room, room.game.winner).catch((e) => console.error('finalizeRanked failed:', e));
}

// ---- disconnect handling / forfeit ----------------------------------------
function clearForfeit(room: Room) {
  if (room.forfeitTimer) clearTimeout(room.forfeitTimer);
  room.forfeitTimer = null;
  room.forfeitColor = null;
  room.forfeitDeadline = null;
}
// Arm the OS timer to fire at the (already-decided) forfeit deadline. Idempotent -
// safe to call on every presence change / after rehydrating from the store.
function armForfeit(room: Room) {
  if (room.forfeitTimer) clearTimeout(room.forfeitTimer);
  room.forfeitTimer = null;
  if (room.forfeitColor == null || room.forfeitDeadline == null) return;
  room.forfeitTimer = setTimeout(() => doForfeit(room), Math.max(0, room.forfeitDeadline - Date.now()));
}
// Decide whether a forfeit countdown should be running - WITHOUT resetting one that's
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
  room.forfeitDeadline = Date.now() + (room.isRanked ? RANKED_FORFEIT_MS : DISCONNECT_FORFEIT_MS);
  armForfeit(room);
}
// End the game against `loser` right now - no countdown. Used by the disconnect
// timer and by an explicit Leave.
function forfeitNow(room: Room, loser: Color) {
  if (room.game.winner) return;
  room.game.winner = opposite(loser);
  clearForfeit(room);
  stopTurnClock(room);
  persist(room);
  broadcast(room, { type: 'forfeit', winner: room.game.winner });
  broadcast(room, snapshot(room));
  void finalizeRanked(room, room.game.winner).catch((e) => console.error('finalizeRanked failed:', e));
}

function doForfeit(room: Room) {
  const loser = room.forfeitColor;
  room.forfeitTimer = null;
  if (room.game.winner || !loser || presence(room)[loser]) return clearForfeit(room);
  forfeitNow(room, loser);
}

// Quitting a game in progress is a resignation: the opponent wins immediately and
// rank settles right away, instead of everyone waiting out the disconnect timer.
// Spectators, finished games and rooms missing an opponent just close the socket.
function onLeave(ws: Client) {
  const room = ws.room;
  if (!room || !ws.color) return;
  if (!room.game.winner && bothSeated(room)) forfeitNow(room, ws.color);
}

function presence(room: Room): PlayerSlots {
  const online: PlayerSlots = { red: false, silver: false };
  for (const ws of room.clients) if (ws.readyState === ws.OPEN && ws.color) online[ws.color] = true;
  if (room.botDifficulty.red) online.red = true;
  if (room.botDifficulty.silver) online.silver = true;
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

  wss.on('connection', (ws: Client, req: IncomingMessage) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Resolve the account (if signed in) - anonymous players simply resolve to
    // null and keep their client-chosen name. onJoin awaits `authReady` rather
    // than racing it: in a ranked room the account decides the seat.
    ws.authReady = resolveAccountFromReq(req)
      .then((acct) => {
        ws.userId = acct?.userId ?? null;
        ws.accountName = acct?.name ?? null;
      })
      .catch(() => {
        ws.userId = null;
        ws.accountName = null;
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
      // Pause the OS move clock timer while a player is gone (leaving turnStartedAt intact),
      // and drop any pending rematch request.
      if (ws.color) {
        stopTurnClockTimer(room);
        room.rematch = { red: false, silver: false };
      }
      // Start/keep the forfeit countdown (anchored to the first drop - never reset here),
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
  if (msg.type === 'leave') return onLeave(ws);
  if (msg.type === 'chat') {
    const room = ws.room;
    if (room && ws.name)
      broadcast(room, { type: 'chat', name: ws.name, color: ws.color ?? null, text: String(msg.text || '').slice(0, 240) });
  }
}

async function onJoin(ws: Client, msg: Extract<ClientMessage, { type: 'join' }>) {
  await ws.authReady; // the session cookie may still be resolving
  const playerId = String(msg.playerId || '').slice(0, 64);
  if (!playerId) return send(ws, { type: 'error', message: 'missing playerId' });
  ws.playerId = playerId;
  // A signed-in player always shows under their account's display name.
  ws.name = (ws.accountName || String(msg.name || 'Player')).slice(0, 24);

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

    const botDifficulty = DIFFICULTIES.includes(msg.vsBot as Difficulty) ? (msg.vsBot as Difficulty) : null;
    if (botDifficulty) {
      const humanWant: Color = msg.color === 'red' || msg.color === 'silver' ? msg.color : Math.random() < 0.5 ? 'red' : 'silver';
      const botColor = opposite(humanWant);
      room.seats[botColor] = `bot:${botDifficulty}:${crypto.randomUUID()}`;
      room.names[botColor] = `Bot (${botDifficulty[0].toUpperCase()}${botDifficulty.slice(1)})`;
      room.botDifficulty[botColor] = botDifficulty;
    }
  }

  // In a ranked room matchmaking already decided who plays which side, so the
  // account owns the seat - arrival order and the client's colour preference are
  // ignored, and anyone else holding the code joins as a spectator. Without this
  // the seats and `rankedUserIds` can disagree and settlement credits the wrong
  // player. Keyed on userId, not playerId, so a reconnect from another device
  // still lands in the right seat.
  let color = room.isRanked ? rankedSeatFor(room, ws.userId) : seatOf(room, playerId);
  if (!color && !room.isRanked) {
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
  maybeTriggerBot(room);
}

// Shared by both human moves (onAction) and bot moves (maybeTriggerBot) so
// there is exactly one path from "an actor wants to make this move" to
// "the authoritative engine validated it and everyone was told" - a bot is
// never a special case here, just another caller.
function applyGameAction(room: Room, color: Color, action: Action): { ok: boolean; error?: string } {
  if (room.game.winner) return { ok: false, error: 'game-over' };

  const result = applyAction(room.game, color, action);
  if (!result.ok) return { ok: false, error: result.error };

  room.game.board = result.board;
  room.game.turn = result.turn;
  room.game.winner = result.winner;
  room.game.moveCount++;

  if (result.winner) {
    stopTurnClock(room);
    void finalizeRanked(room, result.winner).catch((e) => console.error('finalizeRanked failed:', e));
  } else {
    resetTurnClockForNewTurn(room); // reset the clock for the next player's turn
  }

  persist(room);

  broadcast(room, {
    type: 'move',
    by: color,
    action,
    laser: result.laser,
    removed: result.removed,
    board: result.board,
    turn: result.turn,
    winner: result.winner,
    perMoveMs: room.perMoveMs,
    turnEndsIn: turnEndsIn(room),
  });

  maybeTriggerBot(room);
  return { ok: true };
}

function onAction(ws: Client, msg: Extract<ClientMessage, { type: 'action' }>) {
  const room = ws.room;
  if (!room) return;
  if (!ws.color) return send(ws, { type: 'error', message: 'spectators cannot move' });
  const result = applyGameAction(room, ws.color, msg.action);
  if (!result.ok) send(ws, { type: 'error', message: result.error! });
}

// If it's now a bot seat's turn, kick off a search in the worker thread and
// apply whatever it returns through the exact same applyGameAction() path
// used for human moves. botThinking guards against dispatching twice if this
// is called again (e.g. from onJoin) before the first request resolves.
function maybeTriggerBot(room: Room) {
  if (room.game.winner || room.botThinking) return;
  const color = room.game.turn;
  const difficulty = room.botDifficulty[color];
  if (!difficulty) return;

  room.botThinking = true;
  void requestBotMove(room.game, color, difficulty)
    .then((action) => {
      room.botThinking = false;
      const result = applyGameAction(room, color, action);
      if (!result.ok) console.error('bot move rejected by engine:', result.error);
    })
    .catch((e) => {
      room.botThinking = false;
      console.error('bot move failed entirely (no fallback available):', e);
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
  // A bot seat can never send a `rematch` message itself, so treat it as an
  // automatic yes - otherwise a human-vs-bot rematch would hang forever.
  const redAgreed = room.rematch.red || !!room.botDifficulty.red;
  const silverAgreed = room.rematch.silver || !!room.botDifficulty.silver;
  if (redAgreed && silverAgreed) {
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
    oldNames = { ...room.names },
    oldBotDifficulty = { ...room.botDifficulty };
  room.seats = { red: oldSeats.silver, silver: oldSeats.red };
  room.names = { red: oldNames.silver, silver: oldNames.red };
  room.botDifficulty = { red: oldBotDifficulty.silver, silver: oldBotDifficulty.red };
  // Sides swap, so the ranked account→seat map has to swap with them, otherwise
  // settlement would credit the rematch to the wrong player. Re-arm settlement
  // so the rematch counts for rank like any other ranked game.
  if (room.isRanked) {
    room.rankedUserIds = { red: room.rankedUserIds.silver, silver: room.rankedUserIds.red };
    room.rankedSettled = false;
  }
  for (const c of room.clients) {
    if (c.playerId && seatOf(room, c.playerId)) c.color = seatOf(room, c.playerId);
  }
  room.game = await createGame(setup);
  room.rematch = { red: false, silver: false };
  clearForfeit(room);
  if (bothSeated(room)) resetTurnClockForNewTurn(room);
  else stopTurnClock(room);
  persist(room);
  broadcast(room, { type: 'rematch' });
  for (const c of room.clients) send(c, { type: 'reseat', you: c.color ?? null });
  broadcast(room, snapshot(room));
  maybeTriggerBot(room);
}
