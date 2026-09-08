import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, ChevronDown } from 'lucide-react';
import supabase from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import MessageBubble from '../components/MessageBubble';
import Composer from '../components/Composer';
import VerifiedTick from '../components/VerifiedTick';
import { useReactionSender } from '../lib/reactions';
import type { ChatMessage, DM } from '../lib/types';

export default function DMChat({ notify }: { notify: (t: string) => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [convo, setConvo] = useState<DM | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [newCount, setNewCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const fetchConvo = useCallback(async () => {
    if (!id || !user) return;
    try {
      const res = await fetch(`/api/conversations?id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversation not found.');
      setConvo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversation not found.');
    }
  }, [id, user]);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/messages?conversation_id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load messages.');
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages.');
    }
  }, [id]);

  const markRead = useCallback(async () => {
    if (!id || !user) return;
    try {
      await fetch('/api/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, user_id: user.id }),
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
      await Promise.all([fetchConvo(), fetchMessages()]);
      setLoading(false);
      setTimeout(() => scrollToBottom(), 60);
      markRead();
    })();
  }, [id, fetchConvo, fetchMessages, markRead, scrollToBottom]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`dm-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (atBottom.current) setTimeout(() => scrollToBottom(true), 40);
          else setNewCount((c) => c + 1);
          markRead();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
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
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: id,
          sender_id: user.id,
          kind: p.kind,
          body: p.body,
          file_url: p.file_url,
          file_name: p.file_name,
          file_size: p.file_size,
          duration_sec: p.duration_sec,
          reply_to_id: opts?.followUpTo ?? replyTo?.id ?? null,
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
      if (!res.ok) throw new Error((await res.json()).error || 'Could not delete.');
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

  if (error || !convo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <p className="font-semibold text-[15px]">{error || 'Conversation not found.'}</p>
        <Link to="/chats" className="mt-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13.5px] font-semibold px-5 py-2.5">
          Back to Chats
        </Link>
      </div>
    );
  }

  const peer = convo.peer;
  let lastDay = '';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-[#f6f7f6]/95 dark:bg-slate-950/95 backdrop-blur px-2 sm:px-4 py-2 flex items-center gap-1">
        <button
          onClick={() => navigate('/chats')}
          className="p-2.5 rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3 min-w-0 px-2 py-1.5">
          <Avatar name={peer?.display_name || 'Chat'} imageUrl={peer?.avatar_url} color={peer?.avatar_color} size={42} />
          <span className="min-w-0">
            <span className="font-bold text-[15.5px] text-slate-900 dark:text-white truncate leading-tight inline-flex items-center gap-1.5">
              {peer?.display_name || 'Direct chat'}
              <VerifiedTick userId={peer?.id} username={peer?.username} size={16} />
            </span>
            <span className="block text-[12px] text-slate-500 truncate">@{peer?.username || 'user'}</span>
          </span>
        </div>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 pb-10">
            <Avatar name={peer?.display_name || '?'} imageUrl={peer?.avatar_url} color={peer?.avatar_color} size={64} />
            <p className="font-bold text-[16px] mt-4">{peer?.display_name}</p>
            {peer?.bio && <p className="text-[13px] text-slate-500 mt-1 max-w-[260px]">{peer.bio}</p>}
            <p className="text-[13.5px] text-slate-400 mt-2">Say hello — messages appear here instantly.</p>
          </div>
        ) : (
          <div className="space-y-3.5 max-w-3xl mx-auto">
            {messages.map((m) => {
              const day = new Date(m.created_at).toDateString();
              const showDay = day !== lastDay;
              lastDay = day;
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
                    showSender={false}
                    onReply={setReplyTo}
                    onReact={react}
                    onDelete={del}
                    onEdit={edit}
                    canModerate={false}
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
            <ChevronDown size={14} /> {newCount} new
          </button>
        )}
      </div>

      <Composer onSend={send} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} sending={sending} followUpHint="dm" />
    </div>
  );
}
