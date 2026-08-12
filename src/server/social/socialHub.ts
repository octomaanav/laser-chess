// Global social realtime hub. Unlike the per-game WebSocket servers, this one is
// account-gated and process-wide: it tracks which signed-in users are online and
// pushes them notifications (friend requests, accepts, game invites). It carries
// NO state changes — those go through the REST API, which then calls notify().
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { resolveAccountFromReq } from '../auth/cookies';
import { getStore } from '../store';
import type { SocialUser } from './types';

// server → client events (the client never sends anything on this socket).
export type SocialEvent =
  | { type: 'hello'; userId: string }
  | { type: 'presence'; userId: string; online: boolean }
  | { type: 'friend-request'; from: SocialUser }
  | { type: 'friend-accepted'; user: SocialUser }
  | { type: 'friend-removed'; userId: string }
  | { type: 'game-invite'; from: SocialUser; gameSlug: string; code: string };

interface Sock extends WebSocket {
  userId?: string;
  friendIds?: Set<string>; // accepted friends, cached for presence fan-out
  isAlive?: boolean;
}

class SocialHub {
  private wss = new WebSocketServer({ noServer: true });
  private online = new Map<string, Set<Sock>>(); // userId → open sockets

  constructor() {
    this.wss.on('connection', (ws: Sock, req: IncomingMessage) => void this.onConnect(ws, req));
    const heartbeat = setInterval(() => {
      for (const ws of this.wss.clients as Set<Sock>) {
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
    this.wss.on('close', () => clearInterval(heartbeat));
  }

  // Called by the custom server for `/ws/social` upgrades.
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req));
  }

  private async onConnect(ws: Sock, req: IncomingMessage) {
    const acct = await resolveAccountFromReq(req).catch(() => null);
    if (!acct) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      return;
    }
    ws.userId = acct.userId;
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    ws.friendIds = await this.loadFriendIds(acct.userId);

    const wasOffline = !this.isOnline(acct.userId);
    let set = this.online.get(acct.userId);
    if (!set) this.online.set(acct.userId, (set = new Set()));
    set.add(ws);

    send(ws, { type: 'hello', userId: acct.userId });
    if (wasOffline) this.broadcastPresence(acct.userId, ws.friendIds, true);

    ws.on('close', () => {
      const s = this.online.get(acct.userId);
      s?.delete(ws);
      if (s && s.size === 0) {
        this.online.delete(acct.userId);
        this.broadcastPresence(acct.userId, ws.friendIds ?? new Set(), false);
      }
    });
  }

  private async loadFriendIds(userId: string): Promise<Set<string>> {
    const edges = await getStore().listFriendships(userId);
    return new Set(edges.filter((e) => e.status === 'accepted').map((e) => e.otherId));
  }

  // Tell a user's online friends whether they just came online / went offline.
  private broadcastPresence(userId: string, friendIds: Set<string>, isOnline: boolean) {
    for (const fid of friendIds) if (this.isOnline(fid)) this.notify(fid, { type: 'presence', userId, online: isOnline });
  }

  // ---- public API used by the REST layer / social service -------------------
  isOnline(userId: string): boolean {
    const s = this.online.get(userId);
    return !!s && s.size > 0;
  }

  notify(userId: string, event: SocialEvent) {
    const set = this.online.get(userId);
    if (!set) return;
    for (const ws of set) send(ws, event);
  }

  // Re-read a user's accepted-friend set onto their live sockets (after a
  // friendship is accepted or removed) so future presence fan-out is correct.
  async refreshFriends(userId: string) {
    const set = this.online.get(userId);
    if (!set) return;
    const ids = await this.loadFriendIds(userId);
    for (const ws of set) ws.friendIds = new Set(ids);
  }

  // After A and B become friends, sync both sides' caches and exchange current
  // presence so each immediately sees whether the other is online.
  async announceFriendship(a: string, b: string) {
    await Promise.all([this.refreshFriends(a), this.refreshFriends(b)]);
    this.notify(a, { type: 'presence', userId: b, online: this.isOnline(b) });
    this.notify(b, { type: 'presence', userId: a, online: this.isOnline(a) });
  }
}

function send(ws: WebSocket, event: SocialEvent) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
}

// One hub for the whole process. The custom server (server.mts, run via tsx) and
// the Next route handlers (bundled separately) load this module in two different
// module registries, so a plain `new SocialHub()` would give each its OWN hub —
// sockets would register on one while REST notify()/isOnline() hit the other.
// Pinning the instance to globalThis makes both share the same in-memory hub.
declare global {
  // eslint-disable-next-line no-var
  var __gameNightSocialHub: SocialHub | undefined;
}
export const socialHub: SocialHub = (globalThis.__gameNightSocialHub ??= new SocialHub());
