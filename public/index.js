/* ============================
   Telegram USER ID
============================ */
function getTelegramUserID() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return window.Telegram.WebApp.initDataUnsafe.user.id;
  }

  // fallback خارج تلغرام
  const saved = localStorage.getItem("telegramUser");
  if (saved) {
    try {
      return JSON.parse(saved).id;
    } catch {}
  }
  return "default";
}

/* ============================
   REF PARAM
============================ */
function getRefParam() {
  const q = new URLSearchParams(window.location.search);
  const s = q.get("startapp") || "";
  return s.startsWith("ref_") ? s.replace("ref_", "") : null;
}

/* ============================
   API CALLER
============================ */
async function api(action, params = {}) {
  const res = await fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params })
  });
  return res.json();
}

/* ============================
   REGISTER
============================ */
async function registerUser() {
  await api("registerUser", {
    userID: getTelegramUserID(),
    refBy: getRefParam()
  });
}

/* ============================
   PROFILE
============================ */
async function getProfile() {
  return await api("getProfile", { userID: getTelegramUserID() });
}

/* ============================
   UPDATE UI
============================ */
function updateUI(p) {
  document.getElementById("points").textContent = p.points || 0;
  document.getElementById("usdt").textContent = (p.usdt || 0).toFixed(2);
  document.getElementById("refCount").textContent = p.refs || 0;
}

/* ============================
   LOAD TELEGRAM PROFILE
============================ */
function loadTelegramProfile() {
  const tg = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const img = document.getElementById("userImg");
  const name = document.getElementById("username");

  if (!tg) return;

  if (tg.photo_url) {
    img.src = tg.photo_url;
    img.style.display = "block";
  }

  if (tg.first_name) {
    name.textContent = tg.first_name;
  }
}

/* ============================
   PAGE SWITCHER
============================ */
function showPage(id) {
  document.querySelectorAll(".page, .screen").forEach(el => el.classList.remove("active"));

  if (id === "home") {
    document.getElementById("home").classList.add("active");
    document.getElementById("userCircle").style.display = "flex";
    document.getElementById("username").style.display = "block";
    document.getElementById("topBalance").style.display = "flex";
    document.getElementById("adsCounterTop").style.display = "block";
    return;
  }

  const p = document.getElementById(id);
  if (p) p.classList.add("active");

  document.getElementById("userCircle").style.display = "none";
  document.getElementById("username").style.display = "none";
  document.getElementById("topBalance").style.display = "none";
  document.getElementById("adsCounterTop").style.display = "none";
}

/* ============================
   SWAP SYSTEM
============================ */
function calcSwap() {
  const pts = parseInt(document.getElementById("pointsInput").value) || 0;
  const usdt = (pts / 100000 * 0.01).toFixed(4);
  document.getElementById("usdtValue").textContent = `${usdt} USDT`;
}

async function handleConvert() {
  const input = document.getElementById("pointsInput");
  const pts = parseInt(input.value) || 0;
  if (pts <= 0) return;

  const res = await api("swap", {
    userID: getTelegramUserID(),
    points: pts
  });

  if (res.error) return showSwapMsg(res.error, "error");

  showSwapMsg("Success!", "success");
  input.value = "";
  calcSwap();
  updateUI(res);
}

function showSwapMsg(text, type) {
  const box = document.getElementById("swapMsg");
  box.textContent = text;
  box.className = type;
  box.style.opacity = "1";
  setTimeout(() => (box.style.opacity = "0"), 2000);
}

/* ============================
   COPY REF LINK
============================ */
function copyRefLink() {
  const bot = window.env?.NEXT_PUBLIC_BOT_USERNAME || "Game_win_usdtBot";
  const uid = getTelegramUserID();
  const link = `https://t.me/${bot}/earn?startapp=ref_${uid}`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(showCopyMsg);
  } else {
    const ta = document.createElement("textarea");
    ta.value = link;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showCopyMsg();
  }
}

function showCopyMsg() {
  const msg = document.getElementById("copyMsg");
  msg.style.opacity = "1";
  setTimeout(() => (msg.style.opacity = "0"), 2000);
}

/* ============================
   ADS SYSTEM
============================ */
async function handleAdWatch() {
  const res = await api("adWatch", { userID: getTelegramUserID() });
  if (res.error) return alert(res.error);
  updateUI(res);
  updateAdButton();
}

async function updateAdButton() {
  const res = await api("adStatus", { userID: getTelegramUserID() });

  const counter = document.getElementById("adsCounterTop");
  const btn = document.getElementById("adsBtn");

  counter.textContent = res.remain;

  if (res.remain <= 0) {
    btn.style.opacity = 0.5;
    btn.style.pointerEvents = "none";
    return;
  }

  if (res.cooldown > 0) {
    btn.style.opacity = 0.6;
    btn.style.pointerEvents = "none";

    let cd = res.cooldown;
    const timer = setInterval(() => {
      cd--;
      counter.textContent = `${Math.floor(cd / 60)}m ${cd % 60}s`;
      if (cd <= 0) {
        clearInterval(timer);
        btn.style.opacity = 1;
        btn.style.pointerEvents = "auto";
        counter.textContent = res.remain;
      }
    }, 1000);
  }
}

/* ============================
   BUTTON SETUP
============================ */
function setupButtons() {
  const pages = {
    withdrawBtn: "withdraw",
    taskBtn: "task",
    swapBtn: "swap",
    ledbordBtn: "ledbord",
    refalBtn: "refal"
  };

  Object.entries(pages).forEach(([btnId, page]) => {
    document.getElementById(btnId)?.addEventListener("click", () => showPage(page));
  });

  document.getElementById("adsBtn")?.addEventListener("click", handleAdWatch);

  ["withdrawBack", "taskBack", "ledbordBack", "swapBack", "refalBack"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", () => showPage("home"));
  });

  document.getElementById("copyBtn")?.addEventListener("click", copyRefLink);
  document.getElementById("convertBtn")?.addEventListener("click", handleConvert);
  document.getElementById("pointsInput")?.addEventListener("input", calcSwap);
}

/* ============================
   INIT
============================ */
async function init() {
  await registerUser();
  const p = await getProfile();
  updateUI(p);

  loadTelegramProfile(); // تحميل صورة + اسم المستخدم

  setupButtons();
  updateAdButton();
}

window.addEventListener("DOMContentLoaded", init);