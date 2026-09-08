import supabase from './db-client.js';
import crypto from 'crypto';

// Dedicated reactions table: one row per (message, user, emoji).
// Uniqueness is enforced in code (lookup-before-insert) so no user can ever
// hold duplicate identical reactions on the same message.

function toChips(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (!map.has(r.emoji)) map.set(r.emoji, []);
    map.get(r.emoji).push(r.user_id);
  }
  return [...map.entries()].map(([emoji, user_ids]) => ({ emoji, user_ids }));
}

async function syncChipsToMessage(message_id) {
  try {
    const { data: rows } = await supabase.from('message_reactions').select('*').eq('message_id', message_id);
    const chips = toChips(rows);
    // Best-effort mirror onto messages.reactions (older DBs may lack it).
    await supabase.from('messages').update({ reactions: chips }).eq('id', message_id);
    return chips;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // List reactions for a message → chips [{ emoji, user_ids }]
    if (req.method === 'GET') {
      const { message_id } = req.query || {};
      if (!message_id) return res.status(400).json({ error: 'Provide message_id.' });
      const { data: rows, error } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', message_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json(toChips(rows));
    }

    // Toggle: add if absent, remove if present. Body: { message_id, user_id, emoji }
    if (req.method === 'POST') {
      const { message_id, user_id, emoji } = req.body || {};
      if (!message_id || !user_id) return res.status(400).json({ error: 'Missing fields.' });
      const clean = String(emoji || '').trim();
      if (Array.from(clean).length !== 1 || /\s/.test(clean) || clean.length > 16) {
        return res.status(400).json({ error: 'Invalid reaction.' });
      }
      const { data: msg } = await supabase.from('messages').select('id').eq('id', message_id).maybeSingle();
      if (!msg) return res.status(404).json({ error: 'Message not found.' });

      const { data: existing } = await supabase
        .from('message_reactions')
        .select('*')
        .eq('message_id', message_id)
        .eq('user_id', user_id)
        .eq('emoji', clean)
        .maybeSingle();

      let added;
      if (existing) {
        const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
        if (error) throw error;
        added = false;
      } else {
        const { error } = await supabase.from('message_reactions').insert({
          id: crypto.randomUUID(),
          message_id,
          user_id,
          emoji: clean,
          created_at: new Date().toISOString(),
        });
        if (error) {
          // Unique-violation race (two taps at once) → treat as already added.
          if (/duplicate|unique/i.test(String(error.message || ''))) {
            added = true;
          } else throw error;
        } else {
          added = true;
        }
      }
      const chips = (await syncChipsToMessage(message_id)) || [];
      return res.status(200).json({ added, reactions: chips });
    }

    // Explicit remove (idempotent). Body: { message_id, user_id, emoji }
    if (req.method === 'DELETE') {
      const payload = { ...(req.body || {}), ...(req.query || {}) };
      const { message_id, user_id, emoji } = payload;
      if (!message_id || !user_id) return res.status(400).json({ error: 'Missing fields.' });
      let q = supabase.from('message_reactions').delete().eq('message_id', message_id).eq('user_id', user_id);
      if (emoji) q = q.eq('emoji', String(emoji).trim());
      const { error } = await q;
      if (error) throw error;
      const chips = (await syncChipsToMessage(message_id)) || [];
      return res.status(200).json({ ok: true, reactions: chips });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('reactions API error:', err);
    res.status(500).json({ error: err.message });
  }
}
