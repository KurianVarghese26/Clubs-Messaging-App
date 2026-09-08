export const ACCENT = '#2e7d4f';
export const ACCENT_DARK = '#3aa065';

export const CLUB_COLORS = ['#2e7d4f', '#3366aa', '#7a4fa3', '#b3541e', '#a33a5b', '#0e7c86', '#4a545e'];
export const AVATAR_COLORS = ['#2e7d4f', '#3366aa', '#7a4fa3', '#b3541e', '#a33a5b', '#0e7c86'];

export function initials(name: string): string {
  const parts = String(name || '?').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (now.getTime() - d.getTime() < 7 * 86400000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function fmtFullTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fmtMsgTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtBytes(n: number | null | undefined): string {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function isLinkText(t: string): boolean {
  const s = String(t || '').trim();
  return /^(https?:\/\/|www\.)[^\s<>"')\]]+$/i.test(s);
}

export function lastMessagePreview(m: { kind?: string; body?: string; sender_name?: string } | null | undefined): string {
  if (!m) return 'No messages yet';
  if (m.kind === 'image') return `${m.sender_name || 'Someone'} sent a photo`;
  if (m.kind === 'video') return `${m.sender_name || 'Someone'} sent a video`;
  if (m.kind === 'voice') return `${m.sender_name || 'Someone'} sent a voice message`;
  if (m.kind === 'file') return `${m.sender_name || 'Someone'} sent a file`;
  const b = (m.body || '').trim();
  if (isLinkText(b)) return `${m.sender_name || 'Someone'} sent a link`;
  return b.length > 64 ? b.slice(0, 64) + '…' : b || 'Say hello';
}

export function dmPreview(m: { kind?: string; body?: string } | null | undefined): string {
  if (!m) return 'Say hello';
  if (m.kind === 'image') return 'Photo';
  if (m.kind === 'video') return 'Video';
  if (m.kind === 'voice') return 'Voice message';
  if (m.kind === 'file') return 'File';
  const b = (m.body || '').trim();
  if (isLinkText(b)) return 'Link';
  return b.length > 64 ? b.slice(0, 64) + '…' : b || 'Say hello';
}

export function clubInviteLink(club: { club_number: string; invite_token?: string }): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({ n: club.club_number });
  if (club.invite_token) params.set('t', club.invite_token);
  return `${base}/join?${params.toString()}`;
}

export function normalizeClubNumber(raw: string): string {
  const cleaned = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.startsWith('CLB') && cleaned.length === 11) {
    return `CLB-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (/^[A-Z0-9]{8}$/.test(cleaned)) {
    return `CLB-${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return String(raw || '').toUpperCase().trim();
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function uploadFile(
  file: File,
  folder: string
): Promise<{ url: string; path: string }> {
  const base64 = await fileToBase64(file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, fileBase64: base64, contentType: file.type, folder }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed.');
  return data;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export function shareText(title: string, text: string, url?: string): boolean {
  try {
    const nav = navigator as Navigator & {
      share?: (d: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof nav.share === 'function') {
      nav.share({ title, text, url }).catch(() => undefined);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}
