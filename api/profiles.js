import supabase from './db-client.js';
import crypto from 'crypto';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const CEO_EMAIL = 'kurianvarghese26@gmail.com';
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

// The username 'ceo' is reserved for the app CEO. Only the CEO's auth account may hold it.
async function canHoldCeoUsername(user_id) {
  try {
    const { data } = await supabase.auth.admin.getUserById(user_id);
    return ((data?.user?.email || '').toLowerCase() === CEO_EMAIL);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { id, q, exclude } = req.query || {};
      if (id) {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Profile not found.' });
        return res.status(200).json(data);
      }
      if (q !== undefined) {
        const term = String(q || '').trim();
        if (term.length < 2) return res.status(200).json([]);
        const like = `%${term}%`;
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.${like},display_name.ilike.${like}`)
          .limit(20);
        if (error) throw error;
        const lower = term.toLowerCase().replace(/^@/, '');
        const out = (data || []).filter((p) => {
          if (exclude && p.id === exclude) return false;
          if (p.discoverable !== false) return true;
          return (p.username || '').toLowerCase() === lower;
        });
        return res.status(200).json(out.slice(0, 12));
      }
      return res.status(400).json({ error: 'Provide id or q.' });
    }

    if (req.method === 'POST') {
      const { id, username, display_name, bio, avatar_url, avatar_color } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing user id.' });
      const uname = String(username || '').trim().toLowerCase().replace(/^@/, '');
      if (!USERNAME_RE.test(uname))
        return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscores.' });
      if (!display_name || !String(display_name).trim())
        return res.status(400).json({ error: 'Please add your name.' });
      const { data: taken } = await supabase.from('profiles').select('id').eq('username', uname).maybeSingle();
      if (taken && taken.id !== id) return res.status(409).json({ error: 'That username is taken.' });
      if (uname === 'ceo' && !(await canHoldCeoUsername(id)))
        return res.status(403).json({ error: "The username 'ceo' is reserved for the app CEO." });
      const { data: existing } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      let result;
      if (existing) {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            username: uname,
            display_name: String(display_name).trim().slice(0, 30),
            bio: String(bio || '').trim().slice(0, 160),
            avatar_url: avatar_url !== undefined ? avatar_url || null : existing.avatar_url,
            avatar_color: avatar_color || existing.avatar_color || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        result = data;
      } else {
        const palette = ['#2e7d4f', '#3366aa', '#7a4fa3', '#b3541e', '#a33a5b', '#0e7c86'];
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            id,
            username: uname,
            display_name: String(display_name).trim().slice(0, 30),
            bio: String(bio || '').trim().slice(0, 160),
            avatar_url: avatar_url || null,
            avatar_color: avatar_color || palette[Math.floor(Math.random() * palette.length)],
            discoverable: true,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
      return res.status(200).json(result);
    }

    if (req.method === 'PUT') {
      const { id, username, display_name, bio, avatar_url, avatar_color, discoverable, private_mode, chat_passkey } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing user id.' });
      const patch = { updated_at: new Date().toISOString() };
      if (username !== undefined) {
        const uname = String(username).trim().toLowerCase().replace(/^@/, '');
        if (!USERNAME_RE.test(uname))
          return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscores.' });
        const { data: taken } = await supabase.from('profiles').select('id').eq('username', uname).maybeSingle();
        if (taken && taken.id !== id) return res.status(409).json({ error: 'That username is taken.' });
        if (uname === 'ceo' && !(await canHoldCeoUsername(id)))
          return res.status(403).json({ error: "The username 'ceo' is reserved for the app CEO." });
        patch.username = uname;
      }
      if (display_name !== undefined) {
        if (!String(display_name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
        patch.display_name = String(display_name).trim().slice(0, 30);
      }
      if (bio !== undefined) patch.bio = String(bio || '').trim().slice(0, 160);
      if (avatar_url !== undefined) patch.avatar_url = avatar_url || null;
      if (avatar_color !== undefined) patch.avatar_color = avatar_color || null;
      if (discoverable !== undefined) patch.discoverable = !!discoverable;
      if (private_mode !== undefined) {
        patch.private_mode = !!private_mode;
        if (private_mode) {
          if (chat_passkey === undefined)
            return res.status(400).json({ error: 'Set a chat passkey to enable private mode.' });
          if (chat_passkey === null) {
            // explicit clear is only valid when disabling
            return res.status(400).json({ error: 'Provide a chat passkey to enable private mode.' });
          }
          if (String(chat_passkey).length < 4)
            return res.status(400).json({ error: 'Chat passkey must be at least 4 characters.' });
          patch.chat_passkey_hash = sha256(String(chat_passkey));
        } else {
          patch.chat_passkey_hash = null;
        }
      } else if (chat_passkey !== undefined) {
        // Rotating the passkey without toggling the mode
        if (chat_passkey === null) patch.chat_passkey_hash = null;
        else {
          if (String(chat_passkey).length < 4)
            return res.status(400).json({ error: 'Chat passkey must be at least 4 characters.' });
          patch.chat_passkey_hash = sha256(String(chat_passkey));
        }
      }
      let data;
      try {
        const upd = await supabase.from('profiles').update(patch).eq('id', id).select().single();
        if (upd.error) throw upd.error;
        data = upd.data;
      } catch (e) {
        // Older DBs predate private_mode / chat_passkey_hash — retry without them
        const m = String(e?.message || e || '');
        if (/private_mode|chat_passkey_hash/i.test(m)) {
          const { private_mode: _pm, chat_passkey_hash: _h, ...slim } = patch;
          void _pm;
          void _h;
          const retry = await supabase.from('profiles').update(slim).eq('id', id).select().single();
          if (retry.error) throw retry.error;
          data = retry.data;
        } else {
          throw e;
        }
      }
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const payload = { ...(req.body || {}), ...(req.query || {}) };
      const { id } = payload;
      if (!id) return res.status(400).json({ error: 'Missing user id.' });
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('profiles API error:', err);
    res.status(500).json({ error: err.message });
  }
}
