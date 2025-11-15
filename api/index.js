// /api/index.js
// خادم صغير يستخدم Supabase REST API فقط (لا يستخدم @supabase/supabase-js)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, user_id, ...params } = req.body;

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  const url = (table, query = '') =>
    `${SUPABASE_URL}/rest/v1/${table}${query}`;

  /* ---------- 1️⃣ registerUser ---------- */
  if (action === 'registerUser') {
    const { ref_by } = params;

    // منع التكرار
    let r = await fetch(url('users_data', `?user_id=eq.${user_id}`), { headers });
    let rows = await r.json();
    if (rows.length) return res.json({ ok: 1 });

    // إضافة المستخدم
    await fetch(url('users_data'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id,
        points: 0,
        usdt: 0,
        refs: 0,
        ref_by: ref_by || null,
        ads_watched_today: 0,
        ads_last_watch: 0,
        ads_date: new Date().toISOString().slice(0, 10)
      })
    });

    // زيادة refs للداعى
    if (ref_by && ref_by !== user_id) {
      await fetch(url('users_data', `?user_id=eq.${ref_by}`), { headers })
        .then(r => r.json())
        .then(async ([u]) => {
          if (!u) return;
          await fetch(url('users_data', `?user_id=eq.${ref_by}`), {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ refs: u.refs + 1 })
          });
        });
    }

    return res.json({ ok: 1 });
  }

  /* ---------- 2️⃣ getProfile ---------- */
  if (action === 'getProfile') {
    const r = await fetch(url('users_data', `?user_id=eq.${user_id}`), { headers });
    const [row] = await r.json();
    if (!row) return res.status(404).json({ error: 'User not found' });
    return res.json(row);
  }

  /* ---------- 3️⃣ swap ---------- */
  if (action === 'swap') {
    const { points } = params;
    const r = await fetch(url('users_data', `?user_id=eq.${user_id}`), { headers });
    const [u] = await r.json();
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.points < points) return res.json({ error: 'Not enough points' });

    const usdtEarn = (points / 100000 * 0.01).toFixed(4);

    await fetch(url('users_data', `?user_id=eq.${user_id}`), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        points: u.points - points,
        usdt: parseFloat((u.usdt + parseFloat(usdtEarn)).toFixed(4))
      })
    });

    const updated = await (await fetch(url('users_data', `?user_id=eq.${user_id}`), { headers })).json();
    return res.json(updated[0]);
  }

  /* ---------- 4️⃣ adStatus ---------- */
  if (action === 'adStatus') {
    const r = await fetch(url('users_data', `?user_id=eq.${user_id}`), { headers });
    const [u] = await r.json();
    if (!u) return res.status(404).json({ error: 'User not found' });

    const today = new Date().toISOString().slice(0, 10);
    if (u.ads_date !== today) {
      // صفر العداد لو اليوم غير محفوظ
      await fetch(url('users_data', `?user_id=eq.${user_id}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          ads_watched_today: 0,
          ads_date: today
        })
      });
      u.ads_watched_today = 0;
    }

    const DAILY_MAX = 100;
    const COOLDOWN_SEC = 30;
    const remaining = DAILY_MAX - u.ads_watched_today;
    const cooldown  = (Date.now() - new Date(u.ads_last_watch).getTime()) < COOLDOWN_SEC * 1000;

    return res.json({ remaining, cooldown });
  }

  /* ---------- 5️⃣ adWatch ---------- */
  if (action === 'adWatch') {
    const AD_REWARD = 400;
    const r = await fetch(url('users_data', `?user_id=eq.${user_id}`), { headers });
    const [u] = await r.json();
    if (!u) return res.status(404).json({ error: 'User not found' });

    await fetch(url('users_data', `?user_id=eq.${user_id}`), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        points: u.points + AD_REWARD,
        ads_watched_today: u.ads_watched_today + 1,
        ads_last_watch: new Date().toISOString()
      })
    });

    const updated = await (await fetch(url('users_data', `?user_id=eq.${user_id}`), { headers })).json();
    return res.json(updated[0]);
  }

  return res.status(400).json({ error: 'Unknown action' });
}
