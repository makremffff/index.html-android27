// /public/index.js
// Vanilla JS فقط، لا يستخدم أى مكتبات أو localStorage لحفظ بيانات المستخدم

/* ---------- 1️⃣ Helpers ---------- */
const $ = id => document.getElementById(id);

function getTelegramUserID() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return window.Telegram.WebApp.initDataUnsafe.user.id;
  }
  return 'default';
}

function getRefParam() {
  const start = new URLSearchParams(window.location.search).get('startapp');
  if (start && start.startsWith('ref_')) return start.replace('ref_', '');
  return null;
}

async function api(action, params = {}) {
  const body = { action, ...params, user_id: getTelegramUserID() };
  const res = await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

/* ---------- 2️⃣ Registration & Profile ---------- */
async function registerUser() {
  const refBy = getRefParam();
  await api('registerUser', { ref_by: refBy });
}

async function getProfile() {
  const data = await api('getProfile');
  updateUI(data);
}

/* ---------- 3️⃣ UI Update ---------- */
function updateUI(data) {
  $('points').textContent = data.points || 0;
  $('usdt').textContent   = (data.usdt || 0).toFixed(2);
  $('refCount').textContent = data.refs || 0;
}

/* ---------- 4️⃣ Navigation ---------- */
function showPage(pageId) {
  document.querySelectorAll('.page, .screen').forEach(el => el.classList.remove('active'));
  if (pageId === 'home') {
    $('home').classList.add('active');
    $('userCircle').style.display = 'flex';
    $('username').style.display   = 'block';
    $('topBalance').style.display = 'flex';
    $('adsCounterTop').style.display = 'block';
  } else {
    $(pageId).classList.add('active');
    $('userCircle').style.display = 'none';
    $('username').style.display   = 'none';
    $('topBalance').style.display = 'none';
    $('adsCounterTop').style.display = 'none';
  }
}

/* ---------- 5️⃣ Buttons Setup ---------- */
function setupButtons() {
  // أزرار التنقل الرئيسية
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  // زر الإعلانات
  $('adsBtn').addEventListener('click', handleAdWatch);

  // زر التحويل
  $('convertBtn').addEventListener('click', handleConvert);

  // زر نسخ الرابط
  $('copyBtn').addEventListener('click', copyRefLink);

  // حقل الإدخال (حساب مباشر)
  $('pointsInput').addEventListener('input', calcSwap);
}

/* ---------- 6️⃣ Swap Logic ---------- */
function calcSwap() {
  const pts = parseInt($('pointsInput').value) || 0;
  const usdt = (pts / 100000 * 0.01).toFixed(4);
  $('usdtValue').textContent = usdt + ' USDT';
}

async function handleConvert() {
  const ptsRequested = parseInt($('pointsInput').value) || 0;
  if (ptsRequested <= 0) return;

  const res = await api('swap', { points: ptsRequested });
  if (res.error) return showSwapMsg(res.error, 'error');

  showSwapMsg('Success!', 'success');
  $('pointsInput').value = '';
  calcSwap();
  updateUI(res);
}

function showSwapMsg(text, type) {
  const box = $('swapMsg');
  box.textContent = text;
  box.className = type;
  box.style.opacity = '1';
  setTimeout(() => box.style.opacity = '0', 2000);
}

/* ---------- 7️⃣ Ads Logic ---------- */
async function handleAdWatch() {
  const status = await api('adStatus');
  if (status.cooldown) return;          // العداد يعمل تلقائياً
  if (status.remaining <= 0) return;    // وصل للحد اليومى

  try {
    await window.showGiga();
    const res = await api('adWatch');
    updateUI(res);
  } catch (e) {
    console.warn('Ad error:', e);
  }
}

/* ---------- 8️⃣ Copy Referral Link ---------- */
function copyRefLink() {
  const uid = getTelegramUserID();
  const link = `https://t.me/Game_win_usdtBot/earn?startapp=ref_${uid}`;

  navigator.clipboard.writeText(link).then(() => {
    const m = $('copyMsg');
    m.style.opacity = '1';
    setTimeout(() => m.style.opacity = '0', 2000);
  });
}

/* ---------- 9️⃣ Init ---------- */
async function init() {
  setupButtons();
  await registerUser();
  await getProfile();

  // تحديث العداد كل ثانية
  setInterval(async () => {
    const status = await api('adStatus');
    $('adsCounterTop').textContent = status.remaining;
    if (status.cooldown) {
      $('adsBtn').style.pointerEvents = 'none';
      $('adsBtn').style.opacity = 0.6;
    } else {
      $('adsBtn').style.pointerEvents = 'auto';
      $('adsBtn').style.opacity = 1;
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
