import { useEffect, useRef, useState } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { Download, FileText, Link2, SmilePlus, CornerUpLeft } from 'lucide-react';
import Avatar from './Avatar';
import RichText from './RichText';
import VoicePlayer from './VoicePlayer';
import VerifiedTick from './VerifiedTick';
import EmojiPicker from './EmojiPicker';
import { QUICK_REACTS } from '../lib/reactions';
import { fmtMsgTime, fmtBytes, isLinkText } from '../lib/utils';
import type { ChatMessage } from '../lib/types';

export { QUICK_EMOJI } from './EmojiPicker';
export { QUICK_REACTS };

// Touch helper: distinguishes a tap (opens THIS message's quick panel)
// from a long hold (opens the overflow menu). Not oversensitive: movement
// beyond 10px cancels, and the hold threshold is deliberately slow.
const LONG_PRESS_MS = 700;

export default function MessageBubble({
  msg,
  mine,
  myId,
  showSender,
  onReply,
  onReact,
  onDelete,
  onEdit,
  canModerate,
}: {
  msg: ChatMessage;
  mine: boolean;
  myId?: string | null;
  showSender: boolean;
  onReply: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onDelete: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  canModerate: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [reactPos, setReactPos] = useState<'above' | 'below'>('above');
  const [editing, setEditing] = useState(false);
  const [whoEmoji, setWhoEmoji] = useState<string | null>(null);
  const [draft, setDraft] = useState(msg.body);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const reactRef = useRef<HTMLDivElement>(null);
  // Which message id the open reaction UI belongs to. STATE (not a ref) so
  // a realtime re-render can never show a stale neighbour's panel.
  const [reactForId, setReactForId] = useState<string | null>(null);

  // Tap-outside-to-close for THIS bubble's panel only (capture phase, and it
  // ignores taps inside this bubble's own popovers, so picking an emoji can
  // never be swallowed or "jump" to the next message).
  useEffect(() => {
    if (!reactOpen && !menu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && bubbleRef.current?.contains(t)) return;
      if (t && reactRef.current?.contains(t)) return;
      setMenu(false);
      setReactOpen(false);
      setReactForId(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [menu, reactOpen]);
  useEffect(() => {
    if (!menu && !reactOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        setReactOpen(false);
        setReactForId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu, reactOpen]);
  const closePopovers = () => {
    setMenu(false);
    setReactOpen(false);
    setReactForId(null);
  };

  // Long-press/hold is deliberately SLOW (below) so a normal tap that picks
  // a reaction can never trigger the overflow menu instead.

  const toggleReact = () => {
    if (reactOpen) {
      setReactOpen(false);
      setReactForId(null);
      return;
    }
    setMenu(false);
    setReactForId(msg.id);
    // Flip below if there isn't room above (short lists / top of chat)
    try {
      const r = bubbleRef.current?.getBoundingClientRect();
      if (r && r.top < 220) setReactPos('below');
      else setReactPos('above');
    } catch {
      setReactPos('above');
    }
    setReactOpen(true);
    // No auto-dismiss: the picker stays pinned to THIS message until the user
    // picks an emoji, taps outside, or presses Escape.
  };

  const toggleMenu = () => {
    setReactOpen(false);
    setReactForId(null);
    setMenu((v) => !v);
  };

  // The open panel carries data-msgid so an event can never be mistaken for
  // a neighbouring message's ("reaction jumps to next message" bug).
  const panelMsgId = reactOpen ? msg.id : null;

  const pickEmoji = (e: string) => {
    // Guard: only react on the anchored message id. If a stray event from a
    // neighbouring bubble arrives here, ignore it instead of reacting there.
    if (reactForId && reactForId !== msg.id) {
      setReactOpen(false);
      setReactForId(null);
      return;
    }
    onReact(msg, e);
    setReactOpen(false);
    setReactForId(null);
  };

  // Never show another message's picker state: if a realtime UPDATE replaces
  // this bubble's message object mid-interaction, drop open popovers.
  useEffect(() => {
    setMenu(false);
    setReactOpen(false);
    setReactForId(null);
    setWhoEmoji(null);
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.id]);

  useEffect(() => {
    setDraft(msg.body);
  }, [msg.body]);

  const saveEdit = () => {
    if (draft.trim() && draft.trim() !== msg.body) onEdit({ ...msg, body: draft.trim() });
    setEditing(false);
    setMenu(false);
  };

  return (
    <div
      className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''} group`}
      onMouseLeave={() => {
        closePopovers();
      }}
    >
      {!mine && showSender ? (
        <div className="pt-4 shrink-0">
          <Avatar name={msg.sender_name} imageUrl={msg.sender_avatar} color={msg.sender_color} size={30} />
        </div>
      ) : (
        <div className="w-[30px] shrink-0" />
      )}

      <div className={`max-w-[78%] sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!mine && showSender && (
          <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 ml-1 mb-0.5 inline-flex items-center gap-1">
            {msg.sender_name}
            <VerifiedTick userId={msg.sender_id} username={(msg as { sender_username?: string | null }).sender_username} size={13} />
          </span>
        )}

        <div className="relative" ref={bubbleRef}>
          {/* Mobile long-press = overflow menu. Desktop right-click = menu.
              Single taps NEVER open anything by themselves here (the smiley
              button + hover toolbar handle that) — so a tap can never "jump"
              a panel to the next message. Double-click = full picker. */}
          <LongPressWrap
            onTap={() => {}}
            onLongPress={toggleMenu}
            className={`rounded-[20px] px-3.5 py-2.5 text-[14.5px] leading-relaxed shadow-sm break-words ${
              mine
                ? 'bg-[#2e7d4f] text-white rounded-br-lg'
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700/60 rounded-bl-lg'
            }`}
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              toggleMenu();
            }}
            onDoubleClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              setMenu(false);
              toggleReact();
            }}
          >
            {msg.reply_preview && (
              <div
                className={`mb-1.5 rounded-xl px-2.5 py-1.5 text-[12.5px] border-l-[3px] ${
                  mine
                    ? 'bg-black/15 border-white/60 text-white/90'
                    : 'bg-slate-100 dark:bg-slate-700/60 border-[#2e7d4f] text-slate-600 dark:text-slate-300'
                }`}
              >
                <div className="font-semibold text-[11.5px]">{msg.reply_preview.sender_name}</div>
                <div className="truncate">
                  {msg.reply_preview.kind === 'text'
                    ? msg.reply_preview.body
                    : msg.reply_preview.kind === 'image'
                      ? 'Photo'
                      : msg.reply_preview.kind === 'video'
                        ? 'Video'
                        : msg.reply_preview.kind === 'voice'
                          ? 'Voice message'
                          : 'File'}
                </div>
              </div>
            )}

            {msg.kind === 'image' && msg.file_url && (
              <a href={msg.file_url} target="_blank" rel="noreferrer" className="block -mx-1 -mt-0.5 mb-1.5">
                <img
                  src={msg.file_url}
                  alt={msg.file_name || 'Photo'}
                  className="rounded-2xl max-h-64 w-full object-cover"
                  loading="lazy"
                />
              </a>
            )}

            {msg.kind === 'video' && msg.file_url && (
              <span className="block -mx-1 -mt-0.5 mb-1.5" onClick={(e) => e.stopPropagation()}>
                <video
                  src={msg.file_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="rounded-2xl max-h-64 w-full bg-black object-contain"
                />
                {msg.file_name && (
                  <span className={`block mt-1 text-[11px] truncate ${mine ? 'text-white/75' : 'text-slate-400'}`}>
                    {msg.file_name}
                    {msg.file_size ? ` · ${fmtBytes(msg.file_size)}` : ''}
                  </span>
                )}
              </span>
            )}

            {msg.kind === 'voice' && msg.file_url && (
              <VoicePlayer
                url={msg.file_url}
                mine={mine}
                duration={msg.duration_sec}
                fileName={msg.file_name || (msg.body ? undefined : 'Voice message')}
                timeLabel={fmtMsgTime(msg.created_at)}
              />
            )}

            {msg.kind === 'file' && msg.file_url && (
              <a
                href={msg.file_url}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 mb-1.5 min-w-[200px] ${
                  mine ? 'bg-black/15' : 'bg-slate-100 dark:bg-slate-700/60'
                }`}
              >
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${mine ? 'bg-white/20' : 'bg-white dark:bg-slate-800 shadow-sm'}`}>
                  <FileText size={17} className={mine ? 'text-white' : 'text-[#2e7d4f]'} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">{msg.file_name || 'File'}</span>
                  <span className={`block text-[11px] ${mine ? 'text-white/75' : 'text-slate-400'}`}>
                    {fmtBytes(msg.file_size)} · Tap to open
                  </span>
                </span>
                <Download size={15} className={mine ? 'text-white/80' : 'text-slate-400'} />
              </a>
            )}

            {editing ? (
              <div className="min-w-[180px]">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  autoFocus
                  className={`w-full rounded-xl px-2 py-1.5 text-[14px] outline-none resize-none ${
                    mine ? 'bg-black/15 text-white placeholder:text-white/60' : 'bg-slate-100 dark:bg-slate-700'
                  }`}
                />
                <div className="flex gap-2 mt-1.5 justify-end">
                  <button onClick={() => setEditing(false)} className={`text-[12px] font-semibold ${mine ? 'text-white/80' : 'text-slate-500'}`}>
                    Cancel
                  </button>
                  <button onClick={saveEdit} className={`text-[12px] font-bold ${mine ? 'text-white' : 'text-[#2e7d4f]'}`}>
                    Save
                  </button>
                </div>
              </div>
            ) : msg.body ? (
              <LinkPreview body={msg.body} mine={mine} />
            ) : null}
          </LongPressWrap>

          {/* Telegram-style react trigger: a small circular smiley docked at
              the bubble's bottom corner (like Telegram's hover affordance).
              Desktop: fades in on hover/focus only. Touch: always visible.
              Click/tap toggles the emoji panel anchored to THIS message.
              The panel flips above/below for viewport space and carries a
              data-msgid anchor so taps can never land on another message. */}
          <div
            data-testid="bubble-react"
            className={`absolute ${mine ? '-left-2' : '-right-2'} -bottom-2 z-10 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-within:opacity-100 transition-all duration-150 ${reactOpen ? 'sm:opacity-100' : ''} sm:pointer-events-none sm:group-hover:pointer-events-auto sm:group-focus-within:pointer-events-auto sm:focus-within:pointer-events-auto`}
          >
            <button
              type="button"
              onMouseDown={(ev) => ev.stopPropagation()}
              onTouchStart={(ev) => ev.stopPropagation()}
              onClick={(ev) => { ev.stopPropagation(); toggleReact(); }}
              onFocus={() => { /* keep visible while tab-focused */ }}
              title="React"
              aria-label="React to this message"
              aria-expanded={reactOpen}
              aria-haspopup="dialog"
              className={`w-7 h-7 rounded-full shadow-md border flex items-center justify-center transition-all duration-150 active:scale-90 ${
                reactOpen
                  ? 'bg-[#2e7d4f] text-white border-[#2e7d4f] scale-110'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:text-[#2e7d4f] dark:hover:text-emerald-400 hover:border-[#2e7d4f]/50 hover:scale-110'
              }`}
            >
              <SmilePlus size={14} />
            </button>
          </div>

          {/* Overflow menu trigger stays in the hover toolbar (desktop) */}
          <div
            data-testid="bubble-actions"
            className={`absolute top-1 ${mine ? 'left-0 -translate-x-full -ml-1' : 'right-0 translate-x-full ml-1'} hidden sm:flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-1 py-0.5 shadow-sm z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto`}
          >
            <button
              onMouseDown={(ev) => ev.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onReply(msg); }}
              title="Follow-up"
              aria-label="Follow-up"
              className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500"
            >
              <CornerUpLeft size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleMenu(); }}
              onMouseDown={(e) => e.stopPropagation()}
              title="More"
              aria-expanded={menu}
              className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-[13px] flex items-center justify-center text-slate-500"
            >
              •••
            </button>
          </div>

          {/* Overflow menu (long-press / right-click / •••) */}
          {menu && !reactOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              className={`absolute z-20 top-full mt-1 ${mine ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg py-1 min-w-[150px]`}
            >
              <MenuItem label="Follow-up" onClick={() => { onReply(msg); setMenu(false); }} />
              <MenuItem label="React" onClick={() => { setMenu(false); toggleReact(); }} />
              {mine && msg.kind === 'text' && (
                <MenuItem label="Edit" onClick={() => { setDraft(msg.body); setEditing(true); setMenu(false); }} />
              )}
              {(mine || canModerate) && (
                <MenuItem label="Delete" danger onClick={() => { onDelete(msg); setMenu(false); }} />
              )}
            </div>
          )}

          {/* Telegram-style anchored emoji panel: quick-react row on top
              (one tap reacts instantly), full searchable catalogue below.
              Absolute inside THIS bubble, flips above/below for viewport
              space, data-msgid keeps every tap local to this message. */}
          {reactOpen && (
            <div
              ref={reactRef}
              data-msgid={panelMsgId || msg.id}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              role="dialog"
              aria-label="Pick a reaction"
              className={`absolute z-20 ${reactPos === 'above' ? 'bottom-full mb-1.5 animate-[reactPop_.18s_ease-out]' : 'top-full mt-1.5 animate-[reactPop_.18s_ease-out]'} ${mine ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 w-[288px] max-w-[78vw] origin-bottom`}
            >
              <ReactionPanel
                msg={msg}
                myId={myId}
                onPick={pickEmoji}
                onClose={() => { setReactOpen(false); setReactForId(null); }}
              />
            </div>
          )}
        </div>

          {/* Telegram-style reaction chips: compact pills directly under the
              message — emoji + live count, own reaction highlighted, tap to
              toggle. Tap a chip opens the who-reacted sheet. */}
          {msg.reactions && msg.reactions.length > 0 && (
          <ReactionChips
            msg={msg}
            myId={myId}
            mine={mine}
            onToggle={(emoji) => onReact(msg, emoji)}
            onWho={(emoji) => setWhoEmoji(emoji)}
          />
          )}

        <span className={`text-[10.5px] text-slate-400 mt-0.5 mx-1 ${mine ? 'text-right' : ''}`}>
          {fmtMsgTime(msg.created_at)}
        </span>
      </div>

      {/* Who-reacted bottom sheet (Telegram-style: tap a chip → see voters) */}
      {whoEmoji && (
        <WhoReactedSheet
          msg={msg}
          emoji={whoEmoji}
          myId={myId}
          onToggle={(e) => { onReact(msg, e); }}
          onClose={() => setWhoEmoji(null)}
        />
      )}
    </div>
  );
}

function LinkPreview({ body, mine }: { body: string; mine: boolean }) {
  if (!isLinkText(body)) return <RichText text={body} mine={mine} />;
  const href = /^https?:\/\//i.test(body.trim()) ? body.trim() : `https://${body.trim()}`;
  let host = '';
  try {
    host = new URL(href).hostname.replace(/^www\./, '');
  } catch {
    host = body.trim();
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 min-w-[210px] max-w-[260px] no-underline ${
        mine ? 'bg-black/15 hover:bg-black/25' : 'bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700'
      } transition`}
    >
      <span
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          mine ? 'bg-white/20' : 'bg-white dark:bg-slate-800 shadow-sm'
        }`}
      >
        <Link2 size={17} className={mine ? 'text-white' : 'text-[#2e7d4f] dark:text-emerald-400'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-semibold truncate underline underline-offset-2 ${mine ? 'text-white' : ''}`}>
          {body.trim()}
        </span>
        <span className={`block text-[11px] truncate ${mine ? 'text-white/75' : 'text-slate-400'}`}>
          {host} · Tap to open
        </span>
      </span>
    </a>
  );
}

function ActionBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-7 h-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-[13px] flex items-center justify-center text-slate-500"
    >
      {children}
    </button>
  );
}

// ─── Telegram-style reaction UI ────────────────────────────────────────────
// ReactionPanel: quick-react row (one tap reacts instantly) + full searchable
// catalogue. Anchored to ONE message via pickEmoji's msg closure + data-msgid.
// ReactionChips: compact pills under the message (emoji + live count).
// WhoReactedSheet: tap a chip's chevron → see counts grouped by emoji.
// Reaction LOGIC (add/remove/change, no dupes, rapid-tap safe) lives in ONE
// place — useReactionSender() in lib/reactions.ts — reused by Club + DM chats.

function ReactionPanel({
  msg,
  myId,
  onPick,
  onClose,
}: {
  msg: ChatMessage;
  myId?: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const mine = (msg.reactions || []).filter((r) => (r.user_ids || []).includes(myId || '')).map((r) => r.emoji);
  return (
    <div className="animate-[reactPop_.18s_ease-out]">
      <style>{`@keyframes reactPop { from { opacity: 0; transform: scale(.92) translateY(4px); } to { opacity: 1; transform: none; } }`}</style>
      {/* Quick-react row: Telegram's signature one-tap strip */}
      <div className="flex items-center gap-0.5 px-1 pb-1.5" role="toolbar" aria-label="Quick reactions">
        {QUICK_REACTS.map((e) => {
          const active = mine.includes(e);
          return (
            <button
              key={e}
              type="button"
              onMouseDown={(ev) => ev.stopPropagation()}
              onTouchStart={(ev) => ev.stopPropagation()}
              onClick={(ev) => { ev.stopPropagation(); onPick(e); }}
              aria-label={`React ${e}`}
              aria-pressed={active}
              title={`React ${e}`}
              className={`text-[24px] w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-100 hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-110 ${
                active ? 'bg-[#2e7d4f]/15 ring-1 ring-[#2e7d4f]/50' : ''
              }`}
            >
              {e}
            </button>
          );
        })}
      </div>
      <div className="h-px bg-slate-100 dark:bg-slate-700/70 mx-2" />
      <EmojiPicker onPick={onPick} compact />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="w-full mt-1 rounded-xl text-[12px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
      >
        Close
      </button>
    </div>
  );
}

function ReactionChips({
  msg,
  myId,
  mine,
  onToggle,
  onWho,
}: {
  msg: ChatMessage;
  myId?: string | null;
  mine: boolean;
  onToggle: (emoji: string) => void;
  onWho: (emoji: string) => void;
}) {
  const shown = (msg.reactions || []).slice(0, 8);
  const extra = (msg.reactions || []).length - shown.length;
  return (
    <div className={`flex flex-wrap gap-1 mt-1 animate-[chipIn_.16s_ease-out] ${mine ? 'justify-end' : ''}`}>
      <style>{`@keyframes chipIn { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }`}</style>
      {shown.map((r) => {
        const count = (r.user_ids || []).length;
        const reacted = (r.user_ids || []).includes(myId || '');
        return (
          <span
            key={r.emoji}
            className={`inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-[3px] text-[13px] leading-none shadow-sm border transition-all duration-100 hover:scale-105 active:scale-95 animate-[countPop_.18s_ease-out] ${
              reacted
                ? 'bg-[#2e7d4f] text-white border-[#2e7d4f] dark:bg-emerald-500 dark:border-emerald-500'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#2e7d4f]/60'
            }`}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(r.emoji); }}
              onMouseDown={(e) => e.stopPropagation()}
              title={count + ' reaction' + (count > 1 ? 's' : '') + (reacted ? ' · tap to remove yours' : ' · tap to join in')}
              aria-label={`${r.emoji}, ${count} reaction${count > 1 ? 's' : ''}${reacted ? ', including you' : ''}. Activate to ${reacted ? 'remove' : 'add'} your reaction.`}
              aria-pressed={reacted}
              className="inline-flex items-center gap-1 outline-none"
            >
              <span aria-hidden>{r.emoji}</span>
              <span key={count} className={`text-[11.5px] font-bold tabular-nums animate-[countPop_.18s_ease-out] ${reacted ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                {count}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onWho(r.emoji); }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={`See who reacted ${r.emoji}`}
              title="See who reacted"
              className={`text-[10px] leading-none rounded-full px-1 ${reacted ? 'text-white/80 hover:text-white' : 'text-slate-300 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-300'}`}
            >
              ▾
            </button>
          </span>
        );
      })}
      {extra > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onWho(shown[0]?.emoji || ''); }}
          className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 transition"
        >
          +{extra} more
        </button>
      )}
      <style>{`@keyframes countPop { 0% { transform: scale(.6); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }`}</style>
    </div>
  );
}

function WhoReactedSheet({
  msg,
  emoji,
  myId,
  onToggle,
  onClose,
}: {
  msg: ChatMessage;
  emoji: string;
  myId?: string | null;
  onToggle: (emoji: string) => void;
  onClose: () => void;
}) {
  const groups = (msg.reactions || []).filter((r) => !emoji || r.emoji === emoji);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-[fadeIn_.15s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label="Who reacted"
    >
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative w-full sm:max-w-xs bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-xl p-4 max-h-[60vh] overflow-y-auto animate-[sheetUp_.2s_ease-out]">
        <style>{`@keyframes sheetUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }`}</style>
        <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Reactions
        </div>
        {groups.length === 0 && (
          <p className="text-[13px] text-slate-400 py-3 text-center">No reactions yet.</p>
        )}
        {groups.map((g) => (
          <div key={g.emoji} className="flex items-center gap-2.5 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className="text-[22px]" aria-hidden>{g.emoji}</span>
            <span className="text-[13px] font-bold text-slate-500 tabular-nums">{(g.user_ids || []).length}</span>
            <button
              type="button"
              onClick={() => onToggle(g.emoji)}
              className={`ml-auto text-[12px] font-bold rounded-full px-3 py-1.5 transition ${
                (g.user_ids || []).includes(myId || '')
                  ? 'bg-[#2e7d4f] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {(g.user_ids || []).includes(myId || '') ? 'Remove' : 'React'}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 font-semibold text-[13.5px] py-2.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full text-left px-4 py-2 text-[13.5px] font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition ${
        danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

// Touch helper for mobile: a tap fires onTap (the anchored emoji panel),
// holding still fires onLongPress (overflow menu). Desktop mouse clicks are
// left to React's onClick on the child content — this wrapper NEVER handles
// onClick/click itself, so a tap can never "jump" to a neighbour's picker.
function LongPressWrap({
  children,
  className,
  onTap,
  onLongPress,
  onContextMenu,
  onDoubleClick,
}: {
  children: ReactNode;
  className?: string;
  onTap: () => void;
  onLongPress: () => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  onDoubleClick?: (e: ReactMouseEvent) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  const start = (x: number, y: number) => {
    moved.current = false;
    fired.current = false;
    const sx = x;
    const sy = y;
    clear();
    timer.current = setTimeout(() => {
      if (!moved.current) {
        fired.current = true;
        try {
          if (navigator.vibrate) navigator.vibrate(12);
        } catch {
          /* noop */
        }
        onLongPress();
      }
    }, LONG_PRESS_MS);
    const check = (ev: TouchEvent | MouseEvent) => {
      const t = 'touches' in ev && ev.touches.length > 0 ? ev.touches[0] : (ev as MouseEvent);
      if (Math.hypot(t.clientX - sx, t.clientY - sy) > 10) {
        moved.current = true;
        clear();
      }
    };
    const cancel = () => {
      window.removeEventListener('touchmove', check as EventListener);
      window.removeEventListener('mousemove', check as EventListener);
    };
    window.addEventListener('touchmove', check as EventListener, { passive: true });
    window.addEventListener('mousemove', check as EventListener);
    setTimeout(cancel, LONG_PRESS_MS + 150);
  };

  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    start(t.clientX, t.clientY);
  };
  // touchend: long-press already fired → swallow; otherwise a tap → quick strip
  const onTouchEnd = (e: ReactTouchEvent) => {
    const wasLong = fired.current;
    clear();
    if (!wasLong && !moved.current) {
      e.stopPropagation();
      onTap();
    }
  };
  const onTouchCancel = () => clear();

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
    >
      {children}
    </div>
  );
}
