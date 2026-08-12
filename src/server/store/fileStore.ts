// Local-dev backend: setups + admin secret in ./data/*.json. Rooms are not
// persisted in dev (kept in memory, as before) — that only matters in prod.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SetupDef } from '../../game/types';
import type { FriendEdge, OAuthIdentity, PersistedCoupRoom, PersistedRoom, Store, User } from './types';

const dir = () => path.join(process.cwd(), 'data');
const setupsFile = () => path.join(dir(), 'setups.json');
const secretFile = () => path.join(dir(), 'adminSecret.json');
const usersFile = () => path.join(dir(), 'users.json');
const friendsFile = () => path.join(dir(), 'friends.json');

interface UsersData {
  users: Record<string, User>; // keyed by id
  identities: OAuthIdentity[];
}

// A friendship is stored once per pair as requester → addressee.
interface FriendRow {
  requesterId: string;
  addresseeId: string;
  status: 'pending' | 'accepted';
  createdAt: number;
  updatedAt: number;
}
interface FriendsData {
  edges: FriendRow[];
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}
function writeJSON(file: string, obj: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

export class FileStore implements Store {
  async getCustomSetups(): Promise<Record<string, SetupDef>> {
    return readJSON<Record<string, SetupDef>>(setupsFile(), {});
  }
  async saveSetup(def: SetupDef): Promise<void> {
    const c = readJSON<Record<string, SetupDef>>(setupsFile(), {});
    c[def.name] = def;
    writeJSON(setupsFile(), c);
  }
  async deleteSetup(name: string): Promise<void> {
    const c = readJSON<Record<string, SetupDef>>(setupsFile(), {});
    delete c[name];
    writeJSON(setupsFile(), c);
  }
  async getSecret(): Promise<string> {
    const s = readJSON<{ sessionSecret?: string }>(secretFile(), {});
    if (s.sessionSecret) return s.sessionSecret;
    const secret = crypto.randomBytes(32).toString('hex');
    writeJSON(secretFile(), { sessionSecret: secret });
    return secret;
  }
  // rooms: not persisted in dev
  async loadRoom(): Promise<PersistedRoom | null> {
    return null;
  }
  async saveRoom(): Promise<void> {}
  async deleteRoom(): Promise<void> {}
  async sweepRooms(): Promise<void> {}

  // coup rooms: not persisted in dev
  async loadCoupRoom(): Promise<PersistedCoupRoom | null> {
    return null;
  }
  async saveCoupRoom(): Promise<void> {}
  async deleteCoupRoom(): Promise<void> {}
  async sweepCoupRooms(): Promise<void> {}

  // users: persisted (accounts should outlive a dev restart, like setups)
  private readUsers(): UsersData {
    return readJSON<UsersData>(usersFile(), { users: {}, identities: [] });
  }
  async createUser(user: User): Promise<void> {
    const data = this.readUsers();
    data.users[user.id] = user;
    writeJSON(usersFile(), data);
  }
  async getUserById(id: string): Promise<User | null> {
    return this.readUsers().users[id] ?? null;
  }
  async getUserByEmail(email: string): Promise<User | null> {
    const e = email.toLowerCase();
    return Object.values(this.readUsers().users).find((u) => u.email === e) ?? null;
  }
  async getUserByUsername(username: string): Promise<User | null> {
    const u = username.toLowerCase();
    return Object.values(this.readUsers().users).find((x) => x.username === u) ?? null;
  }
  async updateUser(id: string, patch: Partial<Pick<User, 'username' | 'displayName' | 'passwordHash'>>): Promise<void> {
    const data = this.readUsers();
    const user = data.users[id];
    if (!user) return;
    data.users[id] = { ...user, ...patch };
    writeJSON(usersFile(), data);
  }
  async getUserByIdentity(provider: string, providerId: string): Promise<User | null> {
    const data = this.readUsers();
    const link = data.identities.find((i) => i.provider === provider && i.providerId === providerId);
    return link ? (data.users[link.userId] ?? null) : null;
  }
  async linkIdentity(identity: OAuthIdentity): Promise<void> {
    const data = this.readUsers();
    if (!data.identities.some((i) => i.provider === identity.provider && i.providerId === identity.providerId)) {
      data.identities.push(identity);
      writeJSON(usersFile(), data);
    }
  }
  async listIdentities(userId: string): Promise<OAuthIdentity[]> {
    return this.readUsers().identities.filter((i) => i.userId === userId);
  }

  // friendships (persisted like users, so they survive a dev restart)
  private readFriends(): FriendsData {
    return readJSON<FriendsData>(friendsFile(), { edges: [] });
  }
  private findEdge(edges: FriendRow[], a: string, b: string): FriendRow | undefined {
    return edges.find(
      (e) => (e.requesterId === a && e.addresseeId === b) || (e.requesterId === b && e.addresseeId === a),
    );
  }
  async createFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
    const data = this.readFriends();
    if (this.findEdge(data.edges, requesterId, addresseeId)) return; // an edge already exists
    const now = Date.now();
    data.edges.push({ requesterId, addresseeId, status: 'pending', createdAt: now, updatedAt: now });
    writeJSON(friendsFile(), data);
  }
  async acceptFriendRequest(addresseeId: string, requesterId: string): Promise<void> {
    const data = this.readFriends();
    const edge = data.edges.find((e) => e.requesterId === requesterId && e.addresseeId === addresseeId && e.status === 'pending');
    if (!edge) return;
    edge.status = 'accepted';
    edge.updatedAt = Date.now();
    writeJSON(friendsFile(), data);
  }
  async deleteFriendship(userId: string, otherId: string): Promise<void> {
    const data = this.readFriends();
    const next = data.edges.filter((e) => !this.findEdge([e], userId, otherId));
    if (next.length !== data.edges.length) writeJSON(friendsFile(), { edges: next });
  }
  async listFriendships(userId: string): Promise<FriendEdge[]> {
    return this.readFriends()
      .edges.filter((e) => e.requesterId === userId || e.addresseeId === userId)
      .map((e) => ({
        otherId: e.requesterId === userId ? e.addresseeId : e.requesterId,
        status: e.status,
        direction: e.requesterId === userId ? 'outgoing' : 'incoming',
      }));
  }
}
