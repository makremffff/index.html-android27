// /api/index.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============= SUPABASE REQUEST =============
async function supabaseRequest(method, path, body = null) {
  const opts = {
    method,
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json"
    }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${SUPABASE_URL}${path}`, opts);
  return res.json();
}

// ============= REGISTER =============
async function registerUser(userID, refBy) {
  const exist = await supabaseRequest(
    "GET",
    `/rest/v1/players?user_id=eq.${userID}&select=*`
  );

  if (exist && exist.length > 0) return;

  await supabaseRequest("POST", "/rest/v1/players", {
    user_id: userID,
    points: 0,
    usdt: 0,
    ref_by: refBy || null,
    refs: 0,
    ads_watched_today: 0,
    ads_last_watch: 0,
    ads_date: new Date().toISOString().split("T")[0]
  });

  // Increase ref count
  if (refBy && refBy !== userID) {
    const inviter = await supabaseRequest(
      "GET",
      `/rest/v1/players?user_id=eq.${refBy}&select=refs`
    );

    if (inviter.length) {
      await supabaseRequest(
        "PATCH",
        `/rest/v1/players?user_id=eq.${refBy}`,
        { refs: inviter[0].refs + 1 }
      );
    }
  }
}

// ============= PROFILE =============
async function getProfile(userID) {
  const rows = await supabaseRequest(
    "GET",
    `/rest/v1/players?user_id=eq.${userID}&select=*`
  );

  if (rows && rows.length) return rows[0];

  return { points: 0, usdt: 0, refs: 0 };
}

// ============= SWAP =============
async function swap(userID, points) {
  const profile = await getProfile(userID);

  if (points > profile.points) return { error: "Not enough points" };

  const earnUSDT = points / 100000 * 0.01;

  await supabaseRequest(
    "PATCH",
    `/rest/v1/players?user_id=eq.${userID}`,
    {
      points: profile.points - points,
      usdt: profile.usdt + earnUSDT
    }
  );

  return await getProfile(userID);
}

// =========================================
//          ADS SYSTEM REST API
// =========================================

const DAILY_LIMIT = 100;
const COOLDOWN = 30; // seconds
const REWARD = 400;

// ============= GET AD STATUS =============
async function adStatus(userID) {
  const profile = await getProfile(userID);

  const today = new Date().toISOString().split("T")[0];

  // Reset daily if changed day
  if (profile.ads_date !== today) {
    await supabaseRequest(
      "PATCH",
      `/rest/v1/players?user_id=eq.${userID}`,
      {
        ads_date: today,
        ads_watched_today: 0
      }
    );

    profile.ads_watched_today = 0;
    profile.ads_date = today;
  }

  const now = Math.floor(Date.now() / 1000);
  const cooldown = Math.max(0, profile.ads_last_watch + COOLDOWN - now);
  const remain = Math.max(0, DAILY_LIMIT - profile.ads_watched_today);

  return { remain, cooldown };
}

// ============= WATCH AD =============
async function adWatch(userID) {
  const status = await adStatus(userID);

  if (status.remain <= 0) return { error: "No ads remaining today" };
  if (status.cooldown > 0) return { error: "Wait cooldown" };

  const profile = await getProfile(userID);

  await supabaseRequest(
    "PATCH",
    `/rest/v1/players?user_id=eq.${userID}`,
    {
      points: profile.points + REWARD,
      ads_watched_today: profile.ads_watched_today + 1,
      ads_last_watch: Math.floor(Date.now() / 1000)
    }
  );

  return await getProfile(userID);
}

// =========================================
//             MAIN HANDLER
// =========================================

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { action, userID, refBy, points } = req.body;

  try {
    if (action === "registerUser") {
      await registerUser(userID, refBy);
      return res.json({ ok: true });
    }

    if (action === "getProfile") {
      return res.json(await getProfile(userID));
    }

    if (action === "swap") {
      return res.json(await swap(userID, points));
    }

    if (action === "adStatus") {
      return res.json(await adStatus(userID));
    }

    if (action === "adWatch") {
      return res.json(await adWatch(userID));
    }

    res.status(400).json({ error: "Invalid action" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}