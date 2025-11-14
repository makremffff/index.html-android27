// /api/index.js – REST API فقط بدون supabase-js
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function supabaseRest(method, path, body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query;
  const body = req.body;

  try {
    if (action === 'register') {
      const { userID, refID } = body;
      if (!userID) throw new Error('Missing userID');

      // التحقق من وجود اللاعب
      const existing = await supabaseRest(
        'GET',
        `/players?user_id=eq.${userID}&select=user_id`
      );

      if (!existing.length) {
        await supabaseRest('POST', '/players', {
          user_id: userID,
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

      const [player] = await supabaseRest(
        'GET',
        `/players?user_id=eq.${userID}&select=points,usdt`
      );
      if (!player) throw new Error('Player not found');

      const refList = await supabaseRest(
        'GET',
        `/players?ref_by=eq.${userID}&select=user_id`
      );

      return res.json({
        points: player.points || 0,
        usdt: player.usdt || 0,
        refCount: refList.length
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
