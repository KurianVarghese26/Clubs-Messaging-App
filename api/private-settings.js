import supabase from './db-client.js';
import crypto from 'crypto';

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { user_id, peer_id } = req.query || {};
      // Public privacy posture of a peer (never leaks the hash): is private
      // mode on? Needed BEFORE starting a chat so the UI can ask for a key.
      if (peer_id) {
        const { data, error } = await supabase
          .from('private_settings')
          .select('private_mode')
          .eq('user_id', peer_id)
          .maybeSingle();
        if (error) throw error;
        return res.status(200).json({ user_id: peer_id, private_mode: !!data?.private_mode });
      }
      if (!user_id) return res.status(400).json({ error: 'Provide user_id.' });
      const { data, error } = await supabase
        .from('private_settings')
        .select('private_mode, updated_at')
        .eq('user_id', user_id)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({ user_id, private_mode: !!data?.private_mode });
    }

    if (req.method === 'PUT') {
      const { user_id, private_mode, chat_passkey } = req.body || {};
      if (!user_id) return res.status(400).json({ error: 'Missing user id.' });
      if (private_mode) {
        if (!chat_passkey || String(chat_passkey).length < 4)
          return res.status(400).json({ error: 'Chat passkey must be at least 4 characters.' });
        const now = new Date().toISOString();
        const row = {
          id: crypto.randomUUID(),
          user_id,
          private_mode: true,
          chat_passkey_hash: sha256(String(chat_passkey)),
          updated_at: now,
        };
        const { data: existing } = await supabase
          .from('private_settings')
          .select('id')
          .eq('user_id', user_id)
          .maybeSingle();
        if (existing) {
          const { data, error } = await supabase
            .from('private_settings')
            .update({ private_mode: true, chat_passkey_hash: row.chat_passkey_hash, updated_at: now })
            .eq('user_id', user_id)
            .select()
            .single();
          if (error) throw error;
          return res.status(200).json({ user_id, private_mode: true });
        }
        const { error } = await supabase.from('private_settings').insert(row);
        if (error) throw error;
        return res.status(200).json({ user_id, private_mode: true });
      }
      // Disable: clear the hash so nothing lingers.
      const { data: existing } = await supabase
        .from('private_settings')
        .select('id')
        .eq('user_id', user_id)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('private_settings')
          .update({ private_mode: false, chat_passkey_hash: null, updated_at: new Date().toISOString() })
          .eq('user_id', user_id);
        if (error) throw error;
      }
      return res.status(200).json({ user_id, private_mode: false });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('private-settings API error:', err);
    res.status(500).json({ error: err.message });
  }
}
