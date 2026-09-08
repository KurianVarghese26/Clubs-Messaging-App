import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Lock, User, AtSign, ArrowLeft, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

type Mode = 'signin' | 'signup' | 'reset' | 'profile';

export default function Auth() {
  return <AuthInner />;
}

function AuthInner() {
  const { user, profile, loading, profileLoading, refreshProfile } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setNotice('');
    setShowPassword(false);
  };

  // Recovery mode: user clicked the email link — Supabase redirects back here
  // with ?recovery=1, and the session is established via the URL hash.
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  // Authenticated but profile not loaded yet: NEVER render a blank page.
  // Distinguish "still fetching" (short spinner) from "fetch failed"
  // (profile setup + retry), so /auth never sits on a dark void.
  const [profileStuck, setProfileStuck] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('recovery') === '1' || window.location.hash.includes('type=recovery')) {
      setRecoveryMode(true);
      setMode('signin');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Clear a stale recovery flag once the user is fully signed in.
  useEffect(() => {
    if (!loading && user && profile && recoveryMode) setRecoveryMode(false);
  }, [loading, user, profile, recoveryMode]);

  useEffect(() => {
    setProfileStuck(false);
    if (!user || profile || loading) return;
    const t = setTimeout(() => setProfileStuck(true), 12000);
    return () => clearTimeout(t);
  }, [user, profile, loading]);

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg('');
    setError('');
    if (newPw.length < 6) {
      setPwMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPw !== newPw2) {
      setPwMsg('Passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setRecoveryMode(false);
      setNotice('Password updated. You are signed in — welcome back.');
      setNewPw('');
      setNewPw2('');
      await refreshProfile();
    } catch (err: unknown) {
      setPwMsg(err instanceof Error ? err.message : 'Could not update password. The link may have expired — request a new one.');
    } finally {
      setPwBusy(false);
    }
  };

  const googleError = () =>
    setError('Google sign-in is not configured right now. Please use email instead.');

  const doGoogle = () => {
    setError('');
    setNotice('');
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID || !import.meta.env.VITE_GOOGLE_AUTH_PROXY) {
      googleError();
      return;
    }
    setGoogleBusy(true);
    try {
      const ok = signInWithGoogle('Clubs');
      if (ok === false) googleError();
    } catch {
      googleError();
    } finally {
      setTimeout(() => setGoogleBusy(false), 2500);
    }
  };

  // Fallback: if auth state never resolves (blocked storage, hung request),
  // NEVER sit on a blank page — after 8s show the form anyway. Signing in
  // will re-sync state via onAuthStateChange.
  const [bootTimedOut, setBootTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) {
      setBootTimedOut(false);
      return;
    }
    const t = setTimeout(() => setBootTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading && !bootTimedOut) {
    return (
      <div className="min-h-screen bg-[#f6f7f6] dark:bg-slate-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo showWord={false} size={52} />
        <div className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-[#2e7d4f] animate-spin" />
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400">Loading Clubs…</p>
      </div>
    );
  }

  if (!loading && user && profile) return <Navigate to="/chats" replace />;

  // Authenticated but profile row missing/loading: setup or loader — never
  // a blank page, in every combination of loading/profileLoading flags.
  if (user && !profile) {
    if (profileLoading || loading) {
      return (
        <div className="min-h-screen bg-[#f6f7f6] dark:bg-slate-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Logo showWord={false} size={52} />
          <div className="w-7 h-7 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-[#2e7d4f] animate-spin" />
          <p className="text-[13.5px] text-slate-500 dark:text-slate-400">Loading your profile…</p>
        </div>
      );
    }
    return (
      <CompleteProfile
        userId={user.id}
        email={user.email || ''}
        onDone={refreshProfile}
        name={name}
        setName={setName}
        username={username}
        setUsername={setUsername}
        stuck={profileStuck}
        onRetry={refreshProfile}
      />
    );
  }

  // Sign-in and sign-up share the email+password fields, so guard against
  // double-submit and never leave busy stuck true after an exception.
  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // guard double-submit
    setError('');
    setNotice('');
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode !== 'reset') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (mode === 'signup' && password.length > 72) {
        setError('Password is too long (max 72 characters).');
        return;
      }
    }
    const snapMode = mode;
    const snapEmail = cleanEmail;
    const snapPw = password;
    const snapName = name.trim();
    const snapUser = username.trim();
    setBusy(true);
    try {
      if (snapMode === 'signin') {
        let data;
        try {
          const r = await supabase.auth.signInWithPassword({ email: snapEmail, password: snapPw });
          if (r.error) throw r.error;
          data = r.data;
        } catch (err: unknown) {
          const m = err instanceof Error ? err.message : String(err);
          if (/invalid login credentials/i.test(m))
            throw new Error('Wrong email or password. New here? Create an account — or reset your password below.');
          if (/email not confirmed/i.test(m))
            throw new Error('Please confirm your email first (check your inbox), then sign in.');
          if (/rate limit|too many requests/i.test(m))
            throw new Error('Too many sign-in attempts. Wait a moment and try again.');
          if (/fetch|network|failed/i.test(m))
            throw new Error('Network problem reaching the sign-in server. Check your connection and try again.');
          throw err instanceof Error ? err : new Error(m);
        }
        if (data.session) {
          // Auto-claim the reserved CEO identity on sign-in
          try {
            if (snapEmail === 'kurianvarghese26@gmail.com') {
              await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: snapEmail }),
              });
            }
          } catch {
            /* best effort — never blocks login */
          }
        }
        // Wait for the session + profile to land before navigating
        const { data: sessData } = await supabase.auth.getSession();
        if (!sessData.session) {
          const { data: u } = await supabase.auth.getUser();
          if (!u.user) throw new Error('Sign-in succeeded but no session was created. Please try again.');
        }
        await refreshProfile();
      } else if (snapMode === 'signup') {
        if (snapName.length < 2) throw new Error('Please enter your name.');
        if (!/^[a-z0-9_]{3,20}$/.test(snapUser.toLowerCase()))
          throw new Error('Username must be 3–20 characters: letters, numbers, underscores.');
        let data;
        try {
          const r = await supabase.auth.signUp({ email: snapEmail, password: snapPw });
          if (r.error) throw r.error;
          data = r.data;
        } catch (err: unknown) {
          const m = err instanceof Error ? err.message : String(err);
          if (/already registered|already exists|duplicate/i.test(m))
            throw new Error('That email already has an account. Sign in instead — or reset your password.');
          if (/rate limit|too many requests/i.test(m))
            throw new Error('Too many attempts. Wait a moment and try again.');
          if (/fetch|network|failed/i.test(m))
            throw new Error('Network problem reaching the sign-up server. Check your connection and try again.');
          if (/password/i.test(m)) throw new Error(m);
          throw err instanceof Error ? err : new Error(m);
        }
        if (data.session) {
          // Instant session (email confirmation off) — create profile now
          // (CEO email auto-claims the reserved 'ceo' username + blue tick)
          const isCeoEmail = snapEmail === 'kurianvarghese26@gmail.com';
          const res = await fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: data.session.user.id,
              username: isCeoEmail ? 'ceo' : snapUser,
              display_name: isCeoEmail ? snapName || 'Kurian Varghese' : snapName,
              bio: isCeoEmail ? 'CEO of Clubs' : undefined,
            }),
          });
          let pj: { error?: string } = {};
          try {
            pj = await res.json();
          } catch {
            throw new Error('Account created, but the profile service did not respond. Please sign in.');
          }
          if (!res.ok) throw new Error(pj.error || 'Account created, but the profile failed. Please sign in.');
          await refreshProfile();
          return;
        }
        if (data.user && !data.session) {
          // Email confirmation on — tell them to verify instead of hanging
          setNotice('Account created. Check your email for a confirmation link, then sign in.');
          switchMode('signin');
          return;
        }
        const { data: u2 } = await supabase.auth.getUser();
        const uid = u2.user?.id;
        if (uid) {
          const res = await fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: uid, username: snapUser, display_name: snapName }),
          });
          const pj = await res.json();
          if (!res.ok) throw new Error(pj.error || 'Could not create profile.');
          await refreshProfile();
        }
        switchMode('signin');
      } else if (snapMode === 'reset') {
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(snapEmail, {
            redirectTo: `${window.location.origin}/auth?recovery=1`,
          });
          if (error) throw error;
        } catch (err: unknown) {
          const m = err instanceof Error ? err.message : String(err);
          if (/rate limit/i.test(m))
            throw new Error('Too many reset emails sent. Wait a minute and try again.');
          if (/fetch|network|failed/i.test(m))
            throw new Error('Network problem. Check your connection and try again.');
          throw err instanceof Error ? err : new Error(m);
        }
        setNotice('If an account exists for that email, a recovery link is on its way. Open it on this device to set a new password.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  // Logged in but no profile yet → complete profile (uses the stuck timer
  // declared above; no duplicate hooks here — hooks must stay unconditional).
  if (!loading && user && !profile && !profileLoading) {
    return (
      <CompleteProfile
        userId={user.id}
        email={user.email || ''}
        onDone={refreshProfile}
        name={name}
        setName={setName}
        username={username}
        setUsername={setUsername}
        stuck={profileStuck}
        onRetry={refreshProfile}
      />
    );
  }

  return (
    <AuthCard
      mode={mode}
      error={error}
      notice={notice}
      recoveryMode={recoveryMode}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      name={name}
      setName={setName}
      username={username}
      setUsername={setUsername}
      busy={busy}
      googleBusy={googleBusy}
      pwBusy={pwBusy}
      pwMsg={pwMsg}
      newPw={newPw}
      setNewPw={setNewPw}
      newPw2={newPw2}
      setNewPw2={setNewPw2}
      submitEmail={submitEmail}
      updatePassword={updatePassword}
      doGoogle={doGoogle}
      switchMode={switchMode}
    />
  );
}

function AuthCard({
  mode,
  error,
  notice,
  recoveryMode,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  name,
  setName,
  username,
  setUsername,
  busy,
  googleBusy,
  pwBusy,
  pwMsg,
  newPw,
  setNewPw,
  newPw2,
  setNewPw2,
  submitEmail,
  updatePassword,
  doGoogle,
  switchMode,
}: {
  mode: Mode;
  error: string;
  notice: string;
  recoveryMode: boolean;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  name: string;
  setName: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  busy: boolean;
  googleBusy: boolean;
  pwBusy: boolean;
  pwMsg: string;
  newPw: string;
  setNewPw: (v: string) => void;
  newPw2: string;
  setNewPw2: (v: string) => void;
  submitEmail: (e: React.FormEvent) => void;
  updatePassword: (e: React.FormEvent) => void;
  doGoogle: () => void;
  switchMode: (m: Mode) => void;
}) {
  return (
    <div className="min-h-screen bg-[#f6f7f6] dark:bg-slate-950 flex flex-col">
      <div className="px-5 pt-5 flex items-center justify-between max-w-md w-full mx-auto">
        <a href="/" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft size={15} /> Back
        </a>
        <Logo />
        <div className="w-12" />
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 pb-10 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/70 dark:border-slate-800 p-6 sm:p-8"
        >
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white">
            {mode === 'signin' && 'Welcome back'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'reset' && 'Reset password'}
          </h1>
          <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1 mb-6">
            {mode === 'signin' && 'Private conversations, simple joining.'}
            {mode === 'signup' && 'Just a name and username. No phone number, ever.'}
            {mode === 'reset' && 'We’ll email you a secure recovery link.'}
          </p>

          {error && (
            <div className="mb-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-3">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-4 rounded-2xl bg-[#2e7d4f]/10 border border-[#2e7d4f]/25 text-[#1f5c39] dark:text-emerald-300 text-[13px] font-medium px-4 py-3">
              {notice}
            </div>
          )}

          {recoveryMode ? (
            <form onSubmit={updatePassword} className="space-y-3">
              <div className="mb-1 rounded-2xl bg-[#2e7d4f]/10 border border-[#2e7d4f]/25 text-[#1f5c39] dark:text-emerald-300 text-[13px] font-medium px-4 py-3">
                Recovery link verified. Choose a new password.
              </div>
              {pwMsg && (
                <div className="rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-3">
                  {pwMsg}
                </div>
              )}
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="New password (min 6)"
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-11 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPw2}
                  onChange={(e) => setNewPw2(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
                />
              </div>
              <button
                type="submit"
                disabled={pwBusy}
                className="w-full rounded-2xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[15px] py-3 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {pwBusy && <Loader2 size={17} className="animate-spin" />}
                Set new password
              </button>
            </form>
          ) : (
          <form onSubmit={submitEmail} className="space-y-3">
            {mode === 'signup' && (
              <>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    maxLength={30}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
                  />
                </div>
                <div className="relative">
                  <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    maxLength={20}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
                  />
                </div>
              </>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
              />
            </div>
            {mode !== 'reset' && (
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Create a password (min 6)' : 'Password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-11 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[15px] py-3 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={17} className="animate-spin" />}
              {mode === 'signin' && 'Sign in'}
              {mode === 'signup' && 'Create account'}
              {mode === 'reset' && 'Send recovery link'}
            </button>
          </form>
          )}

          {!recoveryMode && (
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>
          )}

          {!recoveryMode && (
          <button
            onClick={doGoogle}
            disabled={googleBusy}
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-[15px] py-3 transition flex items-center justify-center gap-2.5 text-slate-800 dark:text-slate-100 disabled:opacity-60"
          >
            {googleBusy ? (
              <Loader2 size={17} className="animate-spin text-slate-400" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9z" />
                <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.3 7.5 24 12 24z" />
                <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.2 0 12s.5 3.3 1.4 4.7l3.8-2.3z" />
                <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5z" />
              </svg>
            )}
            Continue with Google
          </button>
          )}

          {!recoveryMode && (
          <div className="mt-6 text-center text-[13.5px] text-slate-500 dark:text-slate-400 space-y-2">
            {mode === 'signin' && (
              <>
                <p>
                  New to Clubs?{' '}
                  <button onClick={() => switchMode('signup')} className="font-semibold text-[#2e7d4f] dark:text-emerald-400">
                    Create an account
                  </button>
                </p>
                <p>
                  <button onClick={() => switchMode('reset')} className="font-medium hover:underline inline-flex items-center gap-1">
                    <KeyRound size={13} /> Forgot your password?
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p>
                Already have an account?{' '}
                <button onClick={() => switchMode('signin')} className="font-semibold text-[#2e7d4f] dark:text-emerald-400">
                  Sign in
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p>
                <button onClick={() => switchMode('signin')} className="font-semibold text-[#2e7d4f] dark:text-emerald-400">
                  Back to sign in
                </button>
              </p>
            )}
          </div>
          )}

          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-500">
            We collect as little as possible: just your email, name and username.
            <br />
            No phone number. No ads. No tracking.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function CompleteProfile({
  userId,
  email,
  onDone,
  name,
  setName,
  username,
  setUsername,
  stuck,
  onRetry,
}: {
  userId: string;
  email: string;
  onDone: () => Promise<void>;
  name: string;
  setName: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  stuck?: boolean;
  onRetry?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  const [avatarColor] = useState(() => {
    const palette = ['#2e7d4f', '#3366aa', '#7a4fa3', '#b3541e', '#a33a5b', '#0e7c86'];
    return palette[Math.floor(Math.random() * palette.length)];
  });

  const doSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = '/auth';
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    const cleanName = name.trim();
    const cleanUser = username.trim().toLowerCase();
    if (cleanName.length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUser)) {
      setError('Username must be 3–20 characters: letters, numbers, underscores.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, username: cleanUser, display_name: cleanName, avatar_color: avatarColor }),
      });
      let j: { error?: string } = {};
      try {
        j = await res.json();
      } catch {
        throw new Error('Profile service did not respond. Check your connection and try again.');
      }
      if (!res.ok) throw new Error(j.error || 'Could not save profile.');
      await onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f6] dark:bg-slate-950 flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/70 dark:border-slate-800 p-6 sm:p-8">
        <Logo />
        <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white mt-5">Set up your profile</h1>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1 mb-6">
          Signed in as {email}. Pick how you’ll appear in Clubs.
        </p>
        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-3">
            {error}
          </div>
        )}
        {stuck && !error && (
          <div className="mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-[13px] font-medium px-4 py-3">
            Taking longer than usual to reach your profile. You can wait, retry, or sign out and back in.
            <span className="flex gap-2 mt-2.5">
              <button
                type="button"
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  try {
                    await onRetry?.();
                  } finally {
                    setRetrying(false);
                  }
                }}
                className="rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 text-[12.5px] font-bold px-3.5 py-1.5 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {retrying && <Loader2 size={13} className="animate-spin" />} Retry
              </button>
              <button
                type="button"
                onClick={doSignOut}
                className="rounded-xl text-[12.5px] font-bold px-3.5 py-1.5 hover:underline"
              >
                Sign out
              </button>
            </span>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={30}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
            />
          </div>
          <div className="relative">
            <AtSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              maxLength={20}
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[15px] py-3 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={17} className="animate-spin" />} Continue to Chats
          </button>
        </form>
      </div>
    </div>
  );
}
