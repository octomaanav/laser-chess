// Client-side session state. Probes /api/auth/me on mount and exposes the signed-in
// account (or null) plus which OAuth providers are configured, so the lobby and the
// account page can share one source of truth.
'use client';
import { useCallback, useEffect, useState } from 'react';

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
}
export interface Providers {
  google: boolean;
  github: boolean;
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [providers, setProviders] = useState<Providers>({ google: false, github: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' });
      const d: { user: SessionUser | null; providers: Providers } = await r.json();
      setUser(d.user);
      setProviders(d.providers);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  return { user, providers, loading, refresh, logout, setUser };
}
