import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import supabase from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  discoverable: boolean;
  private_mode?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  prefs: Prefs;
  updatePrefs: (p: Partial<Prefs>) => void;
}

export interface Prefs {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  messagePreview: boolean;
  sound: boolean;
  readReceipts: boolean;
  lastSeen: boolean;
}

const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  notifications: true,
  messagePreview: true,
  sound: false,
  readReceipts: true,
  lastSeen: true,
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem('clubs:prefs');
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: false,
  refreshProfile: async () => undefined,
  signOut: async () => undefined,
  prefs: DEFAULT_PREFS,
  updatePrefs: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  const fetchProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      let res: Response;
      try {
        res = await fetch(`/api/profiles?id=${encodeURIComponent(uid)}`, { signal: ctrl.signal });
      } finally {
        clearTimeout(t);
      }
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else if (res.status === 404) {
        // Auth user exists but profile row missing — NOT signed out; caller
        // routes to profile setup instead of a blank page.
        setProfile(null);
      } else {
        // Transient server error: keep any existing profile so the app never
        // blanks out; only null when we never had one.
        setProfile((prev) => prev);
      }
    } catch {
      // Network/abort: same rule — never wipe a known-good profile.
      setProfile((prev) => prev);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // Safety net: profile fetch must always resolve. If it hangs (offline /
  // stalled request), release the spinner so routes stop showing a blank page.
  const profileWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (profileLoading) {
      if (profileWatchdog.current) clearTimeout(profileWatchdog.current);
      profileWatchdog.current = setTimeout(() => setProfileLoading(false), 15000);
    } else if (profileWatchdog.current) {
      clearTimeout(profileWatchdog.current);
      profileWatchdog.current = null;
    }
    return () => {
      if (profileWatchdog.current) {
        clearTimeout(profileWatchdog.current);
        profileWatchdog.current = null;
      }
    };
  }, [profileLoading]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
      if (sess?.user) fetchProfile(sess.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    try {
      localStorage.removeItem('clubs:lastTab');
    } catch {
      /* ignore */
    }
  }, []);

  const updatePrefs = useCallback((p: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem('clubs:prefs', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [prefs.theme]);

  const value = useMemo(
    () => ({ user, session, profile, loading, profileLoading, refreshProfile, signOut, prefs, updatePrefs }),
    [user, session, profile, loading, profileLoading, refreshProfile, signOut, prefs, updatePrefs]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
