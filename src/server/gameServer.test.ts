// src/server/gameServer.test.ts
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { ServerMessage } from '../game/messages';

type Rating = { userId: string; rating: number; stars?: number; peakRating: number; wins: number; losses: number };
const ratings = new Map<string, Rating>();
const savedRooms: { code: string; botDifficulty: Record<string, string> }[] = [];
const matches: { status: string; winnerColor: string | null }[] = [];

// Each test socket names its account in a header instead of a session cookie.
vi.mock('./auth/cookies', () => ({
  resolveAccountFromReq: async (req: IncomingMessage) => {
    const userId = req.headers['x-test-user'];
    return typeof userId === 'string' ? { userId, name: userId } : null;
  },
}));

vi.mock('./botWorker', () => ({
  requestBotMove: () => new Promise(() => {}), // bots never need to actually move here
}));

vi.mock('./store', () => ({
  getStore: () => ({
    getCustomSetups: async () => ({}),
    getRating: async (userId: string) => ratings.get(userId) ?? null,
    upsertRating: async (r: Rating) => {
      ratings.set(r.userId, r);
    },
    saveRoom: async (room: { code: string; botDifficulty: Record<string, string> }) => {
      savedRooms.push(structuredClone(room));
    },
    loadRoom: async () => null,
    recordMatch: async (m: { status: string; winnerColor: string | null }) => {
      matches.push(m);
    },
    sweepRooms: async () => {},
  }),
}));

const { createGameWss, createRankedBotRoom, createRankedRoom } = await import('./gameServer');

let server: Server;
let port: number;

beforeAll(async () => {
  const wss = createGameWss();
  server = createServer();
  server.on('upgrade', (req, socket, head) => wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req)));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

type Msg<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;
type StateMsg = Msg<'state'>;

interface TestClient {
  send: (msg: object) => void;
  next: <T extends ServerMessage['type']>(type: T, where?: (m: Msg<T>) => boolean) => Promise<Msg<T>>;
  close: () => void;
}

function connect(userId?: string): Promise<TestClient> {
  const ws = new WebSocket(`ws://localhost:${port}`, { headers: userId ? { 'x-test-user': userId } : {} });
  const inbox: ServerMessage[] = [];
  const waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  ws.on('message', (buf) => {
    const msg = JSON.parse(buf.toString()) as ServerMessage;
    const i = waiters.findIndex((w) => w.match(msg));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  });
  const next = <T extends ServerMessage['type']>(type: T, where: (m: Msg<T>) => boolean = () => true) =>
    new Promise<Msg<T>>((resolve) => {
      const match = (m: ServerMessage) => m.type === type && where(m as Msg<T>);
      const i = inbox.findIndex(match);
      if (i >= 0) resolve(inbox.splice(i, 1)[0] as Msg<T>);
      else waiters.push({ match, resolve: resolve as (m: ServerMessage) => void });
    });
  return new Promise((resolve) =>
    ws.once('open', () => resolve({ send: (m) => ws.send(JSON.stringify(m)), next, close: () => ws.close() })),
  );
}

// A casual human-vs-human game with both players seated.
async function casualGame() {
  const red = await connect();
  red.send({ type: 'join', playerId: 'p-red', name: 'Red', color: 'red' });
  const { code } = await red.next('joined');
  const silver = await connect();
  silver.send({ type: 'join', playerId: 'p-silver', name: 'Silver', code });
  await silver.next('joined');
  await red.next('state', (m) => m.seated.red && m.seated.silver);
  return { code, red, silver };
}

describe('resign', () => {
  it('ends the game for the resigning player', async () => {
    const { red, silver } = await casualGame();
    red.send({ type: 'resign' });
    expect(await silver.next('resign')).toEqual({ type: 'resign', winner: 'silver' });
    expect(matches.at(-1)).toMatchObject({ status: 'resigned', winnerColor: 'silver' });
    red.close();
    silver.close();
  });
});

describe('draw offers', () => {
  it('draws when the opponent accepts', async () => {
    const { red, silver } = await casualGame();
    red.send({ type: 'draw-offer' });
    await silver.next('state', (m) => m.drawOffer === 'red');

    silver.send({ type: 'draw-offer' }); // offering back accepts
    expect(await red.next('draw')).toEqual({ type: 'draw', reason: 'agreement' });
    const final: StateMsg = await red.next('state', (m) => m.draw != null);
    expect(final).toMatchObject({ draw: 'agreement', winner: null, drawOffer: null });
    expect(matches.at(-1)).toMatchObject({ status: 'draw', winnerColor: null });

    red.send({ type: 'action', action: { type: 'rotate', x: 0, y: 0, orient: 2 } });
    expect(await red.next('error')).toMatchObject({ message: 'game-over' });
    red.close();
    silver.close();
  });

  it('allows one offer per move after a decline', async () => {
    const { red, silver } = await casualGame();
    red.send({ type: 'draw-offer' });
    await silver.next('state', (m) => m.drawOffer === 'red');
    silver.send({ type: 'draw-decline' });
    expect(await red.next('draw-declined')).toEqual({ type: 'draw-declined', by: 'silver' });

    red.send({ type: 'draw-offer' });
    expect(await red.next('error')).toMatchObject({ message: 'you can offer a draw again after the next move' });
    red.close();
    silver.close();
  });

  it('is declined straight away by a bot', async () => {
    const human = await connect();
    human.send({ type: 'join', playerId: 'p-vs-bot', name: 'Human', color: 'red', vsBot: 'easy' });
    await human.next('joined');
    human.send({ type: 'draw-offer' });
    expect(await human.next('draw-declined')).toEqual({ type: 'draw-declined', by: 'silver' });
    human.close();
  });

  it('leaves both ranks unchanged in a ranked game', async () => {
    ratings.set('ranked-red', { userId: 'ranked-red', rating: 6, stars: 1, peakRating: 6, wins: 3, losses: 0 });
    ratings.set('ranked-silver', { userId: 'ranked-silver', rating: 6, stars: 2, peakRating: 6, wins: 0, losses: 3 });
    const code = await createRankedRoom('ranked-red', 'ranked-silver', 'laser-chess');
    const red = await connect('ranked-red');
    red.send({ type: 'join', playerId: 'rr', name: 'x', code });
    const silver = await connect('ranked-silver');
    silver.send({ type: 'join', playerId: 'rs', name: 'x', code });
    await red.next('state', (m) => m.seated.red && m.seated.silver);

    red.send({ type: 'draw-offer' });
    await silver.next('state', (m) => m.drawOffer === 'red');
    silver.send({ type: 'draw-offer' });
    await red.next('draw');

    expect(ratings.get('ranked-red')).toMatchObject({ rating: 6, stars: 1, wins: 3, losses: 0 });
    expect(ratings.get('ranked-silver')).toMatchObject({ rating: 6, stars: 2, wins: 0, losses: 3 });
    red.close();
    silver.close();
  });
});

describe('ranked settlement', () => {
  it('awards a star to the winner and takes one from the loser', async () => {
    ratings.set('star-red', { userId: 'star-red', rating: 6, stars: 1, peakRating: 6, wins: 0, losses: 0 });
    ratings.set('star-silver', { userId: 'star-silver', rating: 6, stars: 0, peakRating: 6, wins: 0, losses: 0 });
    const code = await createRankedRoom('star-red', 'star-silver', 'laser-chess');
    const red = await connect('star-red');
    red.send({ type: 'join', playerId: 'sr', name: 'x', code });
    const silver = await connect('star-silver');
    silver.send({ type: 'join', playerId: 'ss', name: 'x', code });
    await red.next('state', (m) => m.seated.red && m.seated.silver);

    silver.send({ type: 'resign' });
    await vi.waitFor(() => expect(ratings.get('star-silver')?.losses).toBe(1));
    expect(ratings.get('star-red')).toMatchObject({ rating: 6, stars: 2, wins: 1 }); // Gold 1, 2/3 stars
    expect(ratings.get('star-silver')).toMatchObject({ rating: 5, stars: 1, losses: 1 }); // Silver 3, 1/2 stars
    red.close();
    silver.close();
  });
});

describe('ranked bot rematch', () => {
  it('re-picks the bot difficulty from the rank the human has after the last game', async () => {
    const HUMAN = 'human-1';
    // Diamond 1 with no stars faces the extreme bot; a loss drops to Platinum 3 (hard).
    ratings.set(HUMAN, { userId: HUMAN, rating: 12, stars: 0, peakRating: 12, wins: 0, losses: 0 });
    const code = await createRankedBotRoom(HUMAN, 'silver', 'extreme', 'Elena Rostova', 'laser-chess');

    const human = await connect(HUMAN);
    human.send({ type: 'join', playerId: 'p-human', name: 'Human', code });
    await human.next('state');

    human.send({ type: 'resign' });
    await vi.waitFor(() => expect(ratings.get(HUMAN)).toMatchObject({ rating: 11, stars: 2 }));

    human.send({ type: 'rematch' });
    await human.next('rematch');

    expect(savedRooms.filter((r) => r.code === code).at(-1)?.botDifficulty).toEqual({ silver: 'hard' });
    human.close();
  });
});
