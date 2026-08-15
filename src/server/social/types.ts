// The shape of another player as exposed to friends - deliberately excludes
// email and anything private. Used across the social hub, service, and API.
import type { User } from '../store';
import type { PublicUser } from '../auth/users';

export interface SocialUser {
  id: string;
  username: string;
  displayName: string;
}

export function toSocialUser(u: User | PublicUser): SocialUser {
  return { id: u.id, username: u.username, displayName: u.displayName };
}
