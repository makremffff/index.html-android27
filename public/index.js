// /public/index.js – Hybrid REST + Client-Side Logic WebApp API
// يعمل داخل Telegram WebApp وخارجه دون تغيير HTML
const TG_SCRIPT = 'https://telegram.org/js/telegram-web-app.js';
const API_BASE  = window.location.origin + '/api?action=';

// ---------- Telegram helpers ----------
function getTelegramUserID() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return null;
  tg.ready();
  return tg.initDataUnsafe?.user?.id || null;
}
function getRefParam() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return null;
  const sp = tg.initDataUnsafe?.start_param;
  return sp?.startsWith('ref_') ? sp.replace('ref_', '') : null;
}

// ---------- REST API caller ----------
async function api(action, params = {}) {
  const res = await fetch(API_BASE + action, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(params)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---------- Registration & Profile ----------
async function registerUser() {
  const uid = getTelegramUserID();
  if (!uid) return;
  await api('register', { userID: uid, refID: getRefParam() });
}
async function getProfile() {
  const uid = getTelegramUserID();
  if (!uid) return {};
  return api('getProfile', { userID: uid });
}

// ---------- UI update (فقط IDs الموجودة) ----------
function updateUI(data) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('points', data.points || 0);
  set('usdt', (data.usdt || 0).toFixed(2));
  set('refCount', data.refCount || 0);
  if (data.userName) set('userName', data.userName);
  if (data.userPic) {
    const pic = document.getElementById('userPic');
    if (pic) pic.src = data.userPic;
  }
}

// ---------- Buttons logic ----------
function setupButtons() {
  const bot     = 'Game_win_usdtBot';
  const uid     = getTelegramUserID();
  const refURL  = uid ? `https://t.me/${bot}/earn?startapp=ref_${uid}` : '';

  const copyBtn = document.getElementById('copyRef2');
  if (copyBtn && refURL) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(refURL);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => copyBtn.textContent = '🔗 Copy Referral Link', 2000);
    };
  }

  const openBtn = document.getElementById('openTask');
  const overlay = document.getElementById('taskOverlay');
  if (openBtn && overlay) openBtn.onclick = () => overlay.style.display = 'flex';

  const closeBtn = document.querySelector('.closeTask');
  if (closeBtn && overlay) closeBtn.onclick = () => overlay.style.display = 'none';
}

// ---------- Initialization ----------
async function init() {
  try {
    await registerUser();
    const data = await getProfile();
    updateUI(data);
  } catch (e) { console.error('Init error:', e); }
  finally {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupButtons();
  init();
});
