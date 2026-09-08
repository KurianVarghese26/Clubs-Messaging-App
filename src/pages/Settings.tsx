import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, LogOut, Moon, Sun, Bell, BellOff, Eye, EyeOff, ShieldCheck, Trash2, User, MonitorSmartphone, Lock, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import VerifiedTick from '../components/VerifiedTick';
import Logo from '../components/Logo';
import { CEO_EMAIL, useCeo } from '../lib/ceo';
import { AVATAR_COLORS, uploadFile } from '../lib/utils';

export default function Settings({ notify }: { notify: (t: string) => void }) {
  const { user, profile, refreshProfile, signOut, prefs, updatePrefs } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'account' | 'privacy' | 'appearance' | 'about'>('account');
  const [name, setName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || AVATAR_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ceoBusy, setCeoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { isCeo } = useCeo();
  const showCeoCard = isCeo || (user?.email || '').toLowerCase() === CEO_EMAIL;

  const bootstrapCeo = async () => {
    setCeoBusy(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: CEO_EMAIL }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not verify CEO status.');
      await refreshProfile();
      notify(`CEO verified${data.upgraded ? ` · upgraded in ${data.upgraded} Club${data.upgraded === 1 ? '' : 's'}` : ''}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not verify CEO status.');
    } finally {
      setCeoBusy(false);
    }
  };

  // Keep local form in sync when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setUsername(profile.username);
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url);
      setAvatarColor(profile.avatar_color || AVATAR_COLORS[0]);
    }
  }, [profile?.id]);

  const pickAvatar = async (f: File | undefined) => {
    if (!f || !f.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(f, 'avatars');
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          display_name: name.trim(),
          username: username.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
          avatar_color: avatarColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      await refreshProfile();
      notify('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const setDiscoverable = async (v: boolean) => {
    if (!user) return;
    updatePrefs({} as never); // keep prefs stable, profile flag is server-side
    try {
      const res = await fetch('/api/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, discoverable: v }),
      });
      if (!res.ok) throw new Error('Could not update.');
      await refreshProfile();
      notify(v ? 'You can be found by search' : 'Search discovery off');
    } catch {
      notify('Could not update privacy setting');
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      await fetch(`/api/profiles?id=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      await signOut();
      navigate('/');
    } catch {
      notify('Could not delete account');
    }
  };

  const logout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <Link to="/chats" className="p-2.5 -ml-2 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300" aria-label="Back">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-[22px] font-bold tracking-tight">Settings</h1>
        </div>
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {(['account', 'privacy', 'appearance', 'about'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize whitespace-nowrap transition ${
                tab === t
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="max-w-lg mx-auto pb-10">
          {tab === 'account' && (
            <div>
              {showCeoCard && (
                <div className="mb-4 rounded-3xl border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/30 p-4 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={17} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] inline-flex items-center gap-1.5">
                      CEO of Clubs
                      <VerifiedTick userId={user?.id} email={user?.email} username={profile?.username} size={15} />
                    </div>
                    <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {CEO_EMAIL} · carries admin rights across Clubs and a verified blue tick everywhere.
                    </p>
                    <button
                      onClick={bootstrapCeo}
                      disabled={ceoBusy}
                      className="mt-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[12.5px] font-semibold px-4 py-2 transition disabled:opacity-60 inline-flex items-center gap-1.5"
                    >
                      {ceoBusy && <Loader2 size={14} className="animate-spin" />}
                      Verify CEO status
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 mb-5">
                <button onClick={() => fileRef.current?.click()} className="relative shrink-0 group">
                  <Avatar name={name || profile?.display_name || '?'} imageUrl={avatarUrl} color={avatarColor} size={72} />
                  <span className="absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    {uploading ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
                  </span>
                </button>
                <div>
                  <div className="font-bold text-[17px] inline-flex items-center gap-1.5">
                    {profile?.display_name}
                    <VerifiedTick userId={user?.id} email={user?.email} username={profile?.username} size={17} />
                  </div>
                  <div className="text-[13px] text-slate-500">@{profile?.username}</div>
                  <div className="text-[12px] text-slate-400 mt-0.5">{user?.email}</div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0])} />
                </div>
              </div>

              <div className="mb-3">
                <span className="block text-[13px] font-semibold mb-1.5">Avatar colour</span>
                <div className="flex gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button key={c} onClick={() => setAvatarColor(c)} className="w-8 h-8 rounded-full" style={{ backgroundColor: c }} aria-label={c}>
                      {avatarColor === c && <User size={13} className="text-white mx-auto" />}
                    </button>
                  ))}
                  {avatarUrl && (
                    <button onClick={() => setAvatarUrl(null)} className="text-[12px] font-semibold text-slate-400 hover:text-red-500 ml-1">
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-2.5">
                  {error}
                </div>
              )}

              <label className="block mb-3">
                <span className="block text-[13px] font-semibold mb-1.5">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-[15px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20" />
              </label>
              <label className="block mb-3">
                <span className="block text-[13px] font-semibold mb-1.5">Username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={20} className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-[15px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20" />
              </label>
              <label className="block mb-4">
                <span className="block text-[13px] font-semibold mb-1.5">Bio <span className="font-normal text-slate-400">(optional)</span></span>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={2} placeholder="A line about you…" className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-[15px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20 resize-none" />
              </label>

              <button
                onClick={save}
                disabled={saving || uploading}
                className="w-full rounded-2xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[15px] py-3 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={17} className="animate-spin" />} Save profile
              </button>

              <button
                onClick={logout}
                className="mt-3 w-full rounded-2xl bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[14.5px] py-3 transition flex items-center justify-center gap-2"
              >
                <LogOut size={16} /> Sign out
              </button>

              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="mt-2 w-full text-[13px] font-semibold text-slate-400 hover:text-red-500 py-2 flex items-center justify-center gap-1.5 transition">
                  <Trash2 size={14} /> Delete account
                </button>
              ) : (
                <div className="mt-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 p-4">
                  <p className="text-[13px] text-red-700 dark:text-red-300 font-medium">Delete your account and profile? Your messages remain but lose their sender link.</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl bg-white dark:bg-slate-800 text-[13px] font-semibold py-2">Keep it</button>
                    <button onClick={deleteAccount} className="flex-1 rounded-xl bg-red-600 text-white text-[13px] font-semibold py-2">Delete</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'privacy' && (
            <div className="space-y-3">
              <PrivateModeCard notify={notify} />
              <ToggleRow
                icon={profile?.discoverable === false ? <EyeOff size={17} /> : <Eye size={17} />}
                title="Discoverable in search"
                body="When on, people can find you by name or username to start a chat."
                on={profile?.discoverable !== false}
                onFlip={() => setDiscoverable(profile?.discoverable === false)}
              />
              <ToggleRow
                icon={prefs.readReceipts ? <Eye size={17} /> : <EyeOff size={17} />}
                title="Send read position"
                body="Lets chats mark messages as read when you open them."
                on={prefs.readReceipts}
                onFlip={() => updatePrefs({ readReceipts: !prefs.readReceipts })}
              />
              <ToggleRow
                icon={<ShieldCheck size={17} />}
                title="Hide last-seen style metadata"
                body="Clubs keeps presence minimal — there are no online indicators or typing broadcasts."
                on={prefs.lastSeen}
                onFlip={() => updatePrefs({ lastSeen: !prefs.lastSeen })}
              />
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5">
                <div className="font-bold text-[14.5px]">What we store</div>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Your email (login only), name, username, optional bio and photo. Messages you send. Club numbers and
                  passkey <em>hashes</em> — never plaintext passkeys. Nothing else. No phone number, no contacts upload,
                  no ads profile.
                </p>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="space-y-3">
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5">
                <div className="font-bold text-[14.5px] mb-3">Theme</div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'light', icon: <Sun size={16} />, label: 'Light' },
                    { v: 'dark', icon: <Moon size={16} />, label: 'Dark' },
                    { v: 'system', icon: <MonitorSmartphone size={16} />, label: 'System' },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      onClick={() => updatePrefs({ theme: o.v })}
                      className={`rounded-2xl border py-3 flex flex-col items-center gap-1.5 text-[13px] font-semibold transition ${
                        prefs.theme === o.v
                          ? 'border-[#2e7d4f] bg-[#2e7d4f]/10 text-[#1f5c39] dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      {o.icon}
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <ToggleRow
                icon={prefs.notifications ? <Bell size={17} /> : <BellOff size={17} />}
                title="Notifications"
                body="Show in-app toasts for incoming activity. (Push is intentionally off — fewer pings, more calm.)"
                on={prefs.notifications}
                onFlip={() => {
                  updatePrefs({ notifications: !prefs.notifications });
                  notify(!prefs.notifications ? 'Notifications on' : 'Notifications off');
                }}
              />
              <ToggleRow
                icon={<Eye size={17} />}
                title="Message previews"
                body="Show message text in the Chats list. Turn off for extra discretion."
                on={prefs.messagePreview}
                onFlip={() => updatePrefs({ messagePreview: !prefs.messagePreview })}
              />
            </div>
          )}

          {tab === 'about' && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 text-center">
              <div className="flex justify-center">
                <Logo />
              </div>
              <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
                Private conversations. Simple joining.
                <br />
                Clubs 1.0 · Serious, minimal, yours.
              </p>
              <div className="mt-4 text-[12px] text-slate-400 leading-relaxed">
                Passkeys are hashed with SHA-256. Club lookups and passkey attempts are rate-limited. Realtime delivery
                over encrypted WebSockets.
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ToggleRow({ icon, title, body, on, onFlip }: { icon: React.ReactNode; title: string; body: string; on: boolean; onFlip: () => void }) {
  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 flex items-start gap-3.5">
      <span className="w-9 h-9 rounded-2xl bg-[#2e7d4f]/10 text-[#2e7d4f] dark:text-emerald-400 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[14.5px]">{title}</div>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{body}</p>
      </div>
      <button
        onClick={onFlip}
        role="switch"
        aria-checked={on}
        className={`w-11 shrink-0 rounded-full transition-colors relative ${on ? 'bg-[#2e7d4f]' : 'bg-slate-200 dark:bg-slate-700'}`}
        style={{ height: 26 }}
      >
        <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-[3px]'}`} />
      </button>
    </div>
  );
}

// Private mode: only people who know BOTH your username AND your private-mode
// passkey can start a 1-to-1 chat with you. The passkey hash lives on your
// server profile; strangers without it are blocked at conversation creation.
export function getPrivateMode(): { enabled: boolean; passkeyHint: string } {
  try {
    const raw = localStorage.getItem('clubs:private-mode');
    if (raw) {
      const j = JSON.parse(raw);
      return { enabled: !!j.enabled, passkeyHint: String(j.passkeyHint || '') };
    }
  } catch {
    /* ignore */
  }
  return { enabled: false, passkeyHint: '' };
}

function PrivateModeCard({ notify }: { notify: (t: string) => void }) {
  const { user, refreshProfile } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = loading
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Source of truth is the server row (works even if localStorage was wiped
  // or the DB predates profile columns). Never derive from profile alone.
  useEffect(() => {
    if (!user) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/private-settings?user_id=${encodeURIComponent(user.id)}`);
        const data = await res.json().catch(() => ({}));
        if (live && res.ok) setEnabled(!!data.private_mode);
        else if (live) setEnabled(false);
      } catch {
        if (live) setEnabled(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [user?.id]);

  const saveOn = async () => {
    if (!user) return;
    setErr('');
    if (code.trim().length < 4) {
      setErr('Passkey must be at least 4 characters.');
      return;
    }
    if (code.trim() !== confirm.trim()) {
      setErr('Passkeys do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/private-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, private_mode: true, chat_passkey: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not enable private mode.');
      setEnabled(true);
      setCode('');
      setConfirm('');
      setShow(false);
      await refreshProfile();
      notify('Private mode on — strangers need your username + passkey to chat');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not enable private mode.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch('/api/private-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, private_mode: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not disable private mode.');
      setEnabled(false);
      setCode('');
      setConfirm('');
      setShow(false);
      setErr('');
      await refreshProfile();
      notify('Private mode off — anyone can start a chat with you');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not disable private mode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5">
      <div className="flex items-start gap-3.5">
        <span className="w-9 h-9 rounded-2xl bg-[#2e7d4f]/10 text-[#2e7d4f] dark:text-emerald-400 flex items-center justify-center shrink-0">
          <KeyRound size={17} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14.5px]">Private mode</div>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            Hide from strangers. When on, someone can only start a personal chat with you if they know both your
            username <span className="font-semibold text-slate-600 dark:text-slate-300">and</span> your chat passkey.
          </p>
        </div>
        <button
          onClick={() => (enabled ? disable() : setShow((v) => !v))}
          role="switch"
          aria-checked={!!enabled}
          disabled={busy || enabled === null}
          className={`w-11 shrink-0 rounded-full transition-colors relative disabled:opacity-60 ${enabled ? 'bg-[#2e7d4f]' : 'bg-slate-200 dark:bg-slate-700'}`}
          style={{ height: 26 }}
        >
          <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-[3px]'}`} />
        </button>
      </div>

      {enabled === null && (
        <div className="mt-4 flex items-center gap-2 text-[12.5px] text-slate-400">
          <Loader2 size={14} className="animate-spin" /> Checking private-mode status…
        </div>
      )}

      {enabled === false && show && (
        <div className="mt-4 space-y-2.5">
          {err && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[12.5px] font-medium px-3.5 py-2.5">
              {err}
            </div>
          )}
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Chat passkey (min 4) — share only with people you trust"
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-10 pr-4 py-2.5 text-[14px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
            />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveOn()}
              placeholder="Confirm chat passkey"
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-10 pr-4 py-2.5 text-[14px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
            />
          </div>
          <button
            onClick={saveOn}
            disabled={busy}
            className="w-full rounded-xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[13.5px] py-2.5 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Enable private mode
          </button>
          <p className="text-[11.5px] text-slate-400 leading-relaxed">
            Only a hash of the passkey is stored — never the passkey itself. Share your username + passkey only with
            people you want to hear from.
          </p>
        </div>
      )}

      {enabled && (
        <div className="mt-3">
          {err && (
            <div className="mb-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[12.5px] font-medium px-3.5 py-2.5">
              {err}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl bg-[#2e7d4f]/10 border border-[#2e7d4f]/20 px-3.5 py-2.5">
            <Lock size={14} className="text-[#2e7d4f] dark:text-emerald-400 shrink-0" />
            <p className="text-[12.5px] text-[#1f5c39] dark:text-emerald-300 font-medium">
              On — new chats need your username + passkey.
            </p>
            <button onClick={disable} disabled={busy} className="ml-auto text-[12.5px] font-bold text-red-500 hover:underline shrink-0 disabled:opacity-60">
              Turn off
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
