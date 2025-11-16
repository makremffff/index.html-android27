// /public/index.js

// الثوابت والإعدادات
const AD_REWARD = 400;
const DAILY_MAX = 100;
const COOLDOWN_SEC = 3;
const POINTS_TO_USDT_RATE = 100000; // 100,000 Points = 0.01 USDT
const BOT_USERNAME = 'Game_win_usdtBot';

// الثوابت المعتمدة على الـ DOM IDs
const UI = {
    loaderOverlay: document.getElementById('loaderOverlay'),
    points: document.getElementById('points'),
    usdt: document.getElementById('usdt'),
    home: document.getElementById('home'),
    // الإعلانات
    adsBtn: document.getElementById('adsBtn'),
    notifBar: document.getElementById('notifBar'),
    // التحويل
    pointsInput: document.getElementById('pointsInput'),
    usdtValue: document.getElementById('usdtValue'),
    swapMsg: document.getElementById('swapMsg'),
    // المستخدم
    userImg: document.getElementById('userImg'),
    username: document.getElementById('username'),
    // الإحالة
    refCount: document.getElementById('refCount'),
    copyBtn: document.getElementById('copyBtn'),
    copyMsg: document.getElementById('copyMsg'),
    // الصفحات
    task: document.getElementById('task'),
    ledbord: document.getElementById('ledbord'),
    withdraw: document.getElementById('withdraw'),
    swap: document.getElementById('swap'),
    refal: document.getElementById('refal'),
    // السحب 
    withdrawMsg: document.getElementById('withdrawMsg'),
    binanceIdInput: document.getElementById('binanceIdInput'),
    withdrawAmountInput: document.getElementById('withdrawAmountInput'),
    availableUsdt: document.getElementById('availableUsdt'),
    // باقي العناصر 
    userCircle: document.getElementById('userCircle'),
    topBalance: document.getElementById('topBalance'),
    // لوحة الصدارة
    leaderboardList: document.getElementById('leaderboardList'),
    leaderboardStatus: document.getElementById('leaderboardStatus'),
};

/**
 * @returns {string|null} Telegram User ID or null if not found.
 */
function getTelegramUserID() {
    const webAppUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (webAppUser && webAppUser.id) {
        return String(webAppUser.id);
    }
    return null;
}

/**
 * @returns {string|null} Referral User ID from startapp=ref_ID or null.
 */
function getRefParam() {
    const startParam = new URLSearchParams(window.location.search).get('startapp');
    if (startParam && startParam.startsWith('ref_')) {
        return startParam.replace('ref_', '');
    }
    return null;
}

/**
 * Generic function to call the Vercel Serverless API. (معدلة)
 * @param {string} action - The action endpoint (e.g., 'register', 'profile', 'swap').
 * @param {object} params - Parameters to send with the request.
 * @returns {Promise<object>} The JSON response data.
 */
async function api(action, params = {}) {
    UI.loaderOverlay.style.display = 'flex'; 
    try {
        const response = await fetch(`/api/index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // الإصلاح 1: تضمين action في الـ body
            body: JSON.stringify({ action, ...params }),
        });

        if (!response.ok) {
            throw new Error(`API HTTP Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        // الإصلاح 8: التحقق من success في الدالة الرئيسية
        if (!data.success) {
            throw new Error(data.error || 'Unknown API Error');
        }
        return data;
    } catch (error) {
        console.error(`Error during API call to /api/index (Action: ${action}):`, error);
        // عرض الخطأ للمستخدم عبر شريط الإشعارات
        showNotif(`Operation failed: ${error.message}`, 'error'); 
        return { success: false, error: error.message };
    } finally {
        UI.loaderOverlay.style.display = 'none';
    }
}

/**
 * Registers the user with the backend, handling referral logic. (معدلة)
 */
async function registerUser() {
    const userId = getTelegramUserID();
    const refBy = getRefParam();
    
    if (!userId) {
        console.warn("User ID not available, skipping registration.");
        return;
    }
    
    // الإصلاح 6: تمرير كل بيانات المستخدم
    const userData = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
    
    const response = await api('register', {
        user_id: userId,
        ref_by: refBy,
        ...userData
    });

    if (!response.success) {
        console.error("Registration failed:", response.error);
    }
}

/**
 * Fetches the user's profile and data from the backend. (معدلة)
 */
async function getProfile() {
    const userId = getTelegramUserID();
    // يجب أن تكون دالة api قد قامت بالتحقق من response.success
    const response = await api('profile', { user_id: userId });

    if (response.success && response.data) {
        updateUI(response.data);
    } else {
        console.error("Failed to fetch profile:", response.error);
        showNotif(`Error loading profile: ${response.error}`, 'error');
    }
}

/**
 * Updates the UI elements based on the fetched user data.
 */
function updateUI(data) {
    if (UI.points) UI.points.textContent = data.points || 0;
    if (UI.usdt) UI.usdt.textContent = (data.usdt || 0).toFixed(2);
    if (UI.refCount) UI.refCount.textContent = data.refs || 0;
    
    const webAppUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (webAppUser) {
        if (UI.userImg && webAppUser.photo_url) {
            UI.userImg.src = webAppUser.photo_url;
            UI.userImg.style.display = 'block';
        }
        if (UI.username) {
            UI.username.textContent = webAppUser.first_name || webAppUser.username || 'User';
        }
    }
    
    updateAdButton(data);
}

/**
 * Handles the logic for displaying pages and views.
 * @param {string} id - The ID of the page to show ('home', 'withdraw', 'swap', etc.).
 */
function showPage(id) {
    document.querySelectorAll('.page, .screen').forEach(el => el.classList.remove('active'));

    const pageElement = document.getElementById(id);
    if (!pageElement) return;

    if (id === 'home') {
        pageElement.classList.add('active');
        if (UI.userCircle) UI.userCircle.style.display = 'flex';
        if (UI.username) UI.username.style.display = 'block';
        if (UI.topBalance) UI.topBalance.style.display = 'flex';
    } else {
        pageElement.classList.add('active');
        if (UI.userCircle) UI.userCircle.style.display = 'none';
        if (UI.username) UI.username.style.display = 'none';
        if (UI.topBalance) UI.topBalance.style.display = 'none';

        // Specific actions when opening certain pages
        if (id === 'withdraw' && UI.availableUsdt) {
            // Display current USDT balance on the withdraw page
            UI.availableUsdt.textContent = UI.usdt.textContent; 
        }
    }
}

/**
 * Loads and renders the leaderboard data. (الإصلاح 5)
 */
async function loadLeaderboard() {
    if (!UI.leaderboardList || !UI.leaderboardStatus) return;
    UI.leaderboardList.innerHTML = '';
    UI.leaderboardStatus.textContent = 'Loading...';

    const response = await api('leaderboard', { user_id: getTelegramUserID() });

    if (response.success && response.data && Array.isArray(response.data)) {
        if (response.data.length === 0) {
             UI.leaderboardStatus.textContent = 'No data available.';
             return;
        }

        const listHtml = response.data.map((user, index) => {
            const userName = user.username || `User ${user.user_id.substring(0, 4)}...`;
            return `
                <li style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #333; font-size:14px; color:#fff;">
                    <span>${index + 1}. ${userName}</span>
                    <span class="led">${user.points || 0}</span>
                </li>`;
        }).join('');
        
        UI.leaderboardList.innerHTML = listHtml;
        UI.leaderboardStatus.textContent = `Total Top 10 users displayed.`;
    } else {
        UI.leaderboardStatus.textContent = `Failed to load data: ${response.error || 'Check connection.'}`;
        console.error("Failed to load leaderboard:", response.error);
    }
}

/**
 * Utility to calculate the USDT value for the swap page.
 */
function calcSwap() {
    const pts = parseInt(UI.pointsInput.value) || 0;
    const usdt = (pts / POINTS_TO_USDT_RATE).toFixed(4);
    if (UI.usdtValue) UI.usdtValue.textContent = usdt + ' USDT';
}

/**
 * Handles the points-to-USDT conversion logic (Swap). (معدلة)
 */
async function handleConvert() {
    const ptsRequested = parseInt(UI.pointsInput.value) || 0;
    if (ptsRequested <= 0) return;

    const response = await api('swap', {
        user_id: getTelegramUserID(),
        points_amount: ptsRequested
    });

    if (UI.swapMsg) {
        if (response.success && response.data) {
            showMsg(UI.swapMsg, 'Success!', 'success');
            updateUI(response.data);
            UI.pointsInput.value = '';
            calcSwap();
        } else {
            showMsg(UI.swapMsg, response.error || 'Conversion Failed', 'error');
        }
    }
}

/**
 * Handles the withdrawal request logic. (معدلة)
 */
async function handleWithdraw() {
    const binanceId = UI.binanceIdInput.value.trim();
    const amount = parseFloat(UI.withdrawAmountInput.value) || 0;
    const minAmount = 0.03;

    if (binanceId.length === 0) {
        showMsg(UI.withdrawMsg, 'Please enter your Binance ID', 'error');
        return;
    }
    if (amount < minAmount) {
        showMsg(UI.withdrawMsg, `Minimum withdrawal is ${minAmount.toFixed(2)} USDT`, 'error');
        return;
    }
    
    // استدعاء endpoint 'withdraw' (الإصلاح 9)
    const response = await api('withdraw', {
        user_id: getTelegramUserID(),
        binance_id: binanceId,
        amount: amount
    });
    
    if (UI.withdrawMsg) {
        if (response.success && response.data) {
            showMsg(UI.withdrawMsg, 'Withdrawal request successful!', 'success');
            updateUI(response.data); // تحديث الرصيد بعد السحب
            UI.binanceIdInput.value = '';
            UI.withdrawAmountInput.value = '';
        } else {
            showMsg(UI.withdrawMsg, response.error || 'Withdrawal Failed', 'error');
        }
    }
}

/**
 * Handles the logic for watching an ad. (معدلة - الإصلاح 2 و 3)
 */
async function handleAdWatch() {
    const userId = getTelegramUserID();
    if (!userId) return;

    // الإصلاح 2: حماية نداء showGiga
    if (!window.showGiga) { 
        console.warn("showGiga() not found.");
        showNotif("Ad service not available.", 'error'); 
        return; 
    }

    // الإصلاح 3: 1. Check ad status first
    const statusResponse = await api('adStatus', { user_id: userId });
    
    if (!statusResponse.success) {
        console.error("Failed to get ad status:", statusResponse.error);
        showNotif(statusResponse.error, 'error');
        return;
    }

    const { can_watch } = statusResponse.data;

    if (!can_watch) {
        showNotif("Not ready to watch yet (cooldown/limit).");
        updateAdButton(statusResponse.data);
        return;
    }
    
    // 2. Show GigaPub Ad (external function)
    try {
        // الإصلاح 2: استدعاء showGiga بعد التحقق
        await window.showGiga();
        
        // 3. Notify backend that the ad was watched
        const watchResponse = await api('adWatch', { 
            user_id: userId,
            reward: AD_REWARD
        });

        if (watchResponse.success && watchResponse.data) {
            updateUI(watchResponse.data);
        } else {
            console.error("Ad reward failed:", watchResponse.error);
            showNotif(`Ad Reward Error: ${watchResponse.error}`, 'error');
        }
    } catch (e) {
        console.warn('Ad watching was cancelled or failed:', e);
        showNotif('Ad cancelled or failed to load.', 'error');
    }
}

/**
 * Updates the state of the Ads button based on user data.
 * @param {object} data - User data containing ad metrics or status data.
 */
function updateAdButton(data) {
    if (!UI.adsBtn) return;
    
    // نعتمد على البيانات في getProfile التي يتم تحديثها بعد كل عملية
    const watched = data.ads_watched_today || 0;
    const last = data.ads_last_watch || 0;
    const now = Date.now();

    if (watched >= DAILY_MAX) {
        UI.adsBtn.style.opacity = 0.4;
        UI.adsBtn.style.pointerEvents = 'none';
        UI.adsBtn.textContent = 'Back Tomorrow';
        return;
    }

    const timeSinceLast = Math.floor((now - last) / 1000);
    if (timeSinceLast < COOLDOWN_SEC) {
        UI.adsBtn.style.pointerEvents = 'none';
        UI.adsBtn.style.opacity = 0.6;
        UI.adsBtn.textContent = `Wait ${COOLDOWN_SEC - timeSinceLast}s`;
        
        // Set timeout to re-check status
        setTimeout(() => getProfile(), (COOLDOWN_SEC - timeSinceLast) * 1000 + 500); 
        return;
    }

    // Ready to watch
    UI.adsBtn.style.opacity = 1;
    UI.adsBtn.style.pointerEvents = 'auto';
    UI.adsBtn.textContent = 'Ads';
}

/**
 * Displays a temporary message (success/error) in a specific box.
 */
function showMsg(element, text, type) {
    if (!element) return;
    element.textContent = text;
    element.className = type;
    element.style.opacity = '1';
    setTimeout(() => element.style.opacity = '0', 3000);
}

/**
 * Displays a temporary notification bar.
 */
function showNotif(text, type = 'info') {
    if (!UI.notifBar) return;
    UI.notifBar.textContent = text;
    UI.notifBar.className = type; // يمكن استخدامها لتغيير لون الخلفية/الحد
    UI.notifBar.style.display = 'block';
    setTimeout(() => UI.notifBar.style.display = 'none', 4000);
}

/**
 * Handles the copy referral link action.
 */
function copyRefLink() {
    const userId = getTelegramUserID() || 'default';
    const link = `https://t.me/${BOT_USERNAME}/earn?startapp=ref_${userId}`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => {
            if (UI.copyMsg) {
                UI.copyMsg.style.opacity = '1';
                setTimeout(() => UI.copyMsg.style.opacity = '0', 2000);
            }
        }).catch(err => {
            console.error('Failed to copy link:', err);
        });
    } else {
        console.warn('Clipboard API not available.');
    }
}

/**
 * Sets up all event listeners for the UI elements. (معدلة - الإصلاح 4 و 5)
 */
function setupButtons() {
    // 1. Page Navigation 
    document.querySelectorAll('.btn[data-page], .back[data-page]').forEach(button => {
        button.addEventListener('click', (e) => {
            const pageId = e.currentTarget.getAttribute('data-page');
            showPage(pageId);
            // الإصلاح 5: جلب بيانات لوحة الصدارة عند فتح الصفحة
            if (pageId === 'ledbord') loadLeaderboard();
        });
    });

    // 2. Core Actions
    if (UI.adsBtn) UI.adsBtn.addEventListener('click', handleAdWatch);
    if (UI.copyBtn) UI.copyBtn.addEventListener('click', copyRefLink);
    
    // 3. Swap Functionality (الإصلاح 4)
    if (UI.pointsInput) UI.pointsInput.addEventListener('input', calcSwap);
    const convertBtn = document.querySelector('[data-action="submit-convert"]');
    if (convertBtn) convertBtn.addEventListener('click', handleConvert);

    // 4. Withdraw Functionality (الإصلاح 4)
    const withdrawBtn = document.querySelector('[data-action="submit-withdraw"]');
    if (withdrawBtn) withdrawBtn.addEventListener('click', handleWithdraw);
    
    // Initial view
    showPage('home');
}

/**
 * Main initialization function.
 */
async function init() {
    // 1. Register User 
    await registerUser(); 

    // 2. Fetch User Profile and Update UI
    await getProfile();

    // 3. Setup Event Listeners
    setupButtons();

    // 4. Initial calculations for Swap page
    calcSwap(); 

    // Hide loader only after all initial data is loaded and UI is set
    if (UI.loaderOverlay) UI.loaderOverlay.style.display = 'none';
    
    console.log("App initialized.");
}

// Start the application
window.addEventListener('DOMContentLoaded', init);
