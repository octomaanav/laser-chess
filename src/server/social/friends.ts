// Social service: friend requests, responses, unfriend, and the aggregate state
// the client renders. Enforces the rules in one place and pushes realtime updates
// through the social hub. All functions operate on trusted, already-authenticated
// user ids (the REST layer resolves the caller via currentUser()).
import { getStore } from '../store';
import { AuthError } from '../auth/users';
import { socialHub } from './socialHub';
import { toSocialUser, type SocialUser } from './types';

export interface SocialState {
  friends: (SocialUser & { online: boolean })[];
  incoming: SocialUser[]; // requests awaiting my response
  outgoing: SocialUser[]; // requests I've sent, awaiting theirs
}

async function socialById(id: string): Promise<SocialUser | null> {
  const u = await getStore().getUserById(id);
  return u ? toSocialUser(u) : null;
}

// The full social picture for one user, hydrated with display info + presence.
export async function getSocialState(userId: string): Promise<SocialState> {
  const edges = await getStore().listFriendships(userId);
  const state: SocialState = { friends: [], incoming: [], outgoing: [] };
  for (const e of edges) {
    const u = await socialById(e.otherId);
    if (!u) continue; // account was deleted
    if (e.status === 'accepted') state.friends.push({ ...u, online: socialHub.isOnline(u.id) });
    else if (e.direction === 'incoming') state.incoming.push(u);
    else state.outgoing.push(u);
  }
  state.friends.sort((a, b) => Number(b.online) - Number(a.online) || a.displayName.localeCompare(b.displayName));
  return state;
}

// Send a friend request by exact @username. If the target already sent me one,
// this accepts it instead (so a mutual "add" just becomes friends).
export async function sendRequestByUsername(userId: string, username: string): Promise<{ user: SocialUser; accepted: boolean }> {
  const handle = String(username || '').trim().replace(/^@/, '').toLowerCase();
  if (!handle) throw new AuthError('Enter a username.');
  const target = await getStore().getUserByUsername(handle);
  if (!target) throw new AuthError('No player with that username.', 404);
  if (target.id === userId) throw new AuthError("You can't add yourself.");

  const existing = (await getStore().listFriendships(userId)).find((e) => e.otherId === target.id);
  if (existing?.status === 'accepted') throw new AuthError(`You're already friends with @${target.username}.`, 409);
  if (existing?.direction === 'outgoing') throw new AuthError('Request already sent.', 409);
  if (existing?.direction === 'incoming') {
    // they already asked us → accept and become friends
    await respondToRequest(userId, target.id, true);
    return { user: toSocialUser(target), accepted: true };
  }

  await getStore().createFriendRequest(userId, target.id);
  const me = await socialById(userId);
  if (me) socialHub.notify(target.id, { type: 'friend-request', from: me });
  return { user: toSocialUser(target), accepted: false };
}

// Accept or deny an incoming request from `requesterId`.
export async function respondToRequest(userId: string, requesterId: string, accept: boolean): Promise<void> {
  if (accept) {
    await getStore().acceptFriendRequest(userId, requesterId);
    await socialHub.announceFriendship(userId, requesterId);
    const me = await socialById(userId);
    if (me) socialHub.notify(requesterId, { type: 'friend-accepted', user: me });
  } else {
    await getStore().deleteFriendship(userId, requesterId);
    await socialHub.refreshFriends(requesterId);
  }
}

export async function unfriend(userId: string, otherId: string): Promise<void> {
  await getStore().deleteFriendship(userId, otherId);
  await Promise.all([socialHub.refreshFriends(userId), socialHub.refreshFriends(otherId)]);
  socialHub.notify(otherId, { type: 'friend-removed', userId });
}

// True iff `a` and `b` are accepted friends (guards game invites).
export async function areFriends(a: string, b: string): Promise<boolean> {
  const edges = await getStore().listFriendships(a);
  return edges.some((e) => e.otherId === b && e.status === 'accepted');
}
