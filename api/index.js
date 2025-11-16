// /api/index.js
import fetch from 'node-fetch'; // لضمان عمل fetch في بيئة Node.js (Vercel)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TABLE = 'users_data';
const POINTS_TO_USDT_RATE = 100000;
const AD_REWARD_POINTS = 400;
const DAILY_MAX_ADS = 100;
const COOLDOWN_SEC = 3;
const RESET_HOURS = 15; // 15:00 UTC وقت إعادة التعيين

/**
 * Handles incoming Vercel Serverless Function requests.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { action, ...params } = req.body;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({ success: false, error: 'Supabase credentials not set.' });
    }
    
    let result;
    try {
        switch (action) {
            case 'register':
                result = await registerUser(params);
                break;
            case 'profile':
                result = await getProfile(params);
                break;
            case 'swap':
                result = await swapPoints(params);
                break;
            case 'adStatus':
                result = await adStatus(params);
                break;
            case 'adWatch':
                result = await adWatch(params);
                break;
            case 'leaderboard': // الإصلاح 5
                result = await leaderboard();
                break;
            case 'withdraw': // الإصلاح 9
                result = await withdraw(params);
                break;
            default:
                return res.status(400).json({ success: false, error: `Invalid action: ${action}` });
        }
    } catch (e) {
        console.error(`API Handler Error for action ${action}:`, e);
        return res.status(500).json({ success: false, error: `Server Error: ${e.message}` });
    }

    res.status(200).json(result);
}

// --- Supabase REST Utility ---

async function supabaseFetch(endpoint, method, headers = {}, body = null) {
    const url = `${SUPABASE_URL}${endpoint}`;
    const defaultHeaders = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...headers
    };

    const config = {
        method: method,
        headers: defaultHeaders,
        body: body ? JSON.stringify(body) : null
    };

    // استخدام fetch المضمون من node-fetch
    const response = await fetch(url, config); 

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase Error ${response.status}: ${errorText}`);
    }

    if (response.status === 204) return []; 
    return response.json();
}

// --- Core API Functions ---

/**
 * Register a new user, prevent duplication, and award referral bonus to the referrer.
 */
async function registerUser({ user_id, ref_by, ...telegram_data }) {
    if (!user_id) throw new Error('user_id is required.');

    const existingUser = await supabaseFetch(
        `/rest/v1/${TABLE}?user_id=eq.${user_id}&select=user_id`,
        'GET'
    );
    
    if (existingUser.length > 0) {
        return { success: true, message: 'User already registered.' };
    }

    const now = new Date();
    const newUser = {
        user_id: user_id,
        points: 50,
        usdt: 0.00,
        ref_by: ref_by || null,
        refs: 0,
        ads_watched_today: 0,
        ads_last_watch: 0,
        // الإصلاح 7: تسجيل التاريخ بصيغة ISO كاملة
        ads_date: now.toISOString(),
        // يمكن حفظ بعض بيانات التلغرام للمستقبل
        username: telegram_data.username || null,
    };

    await supabaseFetch(
        `/rest/v1/${TABLE}`,
        'POST',
        { 'Prefer': 'return=minimal' },
        newUser
    );
    
    // Increment ref count for the referrer
    if (ref_by && ref_by !== user_id) {
        const referrer = await supabaseFetch(
            `/rest/v1/${TABLE}?user_id=eq.${ref_by}&select=user_id,refs`,
            'GET'
        );
        
        if (referrer.length > 0) {
            const newRefsCount = referrer[0].refs + 1;
            
            await supabaseFetch(
                `/rest/v1/${TABLE}?user_id=eq.${ref_by}`,
                'PATCH',
                { 'Prefer': 'return=minimal' },
                { refs: newRefsCount }
            );
        }
    }

    return { success: true, message: 'User registered successfully.' };
}

/**
 * Get user profile data, applying ad reset logic if necessary.
 */
async function getProfile({ user_id }) {
    if (!user_id) throw new Error('user_id is required.');

    // Check for daily ad reset before fetching the profile data
    await checkAdReset(user_id);

    const data = await supabaseFetch(
        `/rest/v1/${TABLE}?user_id=eq.${user_id}&select=*`,
        'GET'
    );

    if (data.length === 0) {
        throw new Error('User not found. Please register first.');
    }

    return { success: true, data: data[0] };
}

/**
 * Handles the points-to-USDT swap logic.
 */
async function swapPoints({ user_id, points_amount }) {
    if (!user_id || !points_amount || points_amount <= 0) {
        return { success: false, error: 'Invalid input for swap.' };
    }
    
    const user = await getProfile({ user_id });
    const userData = user.data;

    if (userData.points < points_amount) {
        return { success: false, error: 'Insufficient points balance.' };
    }

    const usdtEarned = points_amount / POINTS_TO_USDT_RATE;
    const newPoints = userData.points - points_amount;
    const newUsdt = parseFloat((userData.usdt + usdtEarned).toFixed(4));

    await supabaseFetch(
        `/rest/v1/${TABLE}?user_id=eq.${user_id}`,
        'PATCH',
        { 'Prefer': 'return=minimal' },
        { points: newPoints, usdt: newUsdt }
    );
    
    const updatedProfile = await getProfile({ user_id });
    return { success: true, data: updatedProfile.data };
}

/**
 * Checks if the daily ad counter needs to be reset. (معدلة - الإصلاح 7)
 */
async function checkAdReset(user_id) {
    const data = await supabaseFetch(
        `/rest/v1/${TABLE}?user_id=eq.${user_id}&select=ads_date`,
        'GET'
    );
    if (data.length === 0 || !data[0].ads_date) return;

    const dbDate = data[0].ads_date;
    const today = new Date();
    const dbDateObj = new Date(dbDate);

    // الإصلاح 7: مقارنة التواريخ باستخدام toDateString
    if (dbDateObj.toDateString() !== today.toDateString()) {
        
        // الإصلاح 7: حساب وقت إعادة التعيين
        const nextReset = new Date(dbDateObj);
        nextReset.setDate(nextReset.getDate() + 1); 
        nextReset.setHours(RESET_HOURS, 0, 0, 0); // ضبط الساعة 15:00:00.000

        // إذا كان الوقت الحالي (اليوم) أكبر من وقت إعادة التعيين
        if (today.getTime() >= nextReset.getTime()) {
             await supabaseFetch(
                `/rest/v1/${TABLE}?user_id=eq.${user_id}`,
                'PATCH',
                { 'Prefer': 'return=minimal' },
                { 
                    ads_watched_today: 0, 
                    ads_date: today.toISOString() // تسجيل تاريخ اليوم الجديد ISO
                }
            );
        }
    }
}

/**
 * Returns the current ad watching status (cooldown, limit).
 */
async function adStatus({ user_id }) {
    if (!user_id) throw new Error('user_id is required.');

    const profile = await getProfile({ user_id });
    const userData = profile.data;
    const now = Date.now();
    const lastWatch = userData.ads_last_watch || 0;
    const watchedToday = userData.ads_watched_today || 0;

    let canWatch = true;
    let remainingCooldownSec = 0;

    if (watchedToday >= DAILY_MAX_ADS) {
        canWatch = false;
    } else {
        const timeSinceLast = Math.floor((now - lastWatch) / 1000);
        if (timeSinceLast < COOLDOWN_SEC) {
            canWatch = false;
            remainingCooldownSec = COOLDOWN_SEC - timeSinceLast;
        }
    }

    return { 
        success: true, 
        data: { 
            can_watch: canWatch, 
            remaining_cooldown_sec: remainingCooldownSec,
            ads_watched_today: watchedToday
        } 
    };
}

/**
 * Rewards the user with points and updates ad metrics after a successful watch.
 */
async function adWatch({ user_id, reward = AD_REWARD_POINTS }) {
    if (!user_id) throw new Error('user_id is required.');

    const status = await adStatus({ user_id });
    if (!status.data.can_watch) {
        return { success: false, error: 'Cannot watch ad now (cooldown/limit).' };
    }
    
    const profile = await getProfile({ user_id });
    const userData = profile.data;

    const newPoints = userData.points + reward;
    const newWatched = userData.ads_watched_today + 1;
    const now = Date.now();

    await supabaseFetch(
        `/rest/v1/${TABLE}?user_id=eq.${user_id}`,
        'PATCH',
        { 'Prefer': 'return=minimal' },
        { 
            points: newPoints, 
            ads_watched_today: newWatched, 
            ads_last_watch: now 
        }
    );

    const updatedProfile = await getProfile({ user_id });
    return { success: true, data: updatedProfile.data };
}


/**
 * Fetches the leaderboard data (top 10 by points). (الإصلاح 5)
 */
async function leaderboard() {
    const data = await supabaseFetch(
        `/rest/v1/${TABLE}?select=user_id,username,points&order=points.desc&limit=10`,
        'GET'
    );
    
    return { success: true, data: data };
}

/**
 * Handles the withdrawal request logic. (الإصلاح 9)
 */
async function withdraw({ user_id, binance_id, amount }) {
    if (!user_id || !binance_id || amount <= 0) {
        return { success: false, error: 'Invalid withdrawal details or amount.' };
    }
    
    const user = await getProfile({ user_id });
    const userData = user.data;
    
    if (userData.usdt < amount) {
        return { success: false, error: 'Insufficient USDT balance.' };
    }

    const newUsdt = parseFloat((userData.usdt - amount).toFixed(4));
    
    // (B) Reduce the balance immediately
    await supabaseFetch(
        `/rest/v1/${TABLE}?user_id=eq.${user_id}`,
        'PATCH',
        { 'Prefer': 'return=minimal' },
        { usdt: newUsdt }
    );
    
    // *إضافة إلى جدول withdraws لإدارة الطلب*
    
    const updatedProfile = await getProfile({ user_id });
    return { success: true, data: updatedProfile.data, message: 'Withdrawal submitted.' };
}
