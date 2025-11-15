const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* ================= SUPABASE REQUEST ================= */
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
  const data = await res.json().catch(() => null);

  if (!res.ok) return { error: data?.message || "Supabase Error" };
  return data;
}

/* ================= REGISTER ================= */
async function registerUser(userID, refBy) {
  const exist = await supabaseRequest(
    "GET",
    `/rest/v1/users_data?user_id=eq.${userID}&select=*`
  );
  if (exist?.length > 0) return;

  const today = new Date().toISOString().split("T")[0];
  const now = Math.floor(Date.now() / 1000);

  await supabaseRequest("POST", "/rest/v1/users_data", {
    user_id: userID,
    points: 0,
    usdt: 0,
    ref_by: refBy || null,
    refs: 0,
    ads_watched_today: 0,
    ads_last_watch: now,
    ads_date: today
  });

  if (refBy && refBy !== userID) {
    const inviter = await supabaseRequest(
      "GET",
      `/rest/v1/users_data?user_id=eq.${refBy}&select=refs`
    );

    if (inviter?.length) {
      const updated = (inviter[0].refs || 0) + 1;

      await supabaseRequest(
        "PATCH",
        `/rest/v1/users_data?user_id=eq.${refBy}`,
        { refs: updated }
      );
    }
  }
}

/* ================= PROFILE ================= */
async function getProfile(userID) {
  const data = await supabaseRequest(
    "GET",
    `/rest/v1/users_data?user_id=eq.${userID}&select=*`
  );

  if (!data || data.error) return { points: 0, usdt: 0, refs: 0 };
  if (data.length) return data[0];

  return { points: 0, usdt: 0, refs: 0 };
}

/* ================= SWAP ================= */
async function swap(userID, points) {
  const profile = await getProfile(userID);
  if (profile.error) return { error: "Profile not found" };
  if (points > profile.points) return { error: "Not enough points" };

  const earnUSDT = points / 100000 * 0.01;

  await supabaseRequest(
    "PATCH",
    `/rest/v1/users_data?user_id=eq.${userID}`,
    {
      points: profile.points - points,
      usdt: profile.usdt + earnUSDT
    }
  );

  return await getProfile(userID);
}

/* ================= ADS ================= */
const DAILY_LIMIT = 100;
const COOLDOWN = 30;
const REWARD = 400;

async function adStatus(userID) {
  const profile = await getProfile(userID);
  const today = new Date().toISOString().split("T")[0];

  if (profile.ads_date !== today) {
    await supabaseRequest(
      "PATCH",
      `/rest/v1/users_data?user_id=eq.${userID}`,
      { ads_date: today, ads_watched_today: 0 }
    );

    profile.ads_watched_today = 0;
  }

  const now = Math.floor(Date.now() / 1000);

  return {
    remain: Math.max(0, DAILY_LIMIT - profile.ads_watched_today),
    cooldown: Math.max(0, (profile.ads_last_watch || 0) + COOLDOWN - now)
  };
}

async function adWatch(userID) {
  const status = await adStatus(userID);
  if (status.remain <= 0) return { error: "No ads remaining today" };
  if (status.cooldown > 0) return { error: "Wait cooldown" };

  const profile = await getProfile(userID);
  const now = Math.floor(Date.now() / 1000);

  await supabaseRequest(
    "PATCH",
    `/rest/v1/users_data?user_id=eq.${userID}`,
    {
      points: profile.points + REWARD,
      ads_watched_today: profile.ads_watched_today + 1,
      ads_last_watch: now
    }
  );

  return await getProfile(userID);
}

/* ================= MAIN ================= */
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { action, userID, refBy, points } = req.body;

  try {
    if (action === "registerUser") return res.json(await registerUser(userID, refBy));
    if (action === "getProfile") return res.json(await getProfile(userID));
    if (action === "swap") return res.json(await swap(userID, points));
    if (action === "adStatus") return res.json(await adStatus(userID));
    if (action === "adWatch") return res.json(await adWatch(userID));

    res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}