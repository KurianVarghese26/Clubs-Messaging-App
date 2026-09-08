import { useEffect, useState } from 'react';
import { Hash, Loader2, Lock, ScanLine } from 'lucide-react';
import Modal, { PrimaryButton, inputCls } from './Modal';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { normalizeClubNumber } from '../lib/utils';
import type { Club } from '../lib/types';

export default function JoinClubModal({
  open,
  onClose,
  initialNumber,
  onJoined,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  initialNumber: string;
  onJoined: (club: Club) => void;
  notify: (t: string) => void;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [number, setNumber] = useState('');
  const [found, setFound] = useState<Club | null>(null);
  const [passkey, setPasskey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (open) {
      setStep(1);
      setError('');
      setPasskey('');
      setFound(null);
      setNumber(initialNumber || '');
      setCooldown(0);
      if (initialNumber) {
        lookup(initialNumber);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialNumber]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const lookup = async (raw?: string) => {
    const code = normalizeClubNumber(raw ?? number);
    setError('');
    if (!code || code.replace(/[^A-Z0-9]/g, '').length < 5) {
      setError('Enter a valid Club number, e.g. CLB-7F42-91K8.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/clubs?number=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.status === 429) {
        setError(data.error || 'Too many lookups. Please wait a bit.');
        setCooldown(45);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Club not found.');
      setFound(data);
      setNumber(code);
      if (data.require_passkey) {
        setStep(2);
      } else {
        await join(data.id, undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Club not found.');
    } finally {
      setBusy(false);
    }
  };

  const join = async (clubId?: string, key?: string) => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId || found?.id,
          user_id: user.id,
          passkey: key ?? passkey,
        }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setError(data.error || 'Too many attempts. Please wait.');
        setCooldown(120);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Could not join Club.');
      const club: Club = data.club || found!;
      notify(data.already_member ? 'You’re already in this Club' : `Welcome to ${club.name}`);
      onClose();
      onJoined(club);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join Club.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 1 ? 'Join a Club' : 'Passkey required'}
      subtitle={step === 1 ? 'Enter the Club number you were given.' : `“${found?.name}” is protected.`}
    >
      {step === 1 && (
        <div>
          <div className="relative">
            <Hash size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="CLB-XXXX-XXXX"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className={`${inputCls} pl-11 font-mono tracking-[0.1em] text-center text-[17px] font-bold`}
              maxLength={13}
            />
          </div>
          <p className="text-[12px] text-slate-400 mt-2 flex items-center gap-1.5 justify-center">
            <ScanLine size={13} /> Or scan the Club’s QR code from your camera — it fills this in.
          </p>
          {error && (
            <div className="mt-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-2.5">
              {error}
            </div>
          )}
          <div className="mt-4">
            <PrimaryButton onClick={() => lookup()} disabled={busy || cooldown > 0}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={17} className="animate-spin" /> Looking up…
                </span>
              ) : cooldown > 0 ? (
                `Wait ${cooldown}s…`
              ) : (
                'Continue'
              )}
            </PrimaryButton>
          </div>
        </div>
      )}

      {step === 2 && found && (
        <div>
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 mb-4">
            <Avatar name={found.name} imageUrl={found.image_url} color={found.color} size={46} />
            <div className="min-w-0">
              <div className="font-bold text-[15px] text-slate-900 dark:text-white truncate">{found.name}</div>
              <div className="text-[12px] text-slate-500 truncate">
                {found.member_count} member{found.member_count === 1 ? '' : 's'} · {found.club_number}
              </div>
              {found.description && (
                <div className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{found.description}</div>
              )}
            </div>
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="Enter Club passkey"
              autoFocus
              className={`${inputCls} pl-11`}
            />
          </div>

          {error && (
            <div className="mt-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="mt-4 space-y-2">
            <PrimaryButton onClick={() => join()} disabled={busy || cooldown > 0 || !passkey}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={17} className="animate-spin" /> Joining…
                </span>
              ) : cooldown > 0 ? (
                `Too many tries — wait ${cooldown}s`
              ) : (
                'Join Club'
              )}
            </PrimaryButton>
            <button
              onClick={() => {
                setStep(1);
                setError('');
                setPasskey('');
              }}
              className="w-full text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:underline py-1"
            >
              Use a different number
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
