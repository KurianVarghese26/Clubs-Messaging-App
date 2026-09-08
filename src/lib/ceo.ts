import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const CEO_EMAIL = 'kurianvarghese26@gmail.com';
export const CEO_USERNAME = 'ceo';

export function isCeoEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === CEO_EMAIL;
}

export function isCeoUsername(username?: string | null): boolean {
  return (username || '').trim().toLowerCase().replace(/^@/, '') === CEO_USERNAME;
}

interface CeoInfo {
  id: string | null;
  username: string | null;
}

let cache: { info: CeoInfo; t: number } | null = null;
let inflight: Promise<CeoInfo> | null = null;

export async function fetchCeo(): Promise<CeoInfo> {
  if (cache && Date.now() - cache.t < 5 * 60_000) return cache.info;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      const info: CeoInfo = {
        id: res.ok && data?.ceo?.user_id ? (data.ceo.user_id as string) : null,
        username: res.ok && data?.ceo?.username ? (data.ceo.username as string) : null,
      };
      cache = { info, t: Date.now() };
      return info;
    } catch {
      return cache?.info ?? { id: null, username: null };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function fetchCeoId(): Promise<string | null> {
  return (await fetchCeo()).id;
}

export function useCeo() {
  const { user, profile } = useAuth();
  const [info, setInfo] = useState<CeoInfo>(cache?.info ?? { id: null, username: null });

  useEffect(() => {
    let live = true;
    fetchCeo().then((i) => {
      if (live) setInfo(i);
    });
    return () => {
      live = false;
    };
  }, []);

  const myUsername = (profile as { username?: string } | null)?.username;
  const isCeo =
    isCeoEmail(user?.email) ||
    isCeoUsername(myUsername) ||
    (!!user && !!info.id && user.id === info.id);
  const isCeoId = (id?: string | null) => !!id && !!info.id && id === info.id;
  const isCeoName = (u?: string | null) => isCeoUsername(u);

  return { ceoId: info.id, ceoUsername: info.username, isCeo, isCeoId, isCeoName };
}
