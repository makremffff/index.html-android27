// /api/index.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;
  const body = req.body;

  try {
    if (action === 'register') {
      const { userID, refID } = body;
      if (!userID) throw new Error('Missing userID');

      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', userID)
        .single();

      if (!existing) {
        await supabase.from('users').insert({
          id: userID,
          ref_by: refID || null,
          points: 0,
          usdt: 0
        });
      }

      return res.json({ ok: true });
    }

    if (action === 'getProfile') {
      const { userID } = body;
      if (!userID) throw new Error('Missing userID');

      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userID)
        .single();

      if (!user) throw new Error('User not found');

      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('ref_by', userID);

      return res.json({
        points: user.points || 0,
        usdt: user.usdt || 0,
        refCount: count || 0
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
