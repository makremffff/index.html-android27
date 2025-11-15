// ====== helpers ======
const $ = id => document.getElementById(id);

function getTelegramUserID() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id)
    return window.Telegram.WebApp.initDataUnsafe.user.id;

  const params = new URLSearchParams(location.search);
  const fake = params.get('fakeId');
  return fake ? parseInt(fake, 10) : 0;
}

function getRefParam() {
  const params = new URLSearchParams(location.search);
  const refRaw = params.get('startapp') || params.get('ref');
  if (!refRaw) return null;
  if (refRaw.startsWith('ref_')) return refRaw.replace('ref_', '');
  return refRaw;
}

async function api(action, payload = {}) {
  const uid = getTelegramUserID();
  const body = { action, user_id: uid, ...payload };

  const res = await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return res.json();
}

// ====== registration / profile ======
async function registerUser() {
  const refBy = getRefParam();
  await api('register', { ref_by: refBy });
}

async function getProfile() {
  return await api('getProfile');
}

// ====== UI update ======
function updateUI(data) {
  $('points').textContent = data.points ?? 0;
  $('usdt').textContent   = (data.usdt ?? 0).toFixed(2);
  $('refCount').textContent = data.refs ?? 0;

  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    const u = window.Telegram.WebApp.initDataUnsafe.user;
    if (u.photo_url) {
      $('userImg').src = u.photo_url;
      $('userImg').style.display = 'block';
    }
    $('username').textContent = u.first_name || u.username || '';
  }
}

// ====== صفحات ======
function showPage(id) {
  document.querySelectorAll('.page, .screen').forEach(el => el.classList.remove('active'));

  if (id === 'home') {
    $('home').classList.add('active');
    $('userCircle').style.display = 'flex';
    $('username').style.display = 'block';
    $('topBalance').style.display = 'flex';
    $('adsCounterTop').style.display = 'block';
  } else {
    $(id).classList.add('active');
    $('userCircle').style.display = 'none';
    $('username').style.display = 'none';
    $('topBalance').style.display = 'none';
    $('adsCounterTop').style.display = 'none';
  }
}

// ====== أزرار ======
function setupButtons() {
  $('withdrawBtn').onclick = () => showPage('withdraw');
  $('taskBtn').onclick     = () => showPage('task');
  $('adsBtn').onclick      = () => handleWatchAd();
  $('swapBtn').onclick     = () => showPage('swap');
  $('ledbordBtn').onclick  = () => showPage('ledbord');
  $('refalBtn').onclick    = () => showPage('refal');

  ['withdrawBack','taskBack','swapBack','ledbordBack','refalBack']
    .forEach(id => $(id).onclick = () => showPage('home'));

  $('pointsInput').oninput = () => calcSwap();
  $('convertBtn').onclick  = () => handleConvert();

  $('copyBtn').onclick = () => copyRefLink();
}

// ====== swap ======
function calcSwap() {
  const pts = parseInt($('pointsInput').value) || 0;
  const usdt = (pts / 100000 * 0.01).toFixed(4);
  $('usdtValue').textContent = usdt + ' USDT';
}

async function handleConvert() {
  const pts = parseInt($('pointsInput').value) || 0;
  if (pts <= 0) return;

  const res = await api('swap', { points: pts });
  if (res.error) return showSwapMsg(res.error, 'error');

  $('pointsInput').value = '';
  calcSwap();
  await reloadProfile();
  showSwapMsg('Success!', 'success');
}

function showSwapMsg(text, type) {
  const box = $('swapMsg');
  box.textContent = text;
  box.className = type;
  box.style.opacity = '1';
  setTimeout(() => box.style.opacity = '0', 2000);
}

// ====== إحالات ======
function copyRefLink() {
  const uid = getTelegramUserID();
  const link = `https://t.me/Game_win_usdtBot/earn?startapp=ref_${uid}`;
  navigator.clipboard.writeText(link).then(() => {
    const m = $('copyMsg');
    m.style.opacity = '1';
    setTimeout(() => m.style.opacity = '0', 2000);
  });
}

// ====== إعلانات GigaPub ======
async function adStatus() {
  return await api('adStatus');
}

async function handleWatchAd() {
  const st = await adStatus();
  if (!st.canWatch) return;

  try {
    await window.showGiga();
    await api('adWatch');
    await reloadProfile();
    await updateAdCounter();
  } catch (e) {
    console.warn('Ad error:', e);
  }
}

async function updateAdCounter() {
  const st = await adStatus();
  $('adsCounterTop').textContent = st.remain;
  $('adsBtn').disabled = !st.canWatch;
  $('adsBtn').style.opacity = st.canWatch ? '1' : '0.5';
}

// ====== init ======
async function reloadProfile() {
  const data = await getProfile();
  updateUI(data);
}

async function init() {
  await registerUser();
  setupButtons();
  await reloadProfile();
  calcSwap();
  await updateAdCounter();
  setInterval(updateAdCounter, 2000);
}

window.addEventListener('DOMContentLoaded', init);