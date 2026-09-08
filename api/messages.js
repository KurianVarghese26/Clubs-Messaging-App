import supabase from './db-client.js';

async function senderInfo(sender_id, fallbackName) {
  const { data } = await supabase.from('profiles').select('*').eq('id', sender_id).maybeSingle();
  if (data) {
    return {
      sender_name: data.display_name || fallbackName || 'Someone',
      sender_avatar: data.avatar_url || null,
      sender_color: data.avatar_color || null,
      sender_username: data.username || null,
    };
  }
  return { sender_name: fallbackName || 'Someone', sender_avatar: null, sender_color: null, sender_username: null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { club_id, conversation_id, limit } = req.query || {};
      if (!club_id && !conversation_id) return res.status(400).json({ error: 'Provide club_id or conversation_id.' });
      let q = supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(Math.min(Number(limit) || 200, 500));
      if (club_id) q = q.eq('club_id', club_id);
      else q = q.eq('conversation_id', conversation_id);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json([...(data || [])].reverse());
    }

    if (req.method === 'POST') {
      const { club_id, conversation_id, sender_id, kind, body, file_url, file_name, file_size, duration_sec, reply_to_id } = req.body || {};
      if (!sender_id) return res.status(400).json({ error: 'Missing sender.' });
      if (!club_id && !conversation_id) return res.status(400).json({ error: 'Missing destination.' });
      const k = ['text', 'image', 'video', 'file', 'voice'].includes(kind) ? kind : 'text';
      if (k === 'text' && (!body || !String(body).trim()))
        return res.status(400).json({ error: 'Message is empty.' });
      if (k !== 'text' && !file_url) return res.status(400).json({ error: 'Missing attachment.' });
      if (body && String(body).length > 4000) return res.status(400).json({ error: 'Message is too long.' });

      if (club_id) {
        const { data: mem } = await supabase
          .from('club_members')
          .select('id')
          .eq('club_id', club_id)
          .eq('user_id', sender_id)
          .maybeSingle();
        if (!mem) return res.status(403).json({ error: 'You are not a member of this Club.' });
      } else {
        const { data: convo } = await supabase.from('conversations').select('*').eq('id', conversation_id).maybeSingle();
        if (!convo) return res.status(404).json({ error: 'Conversation not found.' });
        if (convo.participant_a !== sender_id && convo.participant_b !== sender_id)
          return res.status(403).json({ error: 'Not allowed.' });
      }

      const info = await senderInfo(sender_id);
      let reply_preview = null;
      if (reply_to_id) {
        const { data: orig } = await supabase.from('messages').select('id,sender_name,body,kind').eq('id', reply_to_id).maybeSingle();
        if (orig) reply_preview = { id: orig.id, sender_name: orig.sender_name, body: (orig.body || '').slice(0, 140), kind: orig.kind };
      }

      // Build the row defensively: if this DB predates the sender_username /
      // reactions columns (PostgREST "Could not find column" / schema-cache
      // errors), retry without them so sending never hard-fails.
      const fullRow = {
        id: crypto.randomUUID(),
        club_id: club_id || null,
        conversation_id: conversation_id || null,
        sender_id,
        sender_name: info.sender_name,
        sender_avatar: info.sender_avatar,
        sender_color: info.sender_color,
        sender_username: info.sender_username,
        kind: k,
        body: body ? String(body).slice(0, 4000) : '',
        file_url: file_url || null,
        file_name: file_name || null,
        file_size: file_size || null,
        duration_sec: duration_sec || null,
        reply_to_id: reply_to_id || null,
        reply_preview,
        reactions: [],
        created_at: new Date().toISOString(),
      };
      let msg = null;
      {
        const ins = await supabase.from('messages').insert(fullRow).select().single();
        if (!ins.error) {
          msg = ins.data;
        } else {
          const m = String(ins.error.message || ins.error);
          const missingUser = /sender_username/i.test(m);
          const missingReactions = /reactions/i.test(m);
          if (missingUser || missingReactions) {
            const slim = { ...fullRow };
            if (missingUser) delete slim.sender_username;
            if (missingReactions) delete slim.reactions;
            const retry = await supabase.from('messages').insert(slim).select().single();
            if (retry.error) throw retry.error;
            msg = { reactions: [], sender_username: info.sender_username, ...retry.data };
          } else {
            throw ins.error;
          }
        }
      }

      if (club_id) {
        try {
          const { data: club } = await supabase.from('clubs').select('message_count').eq('id', club_id).maybeSingle();
          await supabase.from('clubs').update({ message_count: (club?.message_count || 0) + 1 }).eq('id', club_id);
        } catch {
          /* counter is best-effort */
        }
      } else {
        const preview =
          k === 'text'
            ? String(body).slice(0, 120)
            : k === 'image'
              ? 'Photo'
              : k === 'video'
                ? 'Video'
                : k === 'voice'
                  ? 'Voice message'
                  : 'File';
        try {
          await supabase
            .from('conversations')
            .update({ last_message_text: preview, last_message_at: new Date().toISOString() })
            .eq('id', conversation_id);
        } catch {
          /* preview is best-effort */
        }
      }
      return res.status(201).json(msg);
    }

    if (req.method === 'PUT') {
      const { id, emoji, user_id, body, requester_id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'Missing message id.' });
      const { data: msg } = await supabase.from('messages').select('*').eq('id', id).maybeSingle();
      if (!msg) return res.status(404).json({ error: 'Message not found.' });

      if (emoji && user_id) {
        // Reactions now live in the dedicated message_reactions table
        // (message_id, user_id, emoji, created_at with uniqueness enforced).
        // Proxy here so old clients keep working; new UI calls /api/reactions.
        const clean = String(emoji).trim();
        if (Array.from(clean).length !== 1 || /\s/.test(clean) || clean.length > 16) {
          return res.status(400).json({ error: 'Invalid reaction.' });
        }
        try {
          const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host || ''}`;
          const r = await fetch(`${base}/api/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id: id, user_id, emoji: clean }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) return res.status(r.status).json(data);
          const { data: fresh } = await supabase.from('messages').select('*').eq('id', id).maybeSingle();
          return res.status(200).json(fresh || { ...msg, reactions: data.reactions || [] });
        } catch (e) {
          // Fallback: legacy inline toggle if the proxy hop fails.
          const reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
          const idx = reactions.findIndex((x) => x.emoji === clean);
          if (idx >= 0) {
            const users = (reactions[idx].user_ids || []).filter((u) => u !== user_id);
            if (users.length === 0) reactions.splice(idx, 1);
            else reactions[idx] = { emoji: clean, user_ids: users };
          } else {
            if (reactions.length >= 12) {
              return res.status(400).json({ error: 'Too many different reactions on this message.' });
            }
            reactions.push({ emoji: clean, user_ids: [user_id] });
          }
          try {
            const upd = await supabase.from('messages').update({ reactions }).eq('id', id).select().single();
            if (upd.error) throw upd.error;
            return res.status(200).json(upd.data);
          } catch (e2) {
            console.error('legacy reaction fallback failed:', e2?.message || e2);
            return res.status(500).json({ error: 'Could not save reaction. Please try again.' });
          }
        }
      }

      if (body !== undefined && requester_id) {
        if (msg.sender_id !== requester_id) return res.status(403).json({ error: 'You can only edit your own messages.' });
        if (!String(body).trim()) return res.status(400).json({ error: 'Message is empty.' });
        const { data, error } = await supabase
          .from('messages')
          .update({ body: String(body).slice(0, 4000) })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json(data);
      }

      return res.status(400).json({ error: 'Nothing to update.' });
    }

    if (req.method === 'DELETE') {
      const payload = { ...(req.body || {}), ...(req.query || {}) };
      const { id, requester_id } = payload;
      if (!id || !requester_id) return res.status(400).json({ error: 'Missing fields.' });
      const { data: msg } = await supabase.from('messages').select('*').eq('id', id).maybeSingle();
      if (!msg) return res.status(404).json({ error: 'Message not found.' });
      let allowed = msg.sender_id === requester_id;
      if (!allowed && msg.club_id) {
        const { data: mem } = await supabase
          .from('club_members')
          .select('role')
          .eq('club_id', msg.club_id)
          .eq('user_id', requester_id)
          .maybeSingle();
        allowed = !!mem && (mem.role === 'owner' || mem.role === 'admin');
      }
      if (!allowed) return res.status(403).json({ error: 'You cannot delete this message.' });
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('messages API error:', err);
    res.status(500).json({ error: err.message });
  }
}
