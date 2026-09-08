import supabase from './db-client.js';

const CEO_EMAIL = 'kurianvarghese26@gmail.com';
const CEO_USERNAME = 'ceo';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Public: who the CEO is (user id + profile), so clients can render the blue tick.
    // Primary key is the profile username 'ceo'; falls back to the CEO email account.
    if (req.method === 'GET') {
      const { data: ceoProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', CEO_USERNAME)
        .maybeSingle();
      if (ceoProfile) {
        let email = CEO_EMAIL;
        try {
          const { data: u } = await supabase.auth.admin.getUserById(ceoProfile.id);
          if (u?.user?.email) email = u.user.email;
        } catch {
          /* best effort */
        }
        return res.status(200).json({
          ceo: { user_id: ceoProfile.id, username: CEO_USERNAME, email, profile: ceoProfile },
        });
      }
      const { data: usersPage, error: usersErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (usersErr) throw usersErr;
      const match = (usersPage?.users || []).find(
        (u) => (u.email || '').toLowerCase() === CEO_EMAIL
      );
      if (!match) return res.status(200).json({ ceo: null });
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', match.id).maybeSingle();
      return res.status(200).json({
        ceo: { user_id: match.id, username: profile?.username || null, email: CEO_EMAIL, profile: profile || null },
      });
    }

    // Bootstrap: verify the CEO account — ensures username 'ceo' + grants admin
    // membership in every club he belongs to. Only works for the CEO email.
    if (req.method === 'POST') {
      const { email } = req.body || {};
      if ((email || '').toLowerCase() !== CEO_EMAIL) {
        return res.status(403).json({ error: 'Only the CEO account can be bootstrapped here.' });
      }
      const { data: usersPage, error: usersErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (usersErr) throw usersErr;
      const match = (usersPage?.users || []).find((u) => (u.email || '').toLowerCase() === CEO_EMAIL);
      if (!match) {
        return res.status(404).json({ error: 'CEO account has not signed up yet. Ask him to create an account first, then retry.' });
      }
      // Reserve the username: if someone else holds 'ceo', refuse rather than steal it.
      const { data: holder } = await supabase.from('profiles').select('id').eq('username', CEO_USERNAME).maybeSingle();
      if (holder && holder.id !== match.id) {
        return res.status(409).json({ error: "The username 'ceo' is held by another account. Free it up and retry." });
      }
      const now = new Date().toISOString();
      const { data: existing } = await supabase.from('profiles').select('*').eq('id', match.id).maybeSingle();
      let profile = existing;
      if (!existing) {
        const { data, error } = await supabase
          .from('profiles')
          .insert({
            id: match.id,
            username: CEO_USERNAME,
            display_name: 'Kurian Varghese',
            bio: 'CEO of Clubs',
            avatar_url: null,
            avatar_color: '#3366aa',
            discoverable: true,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();
        if (error) throw error;
        profile = data;
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            username: CEO_USERNAME,
            display_name: existing.display_name || 'Kurian Varghese',
            bio: existing.bio || 'CEO of Clubs',
            discoverable: true,
            updated_at: now,
          })
          .eq('id', match.id)
          .select()
          .single();
        if (error) throw error;
        profile = data;
      }

      // App-admin rights: admin role in every club he belongs to (except where owner).
      const { data: memberships } = await supabase.from('club_members').select('*').eq('user_id', match.id);
      let upgraded = 0;
      for (const m of memberships || []) {
        if (m.role === 'member') {
          const { error } = await supabase.from('club_members').update({ role: 'admin' }).eq('id', m.id);
          if (!error) upgraded += 1;
        }
      }

      return res.status(200).json({
        ok: true,
        ceo: { user_id: match.id, username: CEO_USERNAME, email: CEO_EMAIL, profile },
        upgraded,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin API error:', err);
    res.status(500).json({ error: err.message });
  }
}
