import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Settings, MessageCirclePlus, Users, Hash, X, Loader2, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import VerifiedTick from '../components/VerifiedTick';
import Logo from '../components/Logo';
import { fmtTime, dmPreview, lastMessagePreview } from '../lib/utils';
import type { Club, DM } from '../lib/types';

type Item =
  | { type: 'club'; data: Club; ts: number }
  | { type: 'dm'; data: DM; ts: number };

export default function Chats({
  onOpenCreate,
  onOpenJoin,
  onOpenNewChat,
  refreshKey,
  prefill,
}: {
  onOpenCreate: () => void;
  onOpenJoin: (n?: string) => void;
  onOpenNewChat: () => void;
  refreshKey: number;
  prefill: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [dms, setDms] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(prefill || '');
  const [fabOpen, setFabOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'clubs' | 'dms'>(() => {
    try {
      return (localStorage.getItem('clubs:lastTab') as 'all' | 'clubs' | 'dms') || 'all';
    } catch {
      return 'all';
    }
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    setSearch(prefill);
  }, [prefill]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [cRes, dRes] = await Promise.all([
        fetch(`/api/clubs?user_id=${encodeURIComponent(user.id)}`),
        fetch(`/api/conversations?user_id=${encodeURIComponent(user.id)}`),
      ]);
      if (!cRes.ok) throw new Error('Could not load Clubs.');
      if (!dRes.ok) throw new Error('Could not load chats.');
      setClubs(await cRes.json());
      setDms(await dRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refreshKey]);

  const switchTab = (t: 'all' | 'clubs' | 'dms') => {
    setTab(t);
    try {
      localStorage.setItem('clubs:lastTab', t);
    } catch {
      /* ignore */
    }
  };

  const items: Item[] = [
    ...clubs.map((c) => ({
      type: 'club' as const,
      data: c,
      ts: new Date(c.last_message?.created_at || c.created_at).getTime(),
    })),
    ...dms.map((d) => ({
      type: 'dm' as const,
      data: d,
      ts: new Date(d.last_message?.created_at || d.last_message_at).getTime(),
    })),
  ].sort((a, b) => b.ts - a.ts);

  const q = search.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (tab === 'clubs' && it.type !== 'club') return false;
    if (tab === 'dms' && it.type !== 'dm') return false;
    if (!q) return true;
    if (it.type === 'club') {
      const c = it.data as Club;
      return (
        c.name.toLowerCase().includes(q) ||
        c.club_number.toLowerCase().includes(q.replace(/\s/g, '')) ||
        (c.description || '').toLowerCase().includes(q)
      );
    }
    const d = it.data as DM;
    return (
      (d.peer?.display_name || '').toLowerCase().includes(q) ||
      (d.peer?.username || '').toLowerCase().includes(q) ||
      (d.last_message_text || '').toLowerCase().includes(q)
    );
  });

  const totalUnread =
    clubs.reduce((s, c) => s + (c.unread_count || 0), 0) + dms.reduce((s, d) => s + (d.unread_count || 0), 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSearchFocused(true);
                setTimeout(() => searchRef.current?.focus(), 30);
              }}
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
              aria-label="Search"
            >
              <Search size={20} />
            </button>
            <Link
              to="/settings"
              className="p-2.5 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
              aria-label="Settings"
            >
              <Settings size={20} />
            </Link>
          </div>
        </div>
        <div className="flex items-end justify-between mt-3">
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">
            Chats
            {totalUnread > 0 && (
              <span className="ml-2 align-middle text-[11px] font-bold bg-[#2e7d4f] text-white rounded-full px-2 py-0.5">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </h1>
        </div>

        {/* Search */}
        <AnimatePresence initial={false}>
          {(searchFocused || search) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="relative mt-2">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={() => !search && setSearchFocused(false)}
                  placeholder="Search chats, Clubs, numbers…"
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-10 py-2.5 text-[14.5px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20 transition"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setSearchFocused(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {(['all', 'clubs', 'dms'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                tab === t
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t === 'all' ? 'All' : t === 'clubs' ? 'Clubs' : 'Direct'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 pb-28">
        {loading ? (
          <div className="space-y-1 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1">
                  <div className="h-3.5 w-2/5 rounded bg-slate-200 dark:bg-slate-800 mb-2" />
                  <div className="h-3 w-3/5 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center pt-16 px-8">
            <p className="text-[14px] text-red-600 dark:text-red-400 font-medium">{error}</p>
            <button
              onClick={fetchAll}
              className="mt-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13.5px] font-semibold px-5 py-2.5"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            searching={!!q}
            hasAny={items.length > 0}
            onNewChat={onOpenNewChat}
            onCreate={onOpenCreate}
            onJoin={onOpenJoin}
          />
        ) : (
          <div className="pt-1">
            {tab === 'all' && <SectionLabel label="Clubs" count={clubs.length} />}
            {filtered
              .filter((i) => i.type === 'club' && (tab !== 'dms' || false) && (tab === 'all' || tab === 'clubs' || true))
              .filter(() => tab !== 'dms')
              .map((it) => {
                const c = (it as { data: Club }).data;
                return (
                  <button
                    key={'c' + c.id}
                    onClick={() => navigate(`/club/${c.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-900 active:bg-slate-100 dark:active:bg-slate-800 transition text-left"
                  >
                    <div className="relative">
                      <Avatar name={c.name} imageUrl={c.image_url} color={c.color} size={50} />
                      <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#2e7d4f] text-white flex items-center justify-center ring-2 ring-[#f6f7f6] dark:ring-slate-950">
                        <Users size={10} strokeWidth={2.5} />
                      </span>
                      {(c.unread_count || 0) > 0 && (
                        <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-[#22c55e] ring-2 ring-[#f6f7f6] dark:ring-slate-950" aria-label="Unread messages" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">{c.name}</span>
                        <span className="text-[11.5px] text-slate-400 shrink-0">{fmtTime(c.last_message?.created_at || c.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[13.5px] text-slate-500 dark:text-slate-400 truncate">
                          {c.last_message ? (
                            <>
                              <span className="font-medium text-slate-600 dark:text-slate-300">{c.last_message.sender_name}: </span>
                              {lastMessagePreview(c.last_message)}
                            </>
                          ) : (
                            <span className="text-slate-400">No messages yet — say hello</span>
                          )}
                        </span>
                        {(c.unread_count || 0) > 0 ? (
                          <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#2e7d4f] text-white text-[11px] font-bold flex items-center justify-center">
                            {c.unread_count! > 99 ? '99+' : c.unread_count}
                          </span>
                        ) : c.require_passkey ? (
                          <Check size={0} className="hidden" />
                        ) : null}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 tracking-wide">{c.club_number}</div>
                    </div>
                  </button>
                );
              })}
            {tab === 'all' && dms.length > 0 && clubs.length > 0 && <SectionLabel label="Direct messages" count={dms.length} />}
            {filtered
              .filter(() => tab !== 'clubs')
              .filter((i) => i.type === 'dm')
              .map((it) => {
                const d = (it as { data: DM }).data;
                return (
                  <button
                    key={'d' + d.id}
                    onClick={() => navigate(`/dm/${d.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-900 active:bg-slate-100 dark:active:bg-slate-800 transition text-left"
                  >
                    <div className="relative">
                      <Avatar name={d.peer?.display_name || 'Chat'} imageUrl={d.peer?.avatar_url} color={d.peer?.avatar_color} size={50} />
                      {(d.unread_count || 0) > 0 && (
                        <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-[#22c55e] ring-2 ring-[#f6f7f6] dark:ring-slate-950" aria-label="Unread messages" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-[15px] text-slate-900 dark:text-white truncate inline-flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{d.peer?.display_name || 'Direct chat'}</span>
                          <VerifiedTick userId={d.peer?.id} username={d.peer?.username} size={15} />
                        </span>
                        <span className="text-[11.5px] text-slate-400 shrink-0">
                          {fmtTime(d.last_message?.created_at || d.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[13.5px] text-slate-500 dark:text-slate-400 truncate">
                          {d.last_message || d.last_message_text ? (
                            dmPreview(d.last_message || { body: d.last_message_text, kind: 'text' })
                          ) : (
                            <span className="text-slate-400">Say hello</span>
                          )}
                        </span>
                        {(d.unread_count || 0) > 0 && (
                          <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#2e7d4f] text-white text-[11px] font-bold flex items-center justify-center">
                            {d.unread_count! > 99 ? '99+' : d.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">@{d.peer?.username || 'user'}</div>
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="absolute bottom-5 right-4 sm:right-6 flex flex-col items-end gap-2.5 z-30">
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="flex flex-col items-end gap-2 mb-1"
            >
              <FabAction
                icon={<MessageCirclePlus size={17} />}
                label="New chat"
                onClick={() => {
                  setFabOpen(false);
                  onOpenNewChat();
                }}
              />
              <FabAction
                icon={<Users size={17} />}
                label="Create Club"
                onClick={() => {
                  setFabOpen(false);
                  onOpenCreate();
                }}
              />
              <FabAction
                icon={<Hash size={17} />}
                label="Join Club"
                onClick={() => {
                  setFabOpen(false);
                  onOpenJoin();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.92, rotate: fabOpen ? 0 : 90 }}
          onClick={() => setFabOpen((v) => !v)}
          className={`w-[60px] h-[60px] rounded-full shadow-lg flex items-center justify-center transition-colors ${
            fabOpen ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-[#2e7d4f] text-white'
          }`}
          aria-label="New conversation"
        >
          <motion.span animate={{ rotate: fabOpen ? 45 : 0 }}>
            <Plus size={26} strokeWidth={2.4} />
          </motion.span>
        </motion.button>
      </div>

      {fabOpen && <div className="absolute inset-0 z-20" onClick={() => setFabOpen(false)} />}
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-3 pt-3 pb-1 flex items-center justify-between">
      <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-[12px] font-semibold text-slate-400 dark:text-slate-500">{count}</span>
    </div>
  );
}

function FabAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-md rounded-full pl-4 pr-5 py-2.5 text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
    >
      <span className="text-[#2e7d4f] dark:text-emerald-400">{icon}</span>
      {label}
    </button>
  );
}

function EmptyState({
  searching,
  hasAny,
  onNewChat,
  onCreate,
  onJoin,
}: {
  searching: boolean;
  hasAny: boolean;
  onNewChat: () => void;
  onCreate: () => void;
  onJoin: (n?: string) => void;
}) {
  if (searching) {
    return (
      <div className="text-center pt-16 px-8">
        <p className="font-semibold text-[15px] text-slate-700 dark:text-slate-200">No matches</p>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1">Try a different name or Club number.</p>
      </div>
    );
  }
  if (!hasAny) {
    return (
      <div className="text-center pt-12 px-8">
        <div className="w-16 h-16 rounded-3xl bg-[#2e7d4f]/10 flex items-center justify-center mx-auto mb-4">
          <Users size={26} className="text-[#2e7d4f]" />
        </div>
        <p className="font-bold text-[17px] text-slate-800 dark:text-slate-100 tracking-tight">Nothing here yet</p>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-[260px] mx-auto">
          Start a direct chat, create your first Club, or join one with a Club number.
        </p>
        <div className="mt-5 flex flex-col gap-2 max-w-[260px] mx-auto">
          <button
            onClick={onCreate}
            className="rounded-2xl bg-[#2e7d4f] text-white font-semibold text-[14.5px] py-3 hover:bg-[#276b43] transition"
          >
            Create a Club
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onJoin()}
              className="flex-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-[14px] py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Join Club
            </button>
            <button
              onClick={onNewChat}
              className="flex-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-[14px] py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              New chat
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="text-center pt-16 px-8">
      <p className="text-[14px] text-slate-500">Nothing in this section yet.</p>
    </div>
  );
}
