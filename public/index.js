// /public/index.js
// يعمل فقط مع IDs الموجودة في HTML، لا يضيف عناصر جديدة

const TG_SCRIPT = 'https://telegram.org/js/telegram-web-app.js';

function getTelegramUserID() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return null;
  tg.ready();
  return tg.initDataUnsafe?.user?.id || null;
}

function getRefParam() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return null;
  const startParam = tg.initDataUnsafe?.start_param;
  if (!startParam?.startsWith('ref_')) return null;
  return startParam.replace('ref_', '');
}

async function api(action, params = {}) {
  const base = window.location.origin;
  const res = await fetch(`${base}/api?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) throw new Error('API Error');
  return res.json();
}

async function registerUser() {
  const userID = getTelegramUserID();
  if (!userID) return;
  const refID = getRefParam();
  await api('register', { userID, refID });
}

async function getProfile() {
  const userID = getTelegramUserID();
  if (!userID) return {};
  return api('getProfile', { userID });
}

function updateUI(data) {
  if (document.getElementById('points')) {
    document.getElementById('points').textContent = data.points || 0;
  }
  if (document.getElementById('usdt')) {
    document.getElementById('usdt').textContent = (data.usdt || 0).toFixed(2);
  }
  if (document.getElementById('refCount')) {
    document.getElementById('refCount').textContent = data.refCount || 0;
  }
  if (document.getElementById('userName') && data.userName) {
    document.getElementById('userName').textContent = data.userName;
  }
  if (document.getElementById('userPic') && data.userPic) {
    document.getElementById('userPic').src = data.userPic;
  }
}

function setupButtons() {
  const bot = 'Game_win_usdtBot';
  const userID = getTelegramUserID();
  const refURL = userID ? `https://t.me/${bot}/earn?startapp=ref_${userID}` : '';

  const copyBtn = document.getElementById('copyRef2');
  if (copyBtn && refURL) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(refURL);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => copyBtn.textContent = '🔗 Copy Referral Link', 5000);
    };
  }

  const openTaskBtn = document.getElementById('openTask');
  const overlay = document.getElementById('taskOverlay');
  if (openTaskBtn && overlay) {
    openTaskBtn.onclick = () => overlay.style.display = 'flex';
  }

  const closeBtn = document.querySelector('.closeTask');
  if (closeBtn && overlay) {
    closeBtn.onclick = () => overlay.style.display = 'none';
  }
}

async function init() {
  try {
    await registerUser();
    const data = await getProfile();
    updateUI(data);
  } catch (e) {
    console.error('Init error:', e);
  } finally {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupButtons();
  init();
});