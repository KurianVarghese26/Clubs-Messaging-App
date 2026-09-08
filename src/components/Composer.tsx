import { useEffect, useRef, useState } from 'react';
import { ImagePlus, FolderUp, Link2, Mic, Send, X, Loader2, Plus, Trash2, CornerUpLeft, Clapperboard, Phone, PhoneOff } from 'lucide-react';
import { uploadFile } from '../lib/utils';
import type { ChatMessage } from '../lib/types';

export type SendKind = 'text' | 'image' | 'video' | 'file' | 'voice';

export default function Composer({
  onSend,
  replyTo,
  onCancelReply,
  sending,
  followUpHint,
  peerName,
  onStartCall,
  inCall,
}: {
  onSend: (p: { kind: SendKind; body: string; file_url?: string; file_name?: string; file_size?: number; duration_sec?: number }, opts?: { followUpTo?: string | null }) => Promise<void>;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  sending: boolean;
  followUpHint?: string | null;
  peerName?: string;
  onStartCall?: () => void;
  inCall?: boolean;
}) {
  const [text, setText] = useState('');
  const [attBusy, setAttBusy] = useState(false);
  const [attError, setAttError] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkError, setLinkError] = useState('');
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const imgRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const secsRef = useRef(0);
  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; timer: ReturnType<typeof setInterval>; sent: boolean } | null>(null);

  useEffect(() => {
    if (replyTo) taRef.current?.focus();
  }, [replyTo]);

  // Close attach sheet on outside tap / Escape
  useEffect(() => {
    if (!attachOpen) return;
    const onDown = (e: PointerEvent) => {
      if (attachRef.current?.contains(e.target as Node)) return;
      setAttachOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAttachOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [attachOpen]);

  const hasText = text.trim().length > 0;

  const sendText = async () => {
    const t = text.trim();
    if (!t || sending || attBusy || recording) return;
    setText('');
    if (taRef.current) taRef.current.style.height = 'auto';
    await onSend({ kind: 'text', body: t });
  };

  const sendAttachment = async (file: File, kind: 'image' | 'video' | 'file' | 'voice', extra?: { duration_sec?: number }) => {
    setAttError('');
    if (kind === 'video' && file.size > 60 * 1024 * 1024) {
      setAttError('Video is too large (max 60 MB).');
      return;
    }
    setAttBusy(true);
    try {
      const { url } = await uploadFile(file, kind === 'image' ? 'images' : kind === 'video' ? 'videos' : kind === 'voice' ? 'voice' : 'files');
      await onSend({
        kind,
        body: kind === 'image' || kind === 'video' ? text.trim() : kind === 'voice' ? '' : file.name,
        file_url: url,
        file_name: file.name,
        file_size: file.size,
        duration_sec: extra?.duration_sec,
      });
      setText('');
    } catch (err) {
      setAttError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setAttBusy(false);
    }
  };

  const normalizeUrl = (raw: string): string | null => {
    let u = raw.trim();
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      const parsed = new URL(u);
      if (!parsed.hostname.includes('.')) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const sendLink = async () => {
    const url = normalizeUrl(linkUrl);
    if (!url) {
      setLinkError('Enter a valid link, e.g. example.com');
      return;
    }
    setLinkError('');
    const label = linkLabel.trim();
    const followUpTo = replyTo?.id ?? null;
    setLinkOpen(false);
    setLinkUrl('');
    setLinkLabel('');
    await onSend({ kind: 'text', body: label ? `${label} ${url}` : url }, { followUpTo });
  };

  const startRecording = async () => {
    if (recording || sending || attBusy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      const entry = { rec, chunks, timer: null as unknown as ReturnType<typeof setInterval>, sent: false };
      secsRef.current = 0;
      setRecSecs(0);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!entry.sent) return;
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size > 0) {
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
          await sendAttachment(file, 'voice', { duration_sec: secsRef.current });
        }
        secsRef.current = 0;
        setRecSecs(0);
      };
      entry.timer = setInterval(() => {
        secsRef.current += 1;
        setRecSecs(secsRef.current);
      }, 1000);
      recRef.current = entry;
      rec.start();
      setRecording(true);
    } catch {
      setAttError('Microphone unavailable. Check browser permissions.');
    }
  };

  const cancelRecording = () => {
    const r = recRef.current;
    if (!r) return;
    clearInterval(r.timer);
    r.sent = false;
    recRef.current = null;
    setRecording(false);
    secsRef.current = 0;
    setRecSecs(0);
    try {
      r.rec.stop();
    } catch {
      /* noop */
    }
  };

  const sendRecording = () => {
    const r = recRef.current;
    if (!r) return;
    clearInterval(r.timer);
    r.sent = true;
    recRef.current = null;
    setRecording(false);
    try {
      r.rec.stop();
    } catch {
      /* noop */
    }
  };

  const busy = sending || attBusy;

  return (
    <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-800 bg-[#f6f7f6] dark:bg-slate-950 px-3 sm:px-4 pt-2 pb-3">
      {attError && (
        <div className="mb-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-[12.5px] font-medium px-3 py-2 flex items-center justify-between">
          {attError}
          <button onClick={() => setAttError('')} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {replyTo && !recording && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-3 pr-2 py-2">
          <CornerUpLeft size={15} className="text-[#2e7d4f] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] font-bold text-[#2e7d4f] dark:text-emerald-400">
              {followUpHint ? 'Follow-up' : 'Reply'} · {replyTo.sender_name}
            </div>
            <div className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">
              {replyTo.kind === 'text' ? replyTo.body : replyTo.kind === 'image' ? 'Photo' : replyTo.kind === 'video' ? 'Video' : replyTo.kind === 'voice' ? 'Voice message' : 'File'}
            </div>
          </div>
          <button onClick={onCancelReply} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cancel follow-up">
            <X size={15} className="text-slate-400" />
          </button>
        </div>
      )}

      {linkOpen && !recording && (
        <div className="mb-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
          <div className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-2">Follow-up link</div>
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendLink()}
            placeholder="Paste a link to follow up on…"
            inputMode="url"
            autoFocus
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 text-[14px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20 mb-2"
          />
          <input
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendLink()}
            placeholder="Why are you sharing it? (follow-up note)"
            maxLength={200}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 text-[14px] outline-none focus:border-[#2e7d4f] focus:ring-2 focus:ring-[#2e7d4f]/20"
          />
          {linkError && <p className="text-[12px] text-red-500 font-medium mt-1.5">{linkError}</p>}
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={() => {
                setLinkOpen(false);
                setLinkError('');
              }}
              className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[13px] font-semibold py-2"
            >
              Cancel
            </button>
            <button onClick={sendLink} className="flex-1 rounded-xl bg-[#2e7d4f] text-white text-[13px] font-semibold py-2">
              Send follow-up
            </button>
          </div>
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-3 rounded-[22px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pl-4 pr-2 py-2">
          <span className="relative flex w-2.5 h-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-200 font-mono tabular-nums min-w-[42px]">
            {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}
          </span>
          <span className="flex-1 min-w-0 text-[12.5px] text-slate-400 truncate">
            {recSecs < 1 ? 'Listening…' : 'Recording voice message…'}
          </span>
          <button
            onClick={cancelRecording}
            aria-label="Discard recording"
            title="Discard"
            className="h-9 px-3 rounded-full text-[12.5px] font-semibold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition"
          >
            <Trash2 size={15} /> Discard
          </button>
          <button
            onClick={sendRecording}
            aria-label="Send voice message"
            title="Send"
            className="h-9 pl-3.5 pr-4 rounded-full bg-[#2e7d4f] hover:bg-[#276b43] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Send size={14} /> Send
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          {/* Single attach button with sheet */}
          <div className="relative shrink-0" ref={attachRef}>
            <button
              onClick={() => setAttachOpen((v) => !v)}
              disabled={busy}
              className={`p-2.5 rounded-full transition disabled:opacity-40 ${
                attachOpen
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
              title="Attach"
              aria-label="Attach"
              aria-expanded={attachOpen}
            >
              <Plus size={21} className={`transition-transform ${attachOpen ? 'rotate-45' : ''}`} />
            </button>
            {attachOpen && (
              <div className="absolute bottom-12 left-0 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg py-1.5 min-w-[168px]">
                <AttachItem
                  icon={<ImagePlus size={16} />}
                  label="Photo"
                  onClick={() => {
                    setAttachOpen(false);
                    imgRef.current?.click();
                  }}
                />
                <AttachItem
                  icon={<Clapperboard size={16} />}
                  label="Video"
                  onClick={() => {
                    setAttachOpen(false);
                    videoRef.current?.click();
                  }}
                />
                <AttachItem
                  icon={<FolderUp size={16} />}
                  label="File"
                  onClick={() => {
                    setAttachOpen(false);
                    fileRef.current?.click();
                  }}
                />
                <AttachItem
                  icon={<Link2 size={16} />}
                  label="Follow-up link"
                  onClick={() => {
                    setAttachOpen(false);
                    setLinkOpen(true);
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex-1 rounded-[22px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus-within:border-[#2e7d4f] focus-within:ring-2 focus-within:ring-[#2e7d4f]/20 transition flex items-end">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              placeholder="Message…  (tap a bubble → Follow-up to thread it)"
              rows={1}
              maxLength={4000}
              className="flex-1 bg-transparent outline-none resize-none px-4 py-3 text-[15px] placeholder:text-slate-400 max-h-[120px]"
            />
          </div>

          {/* Call button (1-to-1 voice call, in-app WebRTC) */}
          {onStartCall && (
            <button
              onClick={onStartCall}
              className="w-11 h-11 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 transition active:scale-95"
              title={inCall ? 'In call…' : `Call ${peerName || 'peer'}`}
              aria-label={inCall ? 'In call' : 'Start voice call'}
            >
              <Phone size={19} />
            </button>
          )}

          {/* Morphing mic / send button — one clean action */}
          {busy ? (
            <span className="w-11 h-11 rounded-full bg-[#2e7d4f]/70 text-white flex items-center justify-center shrink-0" aria-label="Sending">
              <Loader2 size={18} className="animate-spin" />
            </span>
          ) : hasText ? (
            <button
              onClick={sendText}
              className="w-11 h-11 rounded-full bg-[#2e7d4f] hover:bg-[#276b43] text-white flex items-center justify-center shrink-0 transition shadow-sm active:scale-95"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="w-11 h-11 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 transition active:scale-95"
              title="Record voice message"
              aria-label="Record voice message"
            >
              <Mic size={20} />
            </button>
          )}
        </div>
      )}

      <input
        ref={imgRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) sendAttachment(f, 'image');
          e.target.value = '';
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) sendAttachment(f, 'video');
          e.target.value = '';
        }}
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) sendAttachment(f, 'file');
          e.target.value = '';
        }}
      />
    </div>
  );
}

function AttachItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition text-left"
    >
      <span className="text-[#2e7d4f] dark:text-emerald-400">{icon}</span>
      {label}
    </button>
  );
}
