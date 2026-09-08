import type { ReactNode } from 'react';

function splitLinks(text: string): ReactNode[] {
  const re = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/gi;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    let url = m[0];
    let trail = '';
    const trailMatch = url.match(/[.,!?;:)\]]+$/);
    if (trailMatch) {
      trail = trailMatch[0];
      url = url.slice(0, -trail.length);
    }
    if (m.index > last) out.push(text.slice(last, m.index));
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    out.push(
      <a
        key={`l${k++}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(e) => e.stopPropagation()}
        className="underline underline-offset-2 break-all font-medium"
      >
        {url}
      </a>
    );
    if (trail) out.push(trail);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function RichText({ text, mine }: { text: string; mine: boolean }) {
  const parts = splitLinks(text);
  if (parts.length === 0) return null;
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <span key={i}>{part}</span>
        ) : (
          <span key={i} className="contents" data-mine={mine}>
            {part}
          </span>
        )
      )}
      <style>{`
        [data-mine="true"] a { color: #fff !important; text-decoration-color: rgba(255,255,255,.7) !important; }
        [data-mine="false"] a { color: #1f6a41 !important; }
        .dark [data-mine="false"] a { color: #6ee7b7 !important; }
      `}</style>
    </span>
  );
}
