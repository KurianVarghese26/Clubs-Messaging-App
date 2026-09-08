import { useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';

// Minimal waveform bars, matched to the reference: slim, evenly spaced,
// flat (not pill-rounded), ink-black on light grey.
function barsFor(seed: string, n = 34): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let x = h >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out.push(10 + Math.round((x / 4294967296) * 22)); // 10..32px
  }
  return out;
}

export default function VoicePlayer({
  url,
  mine,
  duration,
  fileName,
  timeLabel,
}: {
  url: string;
  mine: boolean;
  duration?: number | null;
  fileName?: string | null;
  timeLabel?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(duration || 0);
  const [failed, setFailed] = useState(false);
  const bars = useMemo(() => barsFor(url), [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      // Some mobile browsers swallow pause() on a hidden element: force it.
      setTimeout(() => {
        if (a && !a.paused) {
          try {
            a.pause();
          } catch {
            /* noop */
          }
          setPlaying(a.paused ? false : true);
        }
      }, 60);
      return;
    }
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.then(() => {
        setPlaying(true);
        setFailed(false);
      }).catch(() => {
        // Autoplay/codec block: surface a caption state instead of silence.
        setPlaying(false);
        setFailed(true);
      });
    }
  };

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    a.currentTime = ratio * dur;
    setCur(ratio * dur);
  };

  const progress = dur > 0 ? Math.min(cur / dur, 1) : 0;
  const playedCount = Math.round(progress * bars.length);

  // WhatsApp-style player: big circular PLAY button on the LEFT (always
  // visible, high-contrast), waveform bars beside it. The button uses
  // onPointerDown for an instant response; the card toggles on click and the
  // bars seek. Caption below carries file/time.
  return (
    <span className="block mb-1 select-none">
    <div
      className={`flex items-center gap-2.5 rounded-[16px] pl-2.5 pr-3.5 py-2 min-w-[228px] max-w-[276px] select-none cursor-pointer ${
        mine ? 'bg-black/15' : 'bg-[#f1f1f3] dark:bg-white/10'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      role="button"
      tabIndex={0}
      aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        title={playing ? 'Pause' : 'Play'}
        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition active:scale-90 shadow-sm ${
          mine ? 'bg-white text-[#1f5c39]' : 'bg-[#2e7d4f] text-white dark:bg-white dark:text-slate-900'
        }`}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="4.5" width="4.4" height="15" rx="1.2" />
            <rect x="13.6" y="4.5" width="4.4" height="15" rx="1.2" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ marginLeft: 2 }}>
            <path d="M7 4.2v15.6a.8.8 0 0 0 1.22.68l12.06-7.8a.8.8 0 0 0 0-1.36L8.22 3.52A.8.8 0 0 0 7 4.2Z" />
          </svg>
        )}
      </button>
      <div
        onClick={(e) => {
          e.stopPropagation();
          seek(e);
        }}
        role="slider"
        aria-label="Seek voice message"
        aria-valuemin={0}
        aria-valuemax={Math.round(dur)}
        aria-valuenow={Math.round(cur)}
        className="flex-1 flex items-center gap-[3px] h-8 cursor-pointer min-w-0"
      >
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}px` }}
            className={`w-[3.5px] shrink-0 bg-[#1c1c1e] dark:bg-white ${
              i < playedCount ? 'opacity-100' : 'opacity-25'
            }`}
          />
        ))}
      </div>
    </div>
    {(fileName || timeLabel || failed) && (
      <span
        className={`block mt-1 text-[11px] truncate max-w-[272px] ${
          mine ? 'text-white/75' : 'text-slate-400'
        }`}
      >
        {failed ? 'Audio unavailable — tap to retry' : [fileName, timeLabel].filter(Boolean).join(' · ')}
      </span>
    )}

    <audio
      ref={audioRef}
      src={url}
      preload="metadata"
      className="hidden"
      onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
      onError={() => {
        setFailed(true);
        setPlaying(false);
      }}
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (isFinite(d) && d > 0) {
          setDur((prev) => prev || d);
          setFailed(false);
        }
      }}
      onEnded={() => {
        setPlaying(false);
        setCur(0);
      }}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
    />
    </span>
  );
}
