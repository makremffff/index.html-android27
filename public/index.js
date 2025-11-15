// /public/index.js

/* ============================
   Telegram USER ID
============================ */
function getTelegramUserID() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return window.Telegram.WebApp.initDataUnsafe.user.id;
  }
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
  const params = new URLSearchParams(window.location.search);
  const s = params.get("startapp") || "";
  return s.startsWith("ref_") ? s.replace("ref_", "") : null;
}

/* ============================
   API
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
function updateUI(data) {
  document.getElementById("points").textContent = data.points || 0;
  document.getElementById("usdt").textContent = (data.usdt || 0).toFixed(2);
  document.getElementById("refCount").textContent = data.refs || 0;
}

/* ============================
   PAGE SYSTEM
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

  document.getElementById(id)?.classList.add("active");
  document.getElementById("userCircle").style.display = "none";
  document.getElementById("username").style.display = "none";
  document.getElementById("topBalance").style.display = "none";
  document.getElementById("adsCounterTop").style.display = "none";
}

/* ============================
   SWAP CALC
============================ */
function calcSwap() {
  const pts = parseInt(document.getElementById("pointsInput").value) || 0;
  const usdt = (pts / 100000 * 0.01).toFixed(4);
  document.getElementById("usdtValue").textContent = usdt + " USDT";
}

/* ============================
   CONVERT
============================ */
async function handleConvert() {
  const input = document.getElementById("pointsInput");
  const pts = parseInt(input.value) || 0;
  if (pts <= 0) return;

  const res = await api("swap", {
    userID: getTelegramUserID(),
    points: pts
  });

  if (res.error) {
    showSwapMsg(res.error, "error");
    return;
  }

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
  const BOT = window.env?.NEXT_PUBLIC_BOT_USERNAME || "Game_win_usdtBot";
  const uid = getTelegramUserID();
  const link = `https://t.me/${BOT}/earn?startapp=ref_${uid}`;

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
  const m = document.getElementById("copyMsg");
  m.style.opacity = "1";
  setTimeout(() => (m.style.opacity = "0"), 2000);
}

/* ============================
   ADS
============================ */
async function handleAdWatch() {
  const userID = getTelegramUserID();
  const res = await api("adWatch", { userID });

  if (res.error) {
    alert(res.error);
    return;
  }

  updateUI(res);
  updateAdButton();
}

async function updateAdButton() {
  const userID = getTelegramUserID();
  const res = await api("adStatus", { userID });

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
  setupButtons();
  updateAdButton();
}

window.addEventListener("DOMContentLoaded", init);