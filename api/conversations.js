import supabase from './db-client.js';
import crypto from 'crypto';

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

const convoHits = new Map();
function convoRateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (convoHits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  convoHits.set(key, arr);
  return arr.length <= max;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { user_id, id } = req.query || {};

      if (id) {
        const { data: convo, error } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
        const me = user_id || null;
        const peerId = me === convo.participant_a ? convo.participant_b : convo.participant_a;
        let peer = null;
        if (peerId) {
          const { data } = await supabase.from('profiles').select('*').eq('id', peerId).maybeSingle();
          peer = data || null;
        }
        let unread = 0;
        if (me) {
          const myRead = me === convo.participant_a ? convo.a_last_read_at : convo.b_last_read_at;
          let q = supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', convo.id);
          if (myRead) q = q.gt('created_at', myRead);
          const { count } = await q;
          unread = count || 0;
        }
        return res.status(200).json({ ...convo, peer, unread_count: unread });
      }

      if (user_id) {
        const { data: convos, error } = await supabase
          .from('conversations')
          .select('*')
          .or(`participant_a.eq.${user_id},participant_b.eq.${user_id}`)
          .order('last_message_at', { ascending: false });
        if (error) throw error;
        if (!convos || convos.length === 0) return res.status(200).json([]);
        const peerIds = [...new Set(convos.map((c) => (c.participant_a === user_id ? c.participant_b : c.participant_a)))];
        let byId = {};
        if (peerIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('*').in('id', peerIds);
          byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
        }
        const out = [];
        for (const c of convos) {
          const peerId = c.participant_a === user_id ? c.participant_b : c.participant_a;
          const myRead = c.participant_a === user_id ? c.a_last_read_at : c.b_last_read_at;
          let q = supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).neq('sender_id', user_id);
          if (myRead) q = q.gt('created_at', myRead);
          const { count } = await q;
          const { data: lastMsgs } = await supabase
            .from('messages')
            .select('id,body,kind,sender_id,sender_name,created_at')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1);
          out.push({
            ...c,
            peer: byId[peerId] || null,
            peer_id: peerId,
            last_message: lastMsgs && lastMsgs[0] ? lastMsgs[0] : null,
            unread_count: count || 0,
          });
        }
        return res.status(200).json(out);
      }
      return res.status(400).json({ error: 'Provide user_id or id.' });
    }

    if (req.method === 'POST') {
      const { participant_a, participant_b, chat_passkey } = req.body || {};
      if (!participant_a || !participant_b) return res.status(400).json({ error: 'Missing participants.' });
      if (participant_a === participant_b) return res.status(400).json({ error: 'You cannot message yourself.' });
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .or(
          `and(participant_a.eq.${participant_a},participant_b.eq.${participant_b}),and(participant_a.eq.${participant_b},participant_b.eq.${participant_a})`
        )
        .maybeSingle();
      if (existing) return res.status(200).json(existing);

      // Private mode gate: recipient only accepts chats from people who know
      // BOTH their username and their chat passkey. State lives in the
      // dedicated private_settings table (profiles columns may not exist on
      // older DBs), so this gate works regardless of schema drift.
      const peerId = participant_b;
      let gate = null;
      try {
        const { data } = await supabase
          .from('private_settings')
          .select('private_mode, chat_passkey_hash')
          .eq('user_id', peerId)
          .maybeSingle();
        gate = data || null;
      } catch {
        gate = null;
      }
      if (gate && gate.private_mode) {
        if (!convoRateLimit(`dmkey:${participant_a}:${peerId}`, 8, 10 * 60_000)) {
          return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
        }
        if (!chat_passkey || sha256(String(chat_passkey)) !== gate.chat_passkey_hash) {
          let uname = 'this user';
          try {
            const { data: prof } = await supabase.from('profiles').select('username').eq('id', peerId).maybeSingle();
            if (prof?.username) uname = prof.username;
          } catch {
            /* best effort */
          }
          return res.status(403).json({
            error: 'PRIVATE_MODE',
            message: `@${uname} is in private mode — enter their chat passkey to start chatting.`,
            username: uname,
          });
        }
      }
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          id: crypto.randomUUID(),
          participant_a,
          participant_b,
          last_message_text: '',
          last_message_at: now,
          created_at: now,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, user_id } = req.body || {};
      if (!id || !user_id) return res.status(400).json({ error: 'Missing fields.' });
      const { data: convo } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
      if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
      if (convo.participant_a !== user_id && convo.participant_b !== user_id)
        return res.status(403).json({ error: 'Not allowed.' });
      const patch =
        convo.participant_a === user_id
          ? { a_last_read_at: new Date().toISOString() }
          : { b_last_read_at: new Date().toISOString() };
      const { error } = await supabase.from('conversations').update(patch).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('conversations API error:', err);
    res.status(500).json({ error: err.message });
  }
}
