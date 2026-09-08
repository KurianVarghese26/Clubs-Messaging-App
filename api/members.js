import supabase from './db-client.js';
import crypto from 'crypto';

const CEO_EMAIL = 'kurianvarghese26@gmail.com';
const CEO_USERNAME = 'ceo';

async function isCeoUser(user_id) {
  try {
    const { data: userRes } = await supabase.auth.admin.getUserById(user_id);
    const email = userRes?.user?.email || '';
    if (email.toLowerCase() === CEO_EMAIL) return true;
  } catch {
    /* fall through to username check */
  }
  try {
    const { data: prof } = await supabase.from('profiles').select('username').eq('id', user_id).maybeSingle();
    if ((prof?.username || '').toLowerCase() === CEO_USERNAME) return true;
  } catch {
    /* ignore */
  }
  return false;
}

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= max;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { club_id } = req.query || {};
      if (!club_id) return res.status(400).json({ error: 'Provide club_id.' });
      const { data: members, error } = await supabase
        .from('club_members')
        .select('*')
        .eq('club_id', club_id)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      const ids = [...new Set((members || []).map((m) => m.user_id))];
      let profilesById = {};
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
        profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      }
      const out = (members || []).map((m) => ({ ...m, profile: profilesById[m.user_id] || null }));
      return res.status(200).json(out);
    }

    if (req.method === 'POST') {
      const { club_id, club_number, user_id, passkey } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'Missing user.' });
      const ip = (req.headers['x-forwarded-for'] || 'anon').toString().split(',')[0].trim();

      let club = null;
      if (club_id) {
        const { data } = await supabase.from('clubs').select('*').eq('id', club_id).maybeSingle();
        club = data;
      } else if (club_number) {
        const code = String(club_number).toUpperCase().trim();
        const { data } = await supabase.from('clubs').select('*').eq('club_number', code).maybeSingle();
        club = data;
      }
      if (!club) return res.status(404).json({ error: 'Club not found. Check the number and try again.' });

      if (!rateLimit(`join:${ip}:${club.id}`, 8, 10 * 60_000)) {
        return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes before trying again.' });
      }

      const { data: existing } = await supabase
        .from('club_members')
        .select('*')
        .eq('club_id', club.id)
        .eq('user_id', user_id)
        .maybeSingle();
      if (existing) return res.status(200).json({ already_member: true, membership: existing });

      if (club.require_passkey) {
        if (!passkey || sha256(passkey) !== club.passkey_hash) {
          return res.status(403).json({ error: 'Incorrect passkey. Ask the Club owner for the right one.' });
        }
      }

      const now = new Date().toISOString();
      const { data: membership, error } = await supabase
        .from('club_members')
        .insert({ id: crypto.randomUUID(), club_id: club.id, user_id, role: 'member', joined_at: now, last_read_at: now })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('clubs').update({ member_count: (club.member_count || 0) + 1 }).eq('id', club.id);
      const { passkey_hash, ...safe } = club;
      return res.status(201).json({ membership, club: safe });
    }

    if (req.method === 'PUT') {
      const { club_id, requester_id, user_id, role, last_read } = req.body || {};
      if (!club_id || !user_id) return res.status(400).json({ error: 'Missing fields.' });

      if (last_read) {
        if (requester_id && requester_id !== user_id)
          return res.status(403).json({ error: 'Not allowed.' });
        const { error } = await supabase
          .from('club_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('club_id', club_id)
          .eq('user_id', user_id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (!requester_id || !role) return res.status(400).json({ error: 'Missing fields.' });
      if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
      const { data: club } = await supabase.from('clubs').select('*').eq('id', club_id).maybeSingle();
      if (!club) return res.status(404).json({ error: 'Club not found.' });
      const requesterIsCeo = await isCeoUser(requester_id);
      if (club.owner_id !== requester_id && !requesterIsCeo)
        return res.status(403).json({ error: 'Only the owner can change roles.' });
      if (user_id === club.owner_id) return res.status(400).json({ error: 'The owner role cannot be changed.' });
      const { data, error } = await supabase
        .from('club_members')
        .update({ role })
        .eq('club_id', club_id)
        .eq('user_id', user_id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const payload = { ...(req.body || {}), ...(req.query || {}) };
      const { club_id, requester_id, user_id } = payload;
      if (!club_id || !user_id) return res.status(400).json({ error: 'Missing fields.' });
      const { data: club } = await supabase.from('clubs').select('*').eq('id', club_id).maybeSingle();
      if (!club) return res.status(404).json({ error: 'Club not found.' });
      const actor = requester_id || user_id;
      const { data: actorMem } = await supabase
        .from('club_members')
        .select('*')
        .eq('club_id', club_id)
        .eq('user_id', actor)
        .maybeSingle();
      if (!actorMem) return res.status(403).json({ error: 'You are not a member of this Club.' });
      const leavingSelf = actor === user_id;
      const { data: targetMem } = await supabase
        .from('club_members')
        .select('*')
        .eq('club_id', club_id)
        .eq('user_id', user_id)
        .maybeSingle();
      if (!targetMem) return res.status(404).json({ error: 'Member not found.' });

      if (!leavingSelf) {
        const actorIsCeo = await isCeoUser(actor);
        if (actorMem.role === 'member' && !actorIsCeo) return res.status(403).json({ error: 'Not allowed.' });
        if (targetMem.role === 'owner') return res.status(403).json({ error: 'The owner cannot be removed.' });
        if (actorMem.role === 'admin' && targetMem.role === 'admin' && !actorIsCeo)
          return res.status(403).json({ error: 'Admins cannot remove other admins.' });
      }

      if (targetMem.role === 'owner') {
        const { data: others } = await supabase
          .from('club_members')
          .select('*')
          .eq('club_id', club_id)
          .neq('user_id', user_id)
          .order('joined_at', { ascending: true });
        if (!others || others.length === 0) {
          await supabase.from('messages').delete().eq('club_id', club_id);
          await supabase.from('club_members').delete().eq('club_id', club_id);
          await supabase.from('clubs').delete().eq('id', club_id);
          return res.status(200).json({ ok: true, deleted: true });
        }
        const heir = others.find((m) => m.role === 'admin') || others[0];
        await supabase.from('club_members').update({ role: 'owner' }).eq('id', heir.id);
        await supabase.from('clubs').update({ owner_id: heir.user_id }).eq('id', club_id);
      }

      await supabase.from('club_members').delete().eq('id', targetMem.id);
      const { count } = await supabase
        .from('club_members')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club_id);
      await supabase.from('clubs').update({ member_count: count || 0 }).eq('id', club_id);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('members API error:', err);
    res.status(500).json({ error: err.message });
  }
}
