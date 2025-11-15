/* ============================
   🔥 Helper Functions
============================ */
const $ = id => document.getElementById(id);

function getTelegramUserID() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id)
    return window.Telegram.WebApp.initDataUnsafe.user.id;

  const params = new URLSearchParams(location.search);
  return Number(params.get("fakeId") || 0);
}

/* ============================
   🔥 Referral Extractor (الإحالات الحقيقي)
============================ */
function getRefParam() {
  const tg = window.Telegram?.WebApp;

  // ✔ داخل Telegram WebApp
  if (tg?.initDataUnsafe?.start_param) {
    let ref = tg.initDataUnsafe.start_param;
    if (ref.startsWith("ref_")) ref = ref.replace("ref_", "");
    return ref;
  }

  // ✔ خارج Telegram (للتجربة)
  const url = new URLSearchParams(location.search);
  let ref = url.get("startapp") || url.get("ref");
  if (!ref) return null;
  if (ref.startsWith("ref_")) ref = ref.replace("ref_", "");
  return ref;
}

/* ============================
   🔥 API Wrapper
============================ */
async function api(action, payload = {}) {
  const user_id = getTelegramUserID();
  const body = { action, user_id, ...payload };

  const res = await fetch(`/api/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return res.json();
}

/* ============================
   🔥 Registration
============================ */
async function registerUser() {
  const ref_by = getRefParam();
  return await api("register", { ref_by });
}

/* ============================
   🔥 Profile
============================ */
async function getProfile() {
  return await api("getProfile");
}

async function reloadProfile() {
  const data = await getProfile();
  if (!data) return;

  $("points").textContent = data.points ?? 0;
  $("usdt").textContent = (data.usdt ?? 0).toFixed(2);
  $("refCount").textContent = data.refs ?? 0;

  // صورة + اسم من Telegram
  const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (u) {
    if (u.photo_url) {
      $("userImg").src = u.photo_url;
      $("userImg").style.display = "block";
    }
    $("username").textContent = u.first_name || u.username || "";
  }
}

/* ============================
   🔥 Swap
============================ */
function calcSwap() {
  const pts = parseInt($("pointsInput").value) || 0;
  const usdt = (pts / 100000 * 0.01).toFixed(4);
  $("usdtValue").textContent = usdt + " USDT";
}

async function handleConvert() {
  const pts = parseInt($("pointsInput").value) || 0;
  if (pts <= 0) return;

  const res = await api("swap", { points: pts });
  if (res.error) return showSwapMsg(res.error, "error");

  $("pointsInput").value = "";
  calcSwap();
  await reloadProfile();
  showSwapMsg("Success!", "success");
}

function showSwapMsg(text, type) {
  const m = $("swapMsg");
  m.textContent = text;
  m.className = type;
  m.style.opacity = 1;

  setTimeout(() => (m.style.opacity = 0), 2000);
}

/* ============================
   🔥 Ad System
============================ */
async function updateAdCounter() {
  const st = await api("adStatus");

  $("adsCounterTop").textContent = st.remain;
  $("adsBtn").disabled = !st.canWatch;
  $("adsBtn").style.opacity = st.canWatch ? 1 : 0.5;
}

async function handleWatchAd() {
  const st = await api("adStatus");
  if (!st.canWatch) return;

  try {
    await window.showGiga();
    await api("adWatch");
    await reloadProfile();
    await updateAdCounter();
  } catch (e) {
    console.log("Ad error:", e);
  }
}

/* ============================
   🔥 Referral Copy Link
============================ */
function copyRefLink() {
  const uid = getTelegramUserID();
  const link = `https://t.me/Game_win_usdtBot/earn?startapp=ref_${uid}`;

  navigator.clipboard.writeText(link).then(() => {
    const m = $("copyMsg");
    m.style.opacity = 1;
    setTimeout(() => (m.style.opacity = 0), 2000);
  });
}

/* ============================
   🔥 UI Navigation
============================ */
function showPage(id) {
  document.querySelectorAll(".page, .screen").forEach(e => e.classList.remove("active"));
  $(id).classList.add("active");

  const home = id === "home";

  $("userCircle").style.display = home ? "flex" : "none";
  $("username").style.display = home ? "block" : "none";
  $("topBalance").style.display = home ? "flex" : "none";
  $("adsCounterTop").style.display = home ? "block" : "none";
}

function setupButtons() {
  $("withdrawBtn").onclick = () => showPage("withdraw");
  $("taskBtn").onclick = () => showPage("task");
  $("adsBtn").onclick = () => handleWatchAd();
  $("swapBtn").onclick = () => showPage("swap");
  $("ledbordBtn").onclick = () => showPage("ledbord");
  $("refalBtn").onclick = () => showPage("refal");

  ["withdrawBack", "taskBack", "swapBack", "ledbordBack", "refalBack"]
    .forEach(id => ($(id).onclick = () => showPage("home")));

  $("pointsInput").oninput = calcSwap;
  $("convertBtn").onclick = handleConvert;
  $("copyBtn").onclick = copyRefLink;
}

/* ============================
   🔥 Init
============================ */
async function init() {
  await registerUser();
  setupButtons();
  await reloadProfile();
  calcSwap();
  await updateAdCounter();

  setInterval(updateAdCounter, 2000);
}

window.addEventListener("DOMContentLoaded", init);