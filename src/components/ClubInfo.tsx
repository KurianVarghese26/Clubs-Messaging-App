import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Copy, Crown, Loader2, Lock, LogOut, QrCode, Share2, Shield, Trash2, UserMinus, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import Modal, { Field, PrimaryButton, SecondaryButton, inputCls } from './Modal';
import Avatar from './Avatar';
import VerifiedTick from './VerifiedTick';
import { useCeo } from '../lib/ceo';
import { useAuth } from '../contexts/AuthContext';
import { CLUB_COLORS, uploadFile, copyText, shareText, clubInviteLink } from '../lib/utils';
import type { Club, Member } from '../lib/types';

export default function ClubInfo({
  clubId,
  onClose,
  onChanged,
  notify,
}: {
  clubId: string | null;
  onClose: () => void;
  onChanged: () => void;
  notify: (t: string) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(CLUB_COLORS[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [passkeyMode, setPasskeyMode] = useState<'off' | 'keep' | 'change' | 'set'>('keep');
  const [passkey, setPasskey] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = !!clubId;

  useEffect(() => {
    if (!clubId) {
      setClub(null);
      setMembers([]);
      setEditing(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    (async () => {
      try {
        const [cRes, mRes] = await Promise.all([
          fetch(`/api/clubs?id=${encodeURIComponent(clubId)}`),
          fetch(`/api/members?club_id=${encodeURIComponent(clubId)}`),
        ]);
        const c = await cRes.json();
        const m = await mRes.json();
        if (!cRes.ok) throw new Error(c.error || 'Club not found.');
        setClub(c);
        setMembers(mRes.ok ? m : []);
        setName(c.name);
        setDescription(c.description || '');
        setColor(c.color || CLUB_COLORS[0]);
        setImageUrl(c.image_url || null);
        setPasskeyMode(c.require_passkey ? 'keep' : 'off');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load Club.');
      } finally {
        setLoading(false);
      }
    })();
  }, [clubId]);

  if (!open) return null;

  const myMem = members.find((m) => m.user_id === user?.id);
  const myRole = myMem?.role || (club?.owner_id === user?.id ? 'owner' : 'member');
  const canEdit = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';
  const { isCeo, ceoId } = useCeo();
  // CEO fallback powers: allow him to moderate any club (server still enforces club-owner rules;
  // CEO privileges apply to his own memberships + readonly visibility here)
  void ceoId;

  const refresh = async () => {
    if (!clubId) return;
    const [cRes, mRes] = await Promise.all([
      fetch(`/api/clubs?id=${encodeURIComponent(clubId)}`),
      fetch(`/api/members?club_id=${encodeURIComponent(clubId)}`),
    ]);
    const c = await cRes.json();
    if (cRes.ok) {
      setClub(c);
      setName(c.name);
      setDescription(c.description || '');
      setColor(c.color || CLUB_COLORS[0]);
      setImageUrl(c.image_url || null);
    }
    const m = await mRes.json();
    if (mRes.ok) setMembers(m);
    onChanged();
  };

  const save = async () => {
    if (!club || !user) return;
    setError('');
    if (name.trim().length < 3) {
      setError('Club name must be at least 3 characters.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        id: club.id,
        requester_id: user.id,
        name: name.trim(),
        description: description.trim(),
        image_url: imageUrl,
        color,
      };
      if (isOwner) {
        if (passkeyMode === 'off') body.require_passkey = false;
        else if (passkeyMode === 'set' || passkeyMode === 'change') {
          if (passkey.length < 4) throw new Error('Passkey must be at least 4 characters.');
          body.require_passkey = true;
          body.passkey = passkey;
        }
      }
      const res = await fetch('/api/clubs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save.');
      setClub(data);
      setEditing(false);
      setPasskey('');
      setPasskeyMode(data.require_passkey ? 'keep' : 'off');
      notify('Club updated');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(f, 'club-images');
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const changeRole = async (targetUserId: string, role: 'admin' | 'member') => {
    if (!club || !user) return;
    setBusyMember(targetUserId);
    try {
      const res = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: club.id, requester_id: user.id, user_id: targetUserId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change role.');
      notify(role === 'admin' ? 'Made admin' : 'Removed admin');
      refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not change role.');
    } finally {
      setBusyMember(null);
    }
  };

  const removeMember = async (targetUserId: string) => {
    if (!club || !user) return;
    setBusyMember(targetUserId);
    try {
      const res = await fetch('/api/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: club.id, requester_id: user.id, user_id: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove.');
      notify('Member removed');
      refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove.');
    } finally {
      setBusyMember(null);
    }
  };

  const leave = async () => {
    if (!club || !user) return;
    try {
      const res = await fetch('/api/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ club_id: club.id, user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not leave.');
      notify(data.deleted ? 'Club deleted' : 'You left the Club');
      onClose();
      navigate('/chats');
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not leave.');
    }
  };

  const destroy = async () => {
    if (!club || !user) return;
    try {
      const res = await fetch(`/api/clubs?id=${encodeURIComponent(club.id)}&requester_id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete.');
      notify('Club deleted');
      onClose();
      navigate('/chats');
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not delete.');
    }
  };

  const roleBadge = (role: string) => {
    if (role === 'owner')
      return (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          <Crown size={11} /> Owner
        </span>
      );
    if (role === 'admin')
      return (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-[#2e7d4f] dark:text-emerald-400">
          <Shield size={11} /> Admin
        </span>
      );
    return <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Member</span>;
  };

  return (
    <Modal open={open} onClose={onClose} title="Club info" wide>
      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : error && !club ? (
        <div className="py-6 text-center">
          <p className="text-[14px] text-red-600 font-medium">{error}</p>
          <div className="mt-4">
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          </div>
        </div>
      ) : club ? (
        <div>
          {/* Header card */}
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <Avatar name={club.name} imageUrl={imageUrl} color={color} size={68} />
              {editing && canEdit && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center"
                  aria-label="Change image"
                >
                  {uploading ? (
                    <Loader2 size={18} className="text-white animate-spin" />
                  ) : (
                    <Camera size={18} className="text-white" />
                  )}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
            </div>
            <div className="flex-1 min-w-0">
              {!editing ? (
                <>
                  <div className="font-bold text-[18px] tracking-tight text-slate-900 dark:text-white leading-tight">
                    {club.name}
                  </div>
                  <div className="font-mono text-[12px] text-slate-400 tracking-widest mt-0.5">{club.club_number}</div>
                  {club.description && (
                    <p className="text-[13.5px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{club.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[12px] text-slate-400">
                    <span>
                      {members.length} member{members.length === 1 ? '' : 's'}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Lock size={11} /> {club.require_passkey ? 'Passkey protected' : 'Open to anyone with the number'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="space-y-2.5">
                  <Field label="Name">
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={inputCls} />
                  </Field>
                  <Field label="Description">
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} rows={2} className={`${inputCls} resize-none`} />
                  </Field>
                  <div>
                    <span className="block text-[13px] font-semibold mb-1.5">Colour</span>
                    <div className="flex gap-2">
                      {CLUB_COLORS.map((c) => (
                        <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full" style={{ backgroundColor: c }}>
                          {color === c && <Check size={13} className="text-white mx-auto" strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isOwner && (
                    <div>
                      <span className="block text-[13px] font-semibold mb-1.5">Passkey</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPasskeyMode('off')}
                          className={`text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 border ${passkeyMode === 'off' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-700'}`}
                        >
                          No passkey
                        </button>
                        {club.require_passkey && (
                          <button
                            onClick={() => setPasskeyMode('keep')}
                            className={`text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 border ${passkeyMode === 'keep' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-700'}`}
                          >
                            Keep current
                          </button>
                        )}
                        <button
                          onClick={() => setPasskeyMode(club.require_passkey ? 'change' : 'set')}
                          className={`text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 border ${(passkeyMode === 'change' || passkeyMode === 'set') ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'border-slate-200 dark:border-slate-700'}`}
                        >
                          {club.require_passkey ? 'Change passkey' : 'Set passkey'}
                        </button>
                      </div>
                      {(passkeyMode === 'change' || passkeyMode === 'set') && (
                        <input
                          type="password"
                          value={passkey}
                          onChange={(e) => setPasskey(e.target.value)}
                          placeholder="New passkey (min 4)"
                          className={`${inputCls} mt-2`}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 text-[13px] font-medium px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={() => copyText(club.club_number).then((ok) => notify(ok ? 'Club number copied' : 'Copy failed'))}
              className="rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[12.5px] py-2.5 flex items-center justify-center gap-1.5 transition"
            >
              <Copy size={14} /> Copy
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
              className="rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[12.5px] py-2.5 flex items-center justify-center gap-1.5 transition"
            >
              <Share2 size={14} /> Share
            </button>
            <button
              onClick={() => setQrOpen((v) => !v)}
              className="rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-[12.5px] py-2.5 flex items-center justify-center gap-1.5 transition"
            >
              <QrCode size={14} /> QR
            </button>
          </div>

          {qrOpen && (
            <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-center bg-white dark:bg-slate-900">
              <div className="bg-white rounded-2xl p-2 inline-block">
                <QRCodeSVG value={`clubs://join?n=${club.club_number}${club.invite_token ? `&t=${club.invite_token}` : ''}|${clubInviteLink(club)}`} size={150} level="M" />
              </div>
              <p className="text-[12px] text-slate-400 mt-2">Scan to join {club.club_number}</p>
            </div>
          )}

          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="mt-3 w-full rounded-2xl border border-slate-200 dark:border-slate-700 font-semibold text-[13.5px] py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Edit Club
            </button>
          )}
          {editing && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setEditing(false);
                  setName(club.name);
                  setDescription(club.description || '');
                  setColor(club.color || CLUB_COLORS[0]);
                  setImageUrl(club.image_url);
                  setPasskey('');
                  setError('');
                }}
                className="flex-1 rounded-2xl bg-slate-100 dark:bg-slate-800 font-semibold text-[13.5px] py-2.5"
              >
                Cancel
              </button>
              <div className="flex-[2]">
                <PrimaryButton onClick={save} disabled={saving || uploading}>
                  {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Save changes'}
                </PrimaryButton>
              </div>
            </div>
          )}

          {/* Members */}
          <div className="mt-5">
            <div className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Members · {members.length}
            </div>
            <div className="space-y-1 -mx-2">
              {members.map((m) => {
                const p = m.profile;
                const isMe = m.user_id === user?.id;
                return (
                  <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <Avatar name={p?.display_name || 'Member'} imageUrl={p?.avatar_url} color={p?.avatar_color} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[14px] truncate inline-flex items-center gap-1.5">
                        {p?.display_name || 'Member'} {isMe && <span className="text-slate-400 font-normal">(you)</span>}
                        <VerifiedTick userId={m.user_id} username={p?.username} size={14} />
                        {(p?.username === 'ceo' || p?.bio === 'CEO of Clubs') && (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-full px-2 py-0.5">
                            CEO
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-slate-400 truncate">@{p?.username || 'user'}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {roleBadge(m.role)}
                      {isOwner && !isMe && m.role !== 'owner' && (
                        <>
                          {busyMember === m.user_id ? (
                            <Loader2 size={15} className="animate-spin text-slate-400" />
                          ) : (
                            <>
                              <button
                                onClick={() => changeRole(m.user_id, m.role === 'admin' ? 'member' : 'admin')}
                                title={m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                                className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                              >
                                <Shield size={15} />
                              </button>
                              <button
                                onClick={() => removeMember(m.user_id)}
                                title="Remove"
                                className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-950/50 text-slate-500 hover:text-red-600"
                              >
                                <UserMinus size={15} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                      {myRole === 'admin' && m.role === 'member' && !isMe && (
                        <button
                          onClick={() => removeMember(m.user_id)}
                          title="Remove"
                          className="p-1.5 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600"
                        >
                          {busyMember === m.user_id ? <Loader2 size={15} className="animate-spin" /> : <UserMinus size={15} />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Role legend */}
            <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="font-bold text-slate-600 dark:text-slate-300">Roles — </span>
              Owners manage everything including the passkey. Admins can edit details and remove members. Members chat
              and invite with the number.
              {isCeo && (
                <span className="block mt-1.5 font-semibold text-sky-600 dark:text-sky-400">
                  Signed in as CEO — you carry admin rights across Clubs you belong to.
                </span>
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            {!confirmLeave ? (
              <button
                onClick={() => setConfirmLeave(true)}
                className="w-full rounded-2xl text-red-600 dark:text-red-400 font-semibold text-[13.5px] py-2.5 hover:bg-red-50 dark:hover:bg-red-950/30 transition flex items-center justify-center gap-1.5"
              >
                <LogOut size={15} /> Leave Club
              </button>
            ) : (
              <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 p-3.5">
                <p className="text-[13px] font-medium text-red-700 dark:text-red-300">
                  {isOwner ? 'You’re the owner. Leaving passes ownership to the longest-standing member.' : 'Leave this Club? You’ll need the number to rejoin.'}
                </p>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => setConfirmLeave(false)} className="flex-1 rounded-xl bg-white dark:bg-slate-800 text-[13px] font-semibold py-2 flex items-center justify-center gap-1">
                    <X size={14} /> Stay
                  </button>
                  <button onClick={leave} className="flex-1 rounded-xl bg-red-600 text-white text-[13px] font-semibold py-2">
                    Leave
                  </button>
                </div>
              </div>
            )}
            {isOwner &&
              (!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full rounded-2xl text-slate-400 hover:text-red-600 font-semibold text-[13px] py-2 transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete Club permanently
                </button>
              ) : (
                <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 p-3.5">
                  <p className="text-[13px] font-medium text-red-700 dark:text-red-300">
                    Delete “{club.name}” for everyone? This cannot be undone.
                  </p>
                  <div className="flex gap-2 mt-2.5">
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl bg-white dark:bg-slate-800 text-[13px] font-semibold py-2">
                      Cancel
                    </button>
                    <button onClick={destroy} className="flex-1 rounded-xl bg-red-600 text-white text-[13px] font-semibold py-2">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
