import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Users, QrCode, Copy, Share2, ChevronDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import Modal, { SecondaryButton } from '../components/Modal';
import MessageBubble from '../components/MessageBubble';
import Composer from '../components/Composer';
import { useReactionSender } from '../lib/reactions';
import { copyText, shareText, clubInviteLink } from '../lib/utils';
import type { Club, ChatMessage } from '../lib/types';

export default function ClubChat({
  onOpenInfo,
  notify,
}: {
  onOpenInfo: (clubId: string) => void;
  notify: (t: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [myRole, setMyRole] = useState<string>('member');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const fetchClub = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/clubs?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Club not found.');
      setClub(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Club not found.');
    }
  }, [id]);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/messages?club_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load messages.');
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages.');
    }
  }, [id]);

  const fetchRole = useCallback(async () => {
    if (!id || !user) return;
    try {
      const res = await fetch(`/api/members?club_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok) {
        const me = (data as Array<{ user_id: string; role: string }>).find((m) => m.user_id === user.id);
        if (me) setMyRole(me.role);
      }
    } catch {
      /* ignore */
    }
  }, [id, user]);

  const markRead = useCallback(async () => {
    if (!id || !user) return;
    try {
      await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: id, user_id: user.id, last_read: true }),
      });
    } catch {
      /* ignore */
    }
  }, [id, user]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setMessages([]);
    setReplyTo(null);
    setNewCount(0);
    atBottom.current = true;
    (async () => {
      await Promise.all([fetchClub(), fetchMessages(), fetchRole()]);
      setLoading(false);
      setTimeout(() => scrollToBottom(), 60);
      markRead();
    })();
  }, [id, fetchClub, fetchMessages, fetchRole, markRead, scrollToBottom]);

  // Realtime
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`club-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `club_id=eq.${id}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
          if (atBottom.current) {
            setTimeout(() => scrollToBottom(true), 40);
          } else {
            setNewCount((c) => c + 1);
          }
          markRead();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `club_id=eq.${id}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `club_id=eq.${id}` },
        (payload) => {
          const old = payload.old as { id: string };
          setMessages((prev) => prev.filter((x) => x.id !== old.id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, markRead, scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    atBottom.current = nearBottom;
    if (nearBottom) {
      setNewCount(0);
      markRead();
    }
  };

  const send = async (p: { kind: 'text' | 'image' | 'video' | 'file' | 'voice'; body: string; file_url?: string; file_name?: string; file_size?: number; duration_sec?: number }, opts?: { followUpTo?: string | null }) => {
    if (!user || !id) return;
    setSending(true);
    const followUpTo = opts?.followUpTo ?? replyTo?.id ?? null;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: id,
          sender_id: user.id,
          kind: p.kind,
          body: p.body,
          file_url: p.file_url,
          file_name: p.file_name,
          file_size: p.file_size,
          duration_sec: p.duration_sec,
          reply_to_id: followUpTo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send.');
      setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
      setReplyTo(null);
      setTimeout(() => scrollToBottom(true), 40);
      markRead();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  const react = useReactionSender({ userId: user?.id, setMessages, notify });

  const del = async (m: ChatMessage) => {
    if (!user) return;
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, requester_id: user.id }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Could not delete.');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete.');
      fetchMessages();
    }
  };

  const edit = async (m: ChatMessage) => {
    if (!user) return;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, body: m.body } : x)));
    try {
      const res = await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, body: m.body, requester_id: user.id }),
      });
      const data = await res.json();
      if (res.ok) setMessages((prev) => prev.map((x) => (x.id === data.id ? data : x)));
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="font-semibold text-[15px] text-slate-700 dark:text-slate-200">{error || 'Club not found.'}</p>
        <Link to="/chats" className="mt-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13.5px] font-semibold px-5 py-2.5">
          Back to Chats
        </Link>
      </div>
    );
  }

  let lastSender = '';
  let lastDay = '';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-[#f6f7f6]/95 dark:bg-slate-950/95 backdrop-blur px-2 sm:px-4 py-2 flex items-center gap-1">
        <button
          onClick={() => navigate('/chats')}
          className="p-2.5 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <button onClick={() => onOpenInfo(club.id)} className="flex-1 flex items-center gap-3 min-w-0 text-left rounded-2xl hover:bg-slate-200/50 dark:hover:bg-slate-800/60 px-2 py-1.5 transition">
          <Avatar name={club.name} imageUrl={club.image_url} color={club.color} size={42} />
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-[15.5px] text-slate-900 dark:text-white truncate leading-tight">{club.name}</span>
            <span className="block text-[12px] text-slate-500 dark:text-slate-400 truncate">
              {club.member_count} member{club.member_count === 1 ? '' : 's'} · {club.club_number}
            </span>
          </span>
        </button>
        <button
          onClick={() => {
            const link = clubInviteLink(club);
            const shared = shareText(`Join my Club: ${club.name}`, `Join "${club.name}" on Clubs. Number: ${club.club_number}`, link);
            if (!shared) copyText(`${club.club_number}`).then((ok) => notify(ok ? 'Club number copied' : 'Share not supported'));
          }}
          className="p-2.5 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300"
          title="Share Club"
          aria-label="Share Club"
        >
          <Share2 size={18} />
        </button>
        <button
          onClick={() => setQrOpen(true)}
          className="p-2.5 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300"
          title="Show QR"
          aria-label="Show QR"
        >
          <QrCode size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 pb-10">
            <div className="w-16 h-16 rounded-3xl bg-[#2e7d4f]/10 flex items-center justify-center mb-4">
              <Users size={26} className="text-[#2e7d4f]" />
            </div>
            <p className="font-bold text-[16px] text-slate-800 dark:text-slate-100">Welcome to {club.name}</p>
            <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1.5 max-w-[280px] leading-relaxed">
              This is the beginning of the conversation. Invite people with the Club number{' '}
              <span className="font-mono font-semibold">{club.club_number}</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 max-w-3xl mx-auto">
            {messages.map((m) => {
              const day = new Date(m.created_at).toDateString();
              const showDay = day !== lastDay;
              lastDay = day;
              const showSender = m.sender_id !== lastSender || showDay;
              lastSender = m.sender_id;
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="flex justify-center mb-3">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 rounded-full px-3 py-1">
                        {new Date(m.created_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    msg={m}
                    mine={m.sender_id === user?.id}
                    myId={user?.id}
                    showSender={m.sender_id !== user?.id && showSender}
                    onReply={setReplyTo}
                    onReact={react}
                    onDelete={del}
                    onEdit={edit}
                    canModerate={myRole === 'owner' || myRole === 'admin'}
                  />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {newCount > 0 && (
          <button
            onClick={() => {
              scrollToBottom(true);
              setNewCount(0);
              markRead();
            }}
            className="sticky bottom-2 mx-auto flex items-center gap-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[12.5px] font-semibold px-4 py-2 shadow-lg"
          >
            <ChevronDown size={14} /> {newCount} new message{newCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <Composer onSend={send} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} sending={sending} followUpHint="club" />

      {/* QR modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Invite to this Club" subtitle={club.club_number}>
        <div className="text-center">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-5 bg-white inline-block">
            <QRCodeSVG value={`clubs://join?n=${club.club_number}${club.invite_token ? `&t=${club.invite_token}` : ''}|${clubInviteLink(club)}`} size={190} level="M" />
          </div>
          <p className="text-[12.5px] text-slate-500 mt-3">Scan with any camera to open the invite.</p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() =>
                copyText(club.club_number).then((ok) => notify(ok ? 'Club number copied' : 'Copy failed'))
              }
              className="rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[13.5px] py-3 flex items-center justify-center gap-1.5 transition"
            >
              <Copy size={15} /> Copy number
            </button>
            <button
              onClick={() => {
                const link = clubInviteLink(club);
                const shared = shareText(`Join my Club: ${club.name}`, `Join "${club.name}" on Clubs. Number: ${club.club_number}`, link);
                if (!shared)
                  copyText(`Join "${club.name}" on Clubs. Number: ${club.club_number} — ${link}`).then((ok) =>
                    notify(ok ? 'Invite copied' : 'Share not supported')
                  );
              }}
              className="rounded-2xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[13.5px] py-3 flex items-center justify-center gap-1.5 transition"
            >
              <Share2 size={15} /> Share Club
            </button>
          </div>
          <div className="mt-3">
            <SecondaryButton onClick={() => setQrOpen(false)}>Close</SecondaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
