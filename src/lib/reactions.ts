import { useCallback, useRef } from 'react';
import type { ChatMessage, Reaction } from './types';

// Telegram's signature quick-react set. Extend freely — the picker reads
// categories from EmojiPicker, this strip is just the fast path.
export const QUICK_REACTS = ['❤️', '👍', '🔥', '🥳', '😮', '😢'];

export type ReactFn = (msg: ChatMessage, emoji: string) => void;

function toggleInList(
  reactions: Reaction[],
  emoji: string,
  userId: string
): { next: Reaction[]; added: boolean } {
  const next = (reactions || []).map((r) => ({ emoji: r.emoji, user_ids: [...(r.user_ids || [])] }));
  const idx = next.findIndex((r) => r.emoji === emoji);
  if (idx >= 0) {
    const users = next[idx].user_ids.filter((u) => u !== userId);
    if (users.length === 0) next.splice(idx, 1);
    else next[idx] = { emoji, user_ids: users };
    return { next, added: false };
  }
  next.push({ emoji, user_ids: [userId] });
  return { next, added: true };
}

async function postToggle(messageId: string, emoji: string, userId: string) {
  const res = await fetch('/api/reactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId, user_id: userId, emoji }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not react.');
  return (data.reactions || []) as Reaction[];
}

/**
 * Single shared reaction sender for Club + DM chats.
 * - Optimistic UI: counts update instantly.
 * - Rapid-tap safe: per-message in-flight guard; only the LATEST intent is
 *   settled, so spam-tapping can never create duplicate identical reactions.
 * - Rollback + toast on backend failure.
 * - Server (dedicated message_reactions table) is the source of truth;
 *   realtime UPDATE events fan the result out to every viewer.
 */
export function useReactionSender(opts: {
  userId: string | undefined;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  notify: (t: string) => void;
}) {
  const { userId, setMessages, notify } = opts;
  const inflight = useRef<Map<string, { queued: string | null; running: boolean }>>(new Map());

  const react = useCallback(
    async (msg: ChatMessage, emoji: string) => {
      if (!userId) return;
      const id = msg.id;
      let slot = inflight.current.get(id);
      if (!slot) {
        slot = { queued: null, running: false };
        inflight.current.set(id, slot);
      }
      // A request is already flying for this message: remember ONLY the
      // latest intent. The loop below settles it once the flight lands.
      if (slot.running) {
        slot.queued = emoji;
        return;
      }
      slot.running = true;
      try {
        let target = emoji;
        for (;;) {
          // 1. Optimistic toggle toward target.
          let snapshot: ChatMessage[] | null = null;
          setMessages((prev) => {
            snapshot = prev;
            return prev.map((x) => {
              if (x.id !== id) return x;
              const { next } = toggleInList(x.reactions || [], target, userId);
              return { ...x, reactions: next };
            });
          });
          try {
            // 2. Confirm with backend (toggle is idempotent server-side).
            const serverReactions = await postToggle(id, target, userId);
            setMessages((prev) =>
              prev.map((x) => (x.id === id ? { ...x, reactions: serverReactions } : x))
            );
          } catch (err) {
            // 3. Roll back + subtle feedback; never leave UI stuck.
            if (snapshot) setMessages(snapshot);
            notify(err instanceof Error ? err.message : 'Could not react.');
            break;
          }
          // 4. Settle a tap that queued mid-flight.
          const s = inflight.current.get(id);
          if (s && s.queued && s.queued !== target) {
            target = s.queued;
            s.queued = null;
            continue;
          }
          if (s) s.queued = null;
          break;
        }
      } finally {
        const s = inflight.current.get(id);
        if (s) {
          s.running = false;
          if (s.queued == null) inflight.current.delete(id);
          else {
            // Extremely rare: queued intent left after loop — settle it now.
            const leftover = s.queued;
            inflight.current.delete(id);
            if (leftover) {
              void react(msg, leftover);
            }
          }
        }
      }
    },
    [userId, setMessages, notify]
  );

  return react;
}
