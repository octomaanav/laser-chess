import { FileStore } from './fileStore';
import { PgStore } from './pgStore';
import type { Store } from './types';

let store: Store | null = null;

// One store for the process: Postgres when DATABASE_URL is set, else local files.
export function getStore(): Store {
  if (store) return store;
  const url = process.env.DATABASE_URL;
  store = url ? new PgStore(url) : new FileStore();
  return store;
}

export type { Store, PersistedRoom, PersistedCoupRoom, User, OAuthIdentity } from './types';
