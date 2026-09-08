import { useRef, useState } from 'react';
import { Camera, Loader2, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Modal, { Field, PrimaryButton, SecondaryButton, inputCls } from './Modal';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { CLUB_COLORS, uploadFile, copyText, shareText, clubInviteLink } from '../lib/utils';
import type { Club } from '../lib/types';
import { Check, Copy, QrCode, Share2, MessageCircle } from 'lucide-react';

export default function CreateClubModal({
  open,
  onClose,
  onCreated,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (club: Club) => void;
  notify: (t: string) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(CLUB_COLORS[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [needPasskey, setNeedPasskey] = useState(false);
  const [passkey, setPasskey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Club | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setColor(CLUB_COLORS[0]);
    setImageUrl(null);
    setNeedPasskey(false);
    setPasskey('');
    setError('');
    setCreated(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickImage = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const { url } = await uploadFile(f, 'club-images');
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    setError('');
    if (name.trim().length < 3) {
      setError('Club name must be at least 3 characters.');
      return;
    }
    if (needPasskey && passkey.length < 4) {
      setError('Passkey must be at least 4 characters.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          image_url: imageUrl,
          color,
          owner_id: user.id,
          require_passkey: needPasskey,
          passkey: needPasskey ? passkey : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create Club.');
      setCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create Club.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={created ? 'Club created' : 'Create a Club'}
      subtitle={created ? 'Share the number or QR so people can join.' : 'Give it a name. We’ll make the number.'}
    >
      {!created ? (
        <div>
          <div className="flex items-center gap-4 mb-5">
            <button onClick={() => fileRef.current?.click()} className="relative shrink-0 group" title="Add Club image">
              <Avatar name={name || 'New Club'} imageUrl={imageUrl} color={color} size={64} />
              <span className="absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Camera size={18} className="text-white" />
              </span>
              {uploading && (
                <span className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Loader2 size={18} className="text-white animate-spin" />
                </span>
              )}
            </button>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-[13px] font-semibold text-[#2e7d4f] dark:text-emerald-400 hover:underline"
              >
                {imageUrl ? 'Change image' : 'Add Club image'}
              </button>
              <p className="text-[12px] text-slate-400 mt-0.5">Optional. Square images look best.</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-2.5">
              {error}
            </div>
          )}

          <Field label="Club name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend Hikers"
              maxLength={40}
              className={inputCls}
            />
          </Field>

          <Field label="Description" hint="Optional — what is this Club about?">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short line about the Club…"
              maxLength={140}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </Field>

          <div className="mb-4">
            <span className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200 mb-2">Colour</span>
            <div className="flex gap-2">
              {CLUB_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 dark:ring-offset-slate-900' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Colour ${c}`}
                >
                  {color === c && <Check size={14} className="text-white mx-auto" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Lock size={16} className="text-slate-400" />
                <div>
                  <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">Require passkey</div>
                  <div className="text-[12px] text-slate-400">Only people with the passkey can join.</div>
                </div>
              </div>
              <button
                onClick={() => setNeedPasskey((v) => !v)}
                className={`w-11 h-6.5 rounded-full transition-colors relative shrink-0 ${needPasskey ? 'bg-[#2e7d4f]' : 'bg-slate-200 dark:bg-slate-700'}`}
                style={{ height: 26 }}
                role="switch"
                aria-checked={needPasskey}
              >
                <span
                  className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all ${needPasskey ? 'left-[22px]' : 'left-[3px]'}`}
                />
              </button>
            </div>
            {needPasskey && (
              <input
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Set a passkey (min 4 characters)"
                className={`${inputCls} mt-3`}
              />
            )}
          </div>

          <PrimaryButton onClick={submit} disabled={busy || uploading}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={17} className="animate-spin" /> Creating…
              </span>
            ) : (
              'Create Club'
            )}
          </PrimaryButton>
        </div>
      ) : (
        <CreatedPanel
          club={created}
          notify={notify}
          onOpen={() => {
            const c = created;
            close();
            onCreated(c);
          }}
        />
      )}
    </Modal>
  );
}

export function CreatedPanel({ club, notify, onOpen }: { club: Club; notify: (t: string) => void; onOpen: () => void }) {
  const [showQR, setShowQR] = useState(false);
  const link = clubInviteLink(club);
  const qrValue = `clubs://join?n=${club.club_number}${club.invite_token ? `&t=${club.invite_token}` : ''}|${link}`;

  const doCopy = async () => {
    const ok = await copyText(club.club_number);
    notify(ok ? 'Club number copied' : 'Copy failed — long-press to copy');
  };

  const doShare = () => {
    const shared = shareText(
      `Join my Club: ${club.name}`,
      `Join my Club "${club.name}" on Clubs. Club number: ${club.club_number}`,
      link
    );
    if (!shared) {
      copyText(`Join my Club "${club.name}" on Clubs. Club number: ${club.club_number} — ${link}`).then((ok) =>
        notify(ok ? 'Invite copied — paste it anywhere' : 'Sharing is not supported here')
      );
    }
  };

  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-[#2e7d4f]/10 flex items-center justify-center mx-auto mb-3">
        <Check size={24} className="text-[#2e7d4f]" strokeWidth={2.5} />
      </div>
      <div className="font-bold text-[17px] text-slate-900 dark:text-white tracking-tight">{club.name}</div>
      <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">Anyone with this number can find and join.</p>

      <button
        onClick={doCopy}
        className="mt-4 w-full rounded-2xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 py-4 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition group"
        title="Tap to copy"
      >
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Club number</div>
        <div className="font-mono font-bold text-[24px] tracking-[0.12em] text-slate-900 dark:text-white mt-1">
          {club.club_number}
        </div>
        <div className="text-[11.5px] text-slate-400 mt-1 group-hover:text-slate-500">Tap to copy</div>
      </button>

      {club.require_passkey && (
        <p className="mt-2 text-[12px] text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
          <Lock size={12} /> Protected with a passkey — share it separately.
        </p>
      )}

      {showQR && (
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 bg-white dark:bg-slate-900">
          <div className="bg-white rounded-2xl p-3 inline-block">
            <QRCodeSVG value={qrValue} size={176} level="M" />
          </div>
          <p className="text-[12px] text-slate-400 mt-2">Scan to open the invite for {club.club_number}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={doCopy}
          className="rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[13.5px] py-3 flex items-center justify-center gap-1.5 transition"
        >
          <Copy size={15} /> Copy
        </button>
        <button
          onClick={doShare}
          className="rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[13.5px] py-3 flex items-center justify-center gap-1.5 transition"
        >
          <Share2 size={15} /> Share
        </button>
        <button
          onClick={() => setShowQR((v) => !v)}
          className="rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[13.5px] py-3 flex items-center justify-center gap-1.5 transition"
        >
          <QrCode size={15} /> {showQR ? 'Hide QR' : 'Show QR'}
        </button>
        <button
          onClick={onOpen}
          className="rounded-2xl bg-[#2e7d4f] hover:bg-[#276b43] text-white font-semibold text-[13.5px] py-3 flex items-center justify-center gap-1.5 transition"
        >
          <MessageCircle size={15} /> Open Club
        </button>
      </div>

      <div className="mt-4">
        <SecondaryButton onClick={onOpen}>Done</SecondaryButton>
      </div>
    </div>
  );
}
