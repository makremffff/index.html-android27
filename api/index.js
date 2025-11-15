// ====== Config ======
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};

async function supabase(table, method, query = "", body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function rpc(func, body) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${func}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json().catch(() => ({}));
}

// ====== helpers ======
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);

// ====== register ======
async function registerUser({ user_id, ref_by }) {
  if (ref_by === user_id) ref_by = null;

  const exist = await supabase("users_data", "GET", `?user_id=eq.${user_id}`);
  if (exist.length) return exist[0];

  const row = {
    user_id,
    points: 0,
    usdt: 0,
    refs: 0,
    ref_by: ref_by || null,
    ads_watched_today: 0,
    ads_last_watch: null,
    ads_date: today()
  };

  const inserted = await supabase("users_data", "POST", "", row);

  if (ref_by) {
    await rpc("add_referral", { new_user: user_id, ref_by });
  }

  return inserted[0];
}

// ====== profile ======
async function getProfile({ user_id }) {
  const rows = await supabase("users_data", "GET", `?user_id=eq.${user_id}`);
  return rows[0] || null;
}

// ====== swap ======
async function swap({ user_id, points }) {
  const user = await getProfile({ user_id });
  if (!user) throw new Error("User not found");
  if (user.points < points) throw new Error("Not enough points");

  const usdtGain = (points / 100000) * 0.01;

  await supabase(
    "users_data",
    "PATCH",
    `?user_id=eq.${user_id}`,
    {
      points: user.points - points,
      usdt: user.usdt + usdtGain
    }
  );

  return { success: true };
}

// ====== ads ======
async function adStatus({ user_id }) {
  const user = await getProfile({ user_id });
  if (!user) throw new Error("User not found");

  const isNewDay = user.ads_date !== today();
  const watched = isNewDay ? 0 : (user.ads_watched_today || 0);
  const remain = 100 - watched;

  const last = user.ads_last_watch
    ? new Date(user.ads_last_watch).getTime()
    : 0;

  const canWatch = remain > 0 && (Date.now() - last > 30000);

  return { canWatch, remain };
}

async function adWatch({ user_id }) {
  await rpc("ad_watch", { uid: user_id });
  return { success: true };
}

// ====== router ======
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { action, ...params } = req.body;

  try {
    let result;

    switch (action) {
      case "register":
        result = await registerUser(params);
        break;

      case "getProfile":
        result = await getProfile(params);
        break;

      case "swap":
        result = await swap(params);
        break;

      case "adStatus":
        result = await adStatus(params);
        break;

      case "adWatch":
        result = await adWatch(params);
        break;

      default:
        return res.status(400).json({ error: "Bad action" });
    }

    return res.json(result);

  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}