import supabase from './db-client.js';
import crypto from 'crypto';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function genClubNumber() {
  const bytes = crypto.randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `CLB-${s.slice(0, 4)}-${s.slice(4)}`;
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

function publicClub(row) {
  if (!row) return row;
  const { passkey_hash, ...rest } = row;
  return rest;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { number, user_id, id } = req.query || {};

      if (number) {
        const ip = (req.headers['x-forwarded-for'] || 'anon').toString().split(',')[0].trim();
        if (!rateLimit('lookup:' + ip, 30, 60_000)) {
          return res.status(429).json({ error: 'Too many lookups. Please wait a minute and try again.' });
        }
        const code = String(number).toUpperCase().trim();
        const { data, error } = await supabase.from('clubs').select('*').eq('club_number', code).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Club not found. Check the number and try again.' });
        return res.status(200).json(publicClub(data));
      }

      if (id) {
        const { data, error } = await supabase.from('clubs').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Club not found.' });
        return res.status(200).json(publicClub(data));
      }

      if (user_id) {
        const { data: memberships, error: mErr } = await supabase
          .from('club_members')
          .select('*')
          .eq('user_id', user_id)
          .order('joined_at', { ascending: false });
        if (mErr) throw mErr;
        if (!memberships || memberships.length === 0) return res.status(200).json([]);
        const clubIds = memberships.map((m) => m.club_id);
        const { data: clubs, error: cErr } = await supabase.from('clubs').select('*').in('id', clubIds);
        if (cErr) throw cErr;
        const byId = Object.fromEntries((clubs || []).map((c) => [c.id, publicClub(c)]));
        const results = [];
        for (const m of memberships) {
          const club = byId[m.club_id];
          if (!club) continue;
          const { data: lastMsgs } = await supabase
            .from('messages')
            .select('id,body,kind,sender_name,created_at')
            .eq('club_id', m.club_id)
            .order('created_at', { ascending: false })
            .limit(1);
          const last = lastMsgs && lastMsgs[0] ? lastMsgs[0] : null;
          let unread = 0;
          if (m.last_read_at) {
            const { count } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('club_id', m.club_id)
              .gt('created_at', m.last_read_at);
            unread = count || 0;
          } else {
            const { count } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('club_id', m.club_id);
            unread = Math.min(count || 0, 99);
          }
          results.push({ ...club, membership_role: m.role, last_message: last, unread_count: unread });
        }
        results.sort(
          (a, b) =>
            new Date(b.last_message?.created_at || b.created_at).getTime() -
            new Date(a.last_message?.created_at || a.created_at).getTime()
        );
        return res.status(200).json(results);
      }

      return res.status(400).json({ error: 'Provide number, id, or user_id.' });
    }

    if (req.method === 'POST') {
      const { name, description, image_url, color, owner_id, require_passkey, passkey } = req.body || {};
      if (!name || String(name).trim().length < 3)
        return res.status(400).json({ error: 'Club name must be at least 3 characters.' });
      if (String(name).trim().length > 40) return res.status(400).json({ error: 'Club name is too long (max 40).' });
      if (!owner_id) return res.status(400).json({ error: 'Missing owner.' });
      if (require_passkey && (!passkey || String(passkey).length < 4))
        return res.status(400).json({ error: 'Passkey must be at least 4 characters.' });

      let club_number = null;
      for (let i = 0; i < 10; i++) {
        const cand = genClubNumber();
        const { data } = await supabase.from('clubs').select('id').eq('club_number', cand).maybeSingle();
        if (!data) {
          club_number = cand;
          break;
        }
      }
      if (!club_number) return res.status(500).json({ error: 'Could not generate a club number. Try again.' });

      const invite_token = crypto.randomBytes(16).toString('hex');
      const now = new Date().toISOString();
      const { data: club, error } = await supabase
        .from('clubs')
        .insert({
          id: crypto.randomUUID(),
          club_number,
          name: String(name).trim().slice(0, 40),
          description: String(description || '').trim().slice(0, 140),
          image_url: image_url || null,
          color: color || '#2e7d4f',
          owner_id,
          require_passkey: !!require_passkey,
          passkey_hash: require_passkey ? sha256(passkey) : null,
          invite_token,
          member_count: 1,
          message_count: 0,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (error) throw error;
      const { error: mErr } = await supabase.from('club_members').insert({
        id: crypto.randomUUID(),
        club_id: club.id,
        user_id: owner_id,
        role: 'owner',
        joined_at: now,
        last_read_at: now,
      });
      if (mErr) throw mErr;
      return res.status(201).json(publicClub(club));
    }

    if (req.method === 'PUT') {
      const { id, requester_id, name, description, image_url, color, require_passkey, passkey } = req.body || {};
      if (!id || !requester_id) return res.status(400).json({ error: 'Missing fields.' });
      const { data: club } = await supabase.from('clubs').select('*').eq('id', id).maybeSingle();
      if (!club) return res.status(404).json({ error: 'Club not found.' });
      const { data: mem } = await supabase
        .from('club_members')
        .select('*')
        .eq('club_id', id)
        .eq('user_id', requester_id)
        .maybeSingle();
      if (!mem || (mem.role !== 'owner' && mem.role !== 'admin'))
        return res.status(403).json({ error: 'Only owners and admins can edit this Club.' });

      const patch = {};
      if (name !== undefined) {
        if (String(name).trim().length < 3)
          return res.status(400).json({ error: 'Club name must be at least 3 characters.' });
        patch.name = String(name).trim().slice(0, 40);
      }
      if (description !== undefined) patch.description = String(description || '').trim().slice(0, 140);
      if (image_url !== undefined) patch.image_url = image_url || null;
      if (color !== undefined) patch.color = color;
      if (require_passkey !== undefined) {
        if (mem.role !== 'owner')
          return res.status(403).json({ error: 'Only the owner can change passkey protection.' });
        patch.require_passkey = !!require_passkey;
        if (require_passkey) {
          if (!passkey || String(passkey).length < 4)
            return res.status(400).json({ error: 'Passkey must be at least 4 characters.' });
          patch.passkey_hash = sha256(passkey);
        } else {
          patch.passkey_hash = null;
        }
      } else if (passkey && club.require_passkey) {
        if (mem.role !== 'owner')
          return res.status(403).json({ error: 'Only the owner can change the passkey.' });
        if (String(passkey).length < 4)
          return res.status(400).json({ error: 'Passkey must be at least 4 characters.' });
        patch.passkey_hash = sha256(passkey);
      }
      patch.updated_at = new Date().toISOString();
      const { data: updated, error } = await supabase.from('clubs').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(publicClub(updated));
    }

    if (req.method === 'DELETE') {
      const payload = { ...(req.body || {}), ...(req.query || {}) };
      const { id, requester_id } = payload;
      if (!id || !requester_id) return res.status(400).json({ error: 'Missing fields.' });
      const { data: club } = await supabase.from('clubs').select('*').eq('id', id).maybeSingle();
      if (!club) return res.status(404).json({ error: 'Club not found.' });
      if (club.owner_id !== requester_id)
        return res.status(403).json({ error: 'Only the owner can delete this Club.' });
      await supabase.from('messages').delete().eq('club_id', id);
      await supabase.from('club_members').delete().eq('club_id', id);
      const { error } = await supabase.from('clubs').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('clubs API error:', err);
    res.status(500).json({ error: err.message });
  }
}
