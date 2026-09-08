import { useEffect, useState } from 'react';
import { Loader2, MessageCirclePlus, Search, Lock, KeyRound } from 'lucide-react';
import Modal, { PrimaryButton } from './Modal';
import Avatar from './Avatar';
import VerifiedTick from './VerifiedTick';
import { useAuth } from '../contexts/AuthContext';

export default function NewChatModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ id: string; username: string; display_name: string; bio: string | null; avatar_url: string | null; avatar_color: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Private-mode gate: recipient needs username + chat passkey
  const [lockedPeer, setLockedPeer] = useState<{ id: string; username: string; display_name: string } | null>(null);
  const [passkey, setPasskey] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setLockedPeer(null);
      setPasskey('');
      setError('');
      setCooldown(0);
    }
  }, [open ]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const search = async (term: string) => {
    setQ(term);
    setError('');
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/profiles?q=${encodeURIComponent(term.trim())}&exclude=${encodeURIComponent(user?.id || '')}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed.');
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const start = async (peerId: string, key?: string) => {
    if (!user) return;
    setBusyId(peerId);
    setError('');
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant_a: user.id, participant_b: peerId, chat_passkey: key }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setCooldown(60);
        throw new Error(data.error || 'Too many attempts. Wait a bit and try again.');
      }
      if (res.status === 403 && data?.error === 'PRIVATE_MODE') {
        // Recipient is in private mode — ask for their chat passkey
        const target = results.find((r) => r.id === peerId);
        setLockedPeer(
          target
            ? { id: target.id, username: target.username, display_name: target.display_name }
            : { id: peerId, username: data.username || 'user', display_name: 'Private user' }
        );
        setPasskey('');
        return;
      }
      if (!res.ok) throw new Error(data.error || data.message || 'Could not start chat.');
      onClose();
      setQ('');
      setResults([]);
      setLockedPeer(null);
      setPasskey('');
      onCreated(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setLockedPeer(null);
        setPasskey('');
        setError('');
      }}
      title={lockedPeer ? 'Private chat' : 'New chat'}
      subtitle={
        lockedPeer
          ? `@${lockedPeer.username} only chats with people who know their passkey.`
          : 'Find someone by name or username'
      }
    >
      {lockedPeer ? (
        <div>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 mb-4">
            <span className="w-10 h-10 rounded-2xl bg-[#2e7d4f]/10 text-[#2e7d4f] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <KeyRound size={18} />
            </span>
            <div className="min-w-0">
              <div className="font-bold text-[15px] truncate">{lockedPeer.display_name}</div>
              <div className="text-[12px] text-slate-500 truncate">
                @{lockedPeer.username} · private mode — strangers are blocked
              </div>
            </div>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && passkey && start(lockedPeer.id, passkey)}
              placeholder={`Enter @${lockedPeer.username}'s chat passkey`}
              autoFocus
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-11 pr-4 py-3 text-[15px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
            />
          </div>
          {error && (
            <div className="mt-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-2.5">
              {error}
            </div>
          )}
          <div className="mt-4 space-y-2">
            <PrimaryButton onClick={() => passkey && start(lockedPeer.id, passkey)}>
              {busyId ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Checking…
                </span>
              ) : cooldown > 0 ? (
                `Wait ${cooldown}s…`
              ) : (
                'Start chat'
              )}
            </PrimaryButton>
            <button
              onClick={() => {
                setLockedPeer(null);
                setPasskey('');
                setError('');
              }}
              className="w-full text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:underline py-1"
            >
              Chat with someone else
            </button>
          </div>
        </div>
      ) : (
      <>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => search(e.target.value)}
          placeholder="Search name or @username…"
          autoFocus
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-10 pr-4 py-3 text-[15px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
        />
      </div>
      {error && (
        <div className="mb-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-2.5">
          {error}
        </div>
      )}
      {searching ? (
        <div className="py-8 flex justify-center">
          <Loader2 size={22} className="animate-spin text-slate-400" />
        </div>
      ) : results.length === 0 ? (
        <div className="py-8 text-center">
          <MessageCirclePlus size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-[13.5px] text-slate-500 dark:text-slate-400">
            {q.trim().length < 2 ? 'Type at least 2 characters to search.' : 'No people found. Check the spelling.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1 -mx-2">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => start(p.id)}
              disabled={busyId === p.id}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left disabled:opacity-60"
            >
              <Avatar name={p.display_name} imageUrl={p.avatar_url} color={p.avatar_color} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14.5px] text-slate-900 dark:text-white truncate inline-flex items-center gap-1.5">
                  {p.display_name}
                  <VerifiedTick userId={p.id} username={p.username} size={15} />
                </div>
                <div className="text-[12.5px] text-slate-500 truncate">@{p.username}</div>
              </div>
              {busyId === p.id ? (
                <Loader2 size={17} className="animate-spin text-slate-400 shrink-0" />
              ) : (
                <span className="text-[12.5px] font-bold text-[#2e7d4f] dark:text-emerald-400 shrink-0">Chat</span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4">
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
      </>
      )}
    </Modal>
  );
}
