/* ============================================================
   OnePiece-dle  —  game.js
   Clean rebuild: same core gameplay, improved architecture
   ============================================================ */

"use strict";

// ── Constants ───────────────────────────────────────────────
const HARD_LIMIT       = 5;
const DUEL_LIMIT       = 6;
const PLAYERS          = ["Player 1", "Player 2"];
const STATS_KEY        = "opdle_stats_v2";
const MODE_KEY         = "opdle_mode";
const COMPACT_KEY      = "opdle_compact";
const GAME_STATE_KEY   = "op_current_game_v1";
const PLACEHOLDER      = "img/placeholder.jpg";
const MYSTERY_POOL     = ["affiliation", "haki", "firstArc", "gender"];
const SEARCH_LIMIT     = 8;
const PRECISE_THRESHOLD = 920;
const FUZZY_THRESHOLD  = 700;
const MIN_SCORE        = 240;
const FOCUSABLE_SEL    = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const HAKI_CANONICAL = {
  observation: "observation", armament: "armament", conqueror: "conqueror",
  "👀": "observation", "💪": "armament", "👑": "conqueror"
};
const HAKI_DISPLAY = { observation: "👀", armament: "💪", conqueror: "👑" };

const ARC_ORDER = [
  "Romance Dawn","Orange Town","Syrup Village","Baratie","Arlong Park",
  "Loguetown","Reverse Mountain","Whisky Peak","Little Garden","Drum Island",
  "Arabasta","Jaya","Skypiea","Long Ring Long Land","Water 7","Enies Lobby",
  "Post-Enies Lobby","Thriller Bark","Sabaody Archipelago","Amazon Lily",
  "Impel Down","Marineford","Post-War","Return to Sabaody","Fish-Man Island",
  "Punk Hazard","Dressrosa","Zou","Whole Cake Island","Reverie",
  "Wano Country","Egghead"
];

// ── State ────────────────────────────────────────────────────
let CHARS         = [];
let answer        = null;
let mode          = "casual";
let attempts      = 0;
let solved        = false;
let guessedSet    = new Set();
let recentNames   = [];
let guessHistory  = [];
let hiddenCols    = [];
let confettiTimer = null;
let lastFocusEl   = null;
let charSearchIndex = [];

// Duel state
let duelTurn           = 0;
let duelAttempts       = [0, 0];
let duelGuessed        = [new Set(), new Set()];
let duelOutcome        = "";
let duelAwaitingReady  = false;
let duelHandoffTimer   = null;

// Stats
let stats = loadStats();

// ── DOM refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const searchInput  = $("searchInput");
const suggestionsEl = $("suggestions");
const boardRows    = $("boardRows");
const boardHeader  = $("boardHeader");
const statusMsg    = $("statusMsg");
const recentBar    = $("recentBar");
const recapCard    = $("recapCard");
const emptyState   = $("emptyState");
const newBtn       = $("newBtn");
const modeChip     = $("modeChip");
const attemptChip  = $("attemptChip");
const streakChip   = $("streakChip");
const statsDash    = $("statsDash");
const progressBar  = $("progressBar");
const progressFill = $("progressFill");
const progressLabel = $("progressLabel");
const boardContainer = $("boardContainer");
const lightbox     = $("lightbox");
const lightboxImg  = $("lightboxImg");
const lightboxClose = $("lightboxClose");
const duelGate     = $("duelGate");
const duelGateTitle = $("duelGateTitle");
const duelGateMsg  = $("duelGateMsg");
const duelReadyBtn = $("duelReadyBtn");
const settingsPanel = $("settingsPanel");
const helpPanel    = $("helpPanel");
const overlay      = $("overlay");
const compactToggle = $("compactToggle");
const modeGrid     = $("modeGrid");
const srAnnouncer  = $("srAnnouncer");
const srStatus     = $("srStatus");

let suggestionItems = [];
let activeSugIdx    = -1;

// ── Utilities ────────────────────────────────────────────────
function norm(s) { return (s || "").trim().toLowerCase(); }

function normalizeForSearch(s) {
  return norm(s).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }

function highlight(text, q) {
  const safe = esc(text == null ? "" : text);
  if (!q) return safe;
  return safe.replace(new RegExp(`(${escRe(esc(q))})`, "ig"), "<mark>$1</mark>");
}

// ── Accessibility helpers ─────────────────────────────────────
function announceLive(regionEl, text) {
  if (!regionEl) return;
  regionEl.textContent = "";
  if (!text) return;
  window.setTimeout(() => { regionEl.textContent = text; }, 20);
}

function rememberFocus() {
  if (document.activeElement instanceof HTMLElement) lastFocusEl = document.activeElement;
}

function restoreFocus(fallbackEl = null) {
  const target = (lastFocusEl && document.contains(lastFocusEl)) ? lastFocusEl : fallbackEl;
  if (target && typeof target.focus === "function") target.focus();
  lastFocusEl = null;
}

function getFocusableEls(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SEL))
    .filter(el => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
}

function trapFocus(container, e) {
  if (!container || e.key !== "Tab") return false;
  const focusable = getFocusableEls(container);
  if (!focusable.length) { e.preventDefault(); if (container.focus) container.focus(); return true; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); return true; }
  if (!e.shiftKey && document.activeElement === last)  { e.preventDefault(); first.focus(); return true; }
  return false;
}

function getOpenTrapContainer() {
  if (duelGate && !duelGate.classList.contains("hidden")) return duelGate;
  if (lightbox && !lightbox.classList.contains("hidden")) return lightbox;
  return null;
}

// ── Haki normalization ────────────────────────────────────────
function canonHaki(v) { return HAKI_CANONICAL[norm(v)] || norm(v); }

function formatHaki(list) {
  return (list || []).map(canonHaki).filter(Boolean)
    .map(k => HAKI_DISPLAY[k] || k).join(", ") || "None";
}

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function formatBounty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (v >= 1e9) return `₿ ${(v/1e9).toFixed(2)}B`;
  if (v >= 1e6) return `₿ ${(v/1e6).toFixed(0)}M`;
  return `₿ ${v.toLocaleString()}`;
}

function arcIdx(s) {
  return ARC_ORDER.findIndex(a => norm(a) === norm(s));
}

function safeScrollIntoView(el) {
  if (!el || typeof el.scrollIntoView !== "function") return;
  try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  catch (e) { try { el.scrollIntoView(); } catch (_) {} }
}

// ── Comparison logic ─────────────────────────────────────────
function compareExact(a, b) {
  return norm(a) === norm(b) ? "hit" : "miss";
}

function compareHaki(aH, gH) {
  const a = new Set((aH || []).map(canonHaki));
  const g = new Set((gH || []).map(canonHaki));
  if (a.size === 0 && g.size === 0) return "hit";
  if (a.size === 0 || g.size === 0) return "miss";
  let shared = 0;
  for (const x of g) if (a.has(x)) shared++;
  if (shared === a.size && shared === g.size) return "hit";
  if (shared > 0) return "close";
  return "miss";
}

function compareBounty(a, b) {
  const A = Number(a), B = Number(b);
  if (!Number.isFinite(A) || !Number.isFinite(B)) return "miss";
  if (A === B) return "hit";
  const ratio = A > B ? A / B : B / A;
  if (ratio <= 10) return "close";
  return "miss";
}

function bountyArrow(a, g) {
  const A = Number(a), G = Number(g);
  if (!Number.isFinite(A) || !Number.isFinite(G)) return "";
  if (G < A) return "↑";
  if (G > A) return "↓";
  return "";
}

function arcArrow(a, g) {
  const ai = arcIdx(a), gi = arcIdx(g);
  if (ai === -1 || gi === -1) return "";
  if (gi < ai) return "↑";
  if (gi > ai) return "↓";
  return "";
}

// ── Fuzzy search engine ───────────────────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0; if (!a) return b.length; if (!b) return a.length;
  let prev = Array.from({length: b.length + 1}, (_, i) => i);
  let curr = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i-1) === b.charCodeAt(j-1) ? 0 : 1;
      curr[j] = Math.min(prev[j]+1, curr[j-1]+1, prev[j-1]+cost);
    }
    const swap = prev; prev = curr; curr = swap;
  }
  return prev[b.length];
}

function matchScore(query, candidate) {
  const q = normalizeForSearch(query), c = normalizeForSearch(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1000;
  if (c.startsWith(q)) return 900 + Math.min(80, q.length * 4);
  if (c.includes(q))   return 780 + Math.min(60, q.length * 3);
  if (q.startsWith(c) && c.length >= 3) return 650 + Math.min(50, c.length * 2);
  const maxLen = Math.max(q.length, c.length);
  const ratio = 1 - levenshtein(q, c) / maxLen;
  if (ratio < 0.58) return 0;
  return Math.round(ratio * 500);
}

function buildSearchIndex() {
  charSearchIndex = CHARS.map(character => {
    const names = new Set();
    const add = v => { const n = normalizeForSearch(v); if (n.length >= 2) names.add(n); };
    const base = character.name ? String(character.name) : "";
    add(base);
    const parts = normalizeForSearch(base).split(" ").filter(Boolean);
    if (parts.length > 1) {
      add(parts[0]);
      add(parts[parts.length-1]);
      add(`${parts[0]} ${parts[parts.length-1]}`);
    }
    const inParens = /\(([^)]+)\)/.exec(base);
    if (inParens) add(inParens[1]);
    ["aliases","nicknames","alsoKnownAs"].forEach(k => {
      if (Array.isArray(character[k])) character[k].forEach(add);
      else if (typeof character[k] === "string") add(character[k]);
    });
    return { character, names: Array.from(names) };
  }).filter(e => e.character && typeof e.character.name === "string");
}

function getCharMatches(query, { limit = SEARCH_LIMIT, minScore = 0 } = {}) {
  const q = normalizeForSearch(query);
  if (!q) return [];
  const matches = [];
  for (const entry of charSearchIndex) {
    let best = 0;
    for (const c of entry.names) { const s = matchScore(q, c); if (s > best) best = s; }
    if (best >= minScore) matches.push({ character: entry.character, score: best });
  }
  matches.sort((a, b) => b.score !== a.score ? b.score - a.score : a.character.name.localeCompare(b.character.name));
  return matches.slice(0, limit);
}

function resolveCharFromInput(input) {
  const matches = getCharMatches(input, { limit: 4, minScore: MIN_SCORE });
  if (!matches.length) return null;
  const best = matches[0], next = matches[1];
  const gap = next ? best.score - next.score : Infinity;
  if (best.score >= PRECISE_THRESHOLD) return best.character;
  if (best.score >= FUZZY_THRESHOLD && (normalizeForSearch(input).length >= 3 || gap >= 110)) return best.character;
  if (best.score >= 860 && !next) return best.character;
  return null;
}

function findCharByName(name) {
  const n = norm(name);
  return CHARS.find(c => norm(c.name) === n) || resolveCharFromInput(name) || null;
}

// ── Stats ────────────────────────────────────────────────────
function defaultStats() {
  return { gamesPlayed: 0, wins: 0, streak: 0, bestStreak: 0, byMode: {} };
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    return { ...defaultStats(), ...JSON.parse(raw) };
  } catch (e) { return defaultStats(); }
}

function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
}

function modeStats(m = mode) {
  if (!stats.byMode[m]) stats.byMode[m] = { gamesPlayed: 0, wins: 0, streak: 0, bestStreak: 0, best: null };
  return stats.byMode[m];
}

function getHistory(m = mode) {
  try {
    const raw = localStorage.getItem(`opdle_hist_${m}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function pushHistory(win, m = mode) {
  try {
    const h = getHistory(m);
    h.push(win ? "W" : "L");
    if (h.length > 10) h.splice(0, h.length - 10);
    localStorage.setItem(`opdle_hist_${m}`, JSON.stringify(h));
  } catch (e) {}
}

function recordResult(win) {
  stats.gamesPlayed++;
  if (win) { stats.wins++; stats.streak++; stats.bestStreak = Math.max(stats.bestStreak, stats.streak); }
  else stats.streak = 0;

  const ms = modeStats();
  ms.gamesPlayed++;
  if (win) {
    ms.wins++;
    ms.streak++;
    ms.bestStreak = Math.max(ms.bestStreak, ms.streak);
    ms.best = ms.best === null ? attempts : Math.min(ms.best, attempts);
    try { localStorage.setItem("op_best", String(attempts)); } catch (e) {}
  } else {
    ms.streak = 0;
  }

  pushHistory(win);
  saveStats();
  renderStatsDash();
}

// ── Faction badge ─────────────────────────────────────────────
function factionBadge(affiliation, name = "") {
  const a = norm(affiliation), n = norm(name);
  if (!a) return ["Unknown", "fb-pirate"];
  if (a.includes("straw hat"))   return ["Straw Hat", "fb-strawhat"];
  if (a.includes("marine"))      return ["Marines",   "fb-marines"];
  if (a.includes("cross guild") || a.includes("warlord")) return ["Warlord", "fb-warlord"];
  if (a.includes("yonko") || a.includes("beasts pirates") || a.includes("big mom pirates") ||
      a.includes("red hair pirates") || a.includes("blackbeard pirates") || a.includes("whitebeard pirates"))
    return ["Yonko", "fb-yonko"];
  if (a.includes("revolutionary")) return ["Revolutionary", "fb-revo"];
  if (a.includes("kozuki") || a.includes("akazaya") || a.includes("samurai") || a.includes("wano"))
    return ["Wano", "fb-wano"];
  return ["Pirate", "fb-pirate"];
}

// ── UI helpers ────────────────────────────────────────────────
function setStatus(text, tone = "info") {
  if (!text) { statusMsg.textContent = ""; statusMsg.className = "status-msg"; return; }
  statusMsg.className = `status-msg status-${tone}`;
  statusMsg.textContent = text;
}

function modeLabel(m = mode) {
  const labels = { casual:"Casual", hard:"Hard", extreme:"Extreme", daily:"Daily", mystery:"Mystery Tiles", duel:"1v1 Duel" };
  return labels[m] || "Casual";
}

function updateChips() {
  modeChip.textContent = modeLabel();

  if (mode === "duel") {
    const left = Math.max(DUEL_LIMIT - duelAttempts[duelTurn], 0);
    attemptChip.textContent = `${PLAYERS[duelTurn]} · ${left} left`;
  } else if (mode === "hard" || mode === "extreme") {
    const left = Math.max(HARD_LIMIT - attempts, 0);
    attemptChip.textContent = `Guess ${Math.min(attempts+1, HARD_LIMIT)} / ${HARD_LIMIT}`;
    progressBar.classList.remove("hidden");
    const pct = (attempts / HARD_LIMIT) * 100;
    progressFill.style.width = `${pct}%`;
    progressFill.style.background = pct >= 80
      ? "linear-gradient(to right,#c0392b,#e74c3c)"
      : pct >= 60 ? "linear-gradient(to right,#8b6914,#d4af58)"
      : "linear-gradient(to right,#1a6b3c,#d4af58)";
    progressLabel.textContent = `${left} guess${left !== 1 ? "es" : ""} remaining`;
  } else if (mode === "daily") {
    attemptChip.textContent = `Daily ${dateKey()} · #${attempts+1}`;
  } else {
    attemptChip.textContent = `Guess ${attempts + 1}`;
    progressBar.classList.add("hidden");
  }

  const ms = modeStats();
  streakChip.textContent = `🔥 ${ms.streak}`;
}

function renderStatsDash() {
  if (!statsDash) return;
  const ms = modeStats();
  const hist = getHistory();
  const wr = ms.gamesPlayed ? Math.round((ms.wins / ms.gamesPlayed) * 100) : 0;

  const tiles = [
    { label: "Games", value: stats.gamesPlayed },
    { label: "Streak", value: ms.streak },
    { label: "Win Rate", value: `${wr}%` },
    { label: "Best", value: ms.best ?? "—" },
  ];

  const dotsHtml = hist.length ? `
    <div class="stat-tile">
      <div class="stat-tile-label">Last ${hist.length}</div>
      <div class="history-dots">
        ${hist.map(r => `<span class="history-dot ${r==="W"?"w":"l"}" title="${r==="W"?"Win":"Loss"}"></span>`).join("")}
      </div>
    </div>` : "";

  statsDash.innerHTML = tiles.map(t => `
    <div class="stat-tile">
      <div class="stat-tile-label">${t.label}</div>
      <div class="stat-tile-value">${t.value}</div>
    </div>
  `).join("") + dotsHtml;

  statsDash.classList.remove("hidden");
}

// ── Hidden columns ───────────────────────────────────────────
function pickHiddenCols() {
  const pool = [...MYSTERY_POOL];
  const picked = [];
  while (pool.length && picked.length < 2) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

function updateHeaderHidden() {
  boardHeader.querySelectorAll("[data-field]").forEach(el => {
    const f = el.dataset.field;
    if (hiddenCols.includes(f)) {
      el.textContent = "Hidden";
      el.classList.add("hidden-col");
    } else {
      // Restore labels
      const labels = { affiliation:"Affiliation", devilFruit:"Devil Fruit", haki:"Haki",
                        origin:"Origin", bounty:"Bounty", firstArc:"First Arc", gender:"Gender" };
      el.textContent = labels[f] || f;
      el.classList.remove("hidden-col");
    }
  });
}

// ── Confetti ──────────────────────────────────────────────────
function launchConfetti() {
  if (typeof confetti === "undefined") return;
  const end = Date.now() + 2000;
  confetti({ particleCount: 140, spread: 90, startVelocity: 46, origin: { x: 0.5, y: 0.6 } });
  (function burst() {
    confetti({ particleCount: 6, spread: 80, startVelocity: 40, origin: { x: 0.1, y: 0.65 }, angle: 58 });
    confetti({ particleCount: 6, spread: 80, startVelocity: 40, origin: { x: 0.9, y: 0.65 }, angle: 122 });
    if (Date.now() < end) requestAnimationFrame(burst);
  })();
}

// ── Share ─────────────────────────────────────────────────────
function buildShareText(recapSub) {
  const rows = Array.from(boardRows.children).reverse();
  const grid = rows.map(row => {
    return Array.from(row.querySelectorAll(".tile:not(.tile-avatar)"))
      .map(t => t.classList.contains("tile-hit") ? "🟢" : t.classList.contains("tile-close") ? "🟡" : "⬜")
      .join("");
  }).join("\n");
  const dateLine = mode === "daily" ? ` ${dateKey()}` : "";
  return `OnePieceWho${dateLine} | ${modeLabel()}\n${recapSub}\n\n${grid}`;
}

async function copyToClipboard(text, btn) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "✅ Copied!";
    } catch (e) {
      btn.textContent = "❌ Failed";
    }
  } else {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand("copy"); btn.textContent = "✅ Copied!"; }
    catch (e) { btn.textContent = "❌ Failed"; }
    document.body.removeChild(ta);
  }
  setTimeout(() => { if (btn) btn.textContent = "📋 Share"; }, 2200);
}

// ── Recap card ────────────────────────────────────────────────
function showRecap(win) {
  if (!answer) return;
  const ms = modeStats();
  const recapTitle = mode === "duel"
    ? (duelOutcome || "Duel Over")
    : (win ? "Round Complete" : "Round Over");
  const recapSub = mode === "duel"
    ? `P1: ${duelAttempts[0]}/${DUEL_LIMIT} · P2: ${duelAttempts[1]}/${DUEL_LIMIT}`
    : (win
      ? `Solved in ${attempts} guess${attempts === 1 ? "" : "es"}`
      : `The answer was ${answer.name}`);

  const playAgainBtn = (mode !== "daily")
    ? `<button class="recap-btn" id="recapPlay">↺ Again</button>` : "";

  recapCard.innerHTML = `
    <div class="recap-title">${esc(recapTitle)} · ${esc(modeLabel())}${mode === "daily" ? ` · ${dateKey()}` : ""}</div>
    <div class="recap-body">
      <img class="recap-avatar" src="${esc(answer.image || PLACEHOLDER)}" 
           onerror="this.src='${PLACEHOLDER}'" alt="${esc(answer.name)}">
      <div class="recap-info">
        <div class="recap-name">${esc(answer.name)}</div>
        <div class="recap-sub">${esc(recapSub)}</div>
      </div>
      <div class="recap-actions">
        <button class="recap-btn" id="recapShare">📋 Share</button>
        ${playAgainBtn}
      </div>
    </div>
  `;

  recapCard.classList.remove("hidden");

  const shareBtn = $("recapShare");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => copyToClipboard(buildShareText(recapSub), shareBtn));
  }

  const playBtn = $("recapPlay");
  if (playBtn) {
    playBtn.addEventListener("click", newGame);
  }
}

function hideRecap() {
  recapCard.classList.add("hidden");
  recapCard.innerHTML = "";
}

// ── Recent guesses bar ────────────────────────────────────────
function renderRecent() {
  if (mode === "duel" || !recentNames.length) {
    recentBar.classList.add("hidden");
    recentBar.innerHTML = "";
    return;
  }
  recentBar.classList.remove("hidden");
  recentBar.innerHTML = `<span class="recent-label">Recent</span>` +
    recentNames.map(n =>
      `<button class="recent-chip" data-name="${esc(n)}">${esc(n)}</button>`
    ).join("");
  recentBar.querySelectorAll(".recent-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      searchInput.value = chip.dataset.name || "";
      searchInput.focus();
    });
  });
}

// ── Suggestions ───────────────────────────────────────────────
function closeSuggestions() {
  suggestionsEl.classList.add("hidden");
  suggestionsEl.innerHTML = "";
  suggestionItems = [];
  activeSugIdx = -1;
}

function setActiveSug(i) {
  activeSugIdx = i;
  suggestionItems.forEach((el, idx) => {
    const active = idx === i;
    el.classList.toggle("active", active);
    el.setAttribute("aria-selected", active ? "true" : "false");
    if (active) safeScrollIntoView(el);
  });
}

function showSuggestions(items, q = "") {
  if (!items.length) { closeSuggestions(); return; }
  suggestionsEl.classList.remove("hidden");

  suggestionsEl.innerHTML = items.map(c => {
    const [label, cls] = factionBadge(c.affiliation, c.name);
    const meta = [c.affiliation, c.origin].filter(Boolean).join(" · ");
    return `
      <div class="sug-item" role="option" aria-selected="false" data-name="${esc(c.name)}">
        <img class="sug-avatar" src="${esc(c.image || PLACEHOLDER)}" 
             onerror="this.src='${PLACEHOLDER}'" alt="${esc(c.name)}">
        <div class="sug-info">
          <div class="sug-name">${highlight(c.name, q)}</div>
          <span class="faction-badge ${cls}">${esc(label)}</span>
          <div class="sug-meta">${esc(meta)}</div>
        </div>
      </div>`;
  }).join("");

  suggestionItems = Array.from(suggestionsEl.querySelectorAll(".sug-item"));
  setActiveSug(-1);

  suggestionItems.forEach((el, i) => {
    el.addEventListener("mouseenter", () => setActiveSug(i));
    el.addEventListener("click", () => selectSug(i));
    el.addEventListener("touchend", e => { e.preventDefault(); selectSug(i); });
  });
}

function updateSuggestions(q) {
  if (duelAwaitingReady) { closeSuggestions(); return; }
  const query = (q || "").trim();
  if (!query) { closeSuggestions(); return; }

  // Use fuzzy search index for smart matching
  const results = getCharMatches(query, { limit: 8, minScore: MIN_SCORE });
  const matches = results.map(r => r.character);

  showSuggestions(matches, query);
}

function selectSug(i) {
  if (i < 0 || i >= suggestionItems.length) return;
  searchInput.value = suggestionItems[i].dataset.name || "";
  closeSuggestions();
  submitGuess();
}

// ── Board rendering ───────────────────────────────────────────
function makeAvatarTile(src, name, result) {
  const d = document.createElement("div");
  d.className = `tile tile-avatar tile-${result}`;
  const img = document.createElement("img");
  img.src = src || PLACEHOLDER;
  img.alt = name || "";
  img.onerror = () => { img.src = PLACEHOLDER; };
  img.addEventListener("click", () => openLightbox(img.src));
  d.appendChild(img);
  // Name label overlaid at the bottom of the avatar
  const label = document.createElement("div");
  label.className = "avatar-name";
  label.textContent = name || "";
  d.appendChild(label);
  return d;
}

function makeTile(text, result, arrow = "") {
  const d = document.createElement("div");
  d.className = `tile tile-${result}`;
  if (arrow) {
    const ar = document.createElement("div");
    ar.className = "tile-arrow";
    ar.textContent = arrow;
    d.appendChild(ar);
  }
  const span = document.createElement("span");
  span.className = "tile-text";
  span.textContent = text || "—";
  d.appendChild(span);
  return d;
}

function makeHiddenTile() {
  const d = document.createElement("div");
  d.className = "tile tile-hidden";
  const span = document.createElement("span");
  span.className = "tile-text";
  span.textContent = "?";
  span.style.opacity = "0.4";
  d.appendChild(span);
  return d;
}

function renderRow(guess, opts = {}) {
  const { playerIdx = null, suppressEnd = false } = opts;

  const row = document.createElement("div");
  row.className = "game-row";
  row.dataset.num = String(attempts);
  if (playerIdx !== null) row.dataset.player = PLAYERS[playerIdx];

  const results = {
    name:        norm(guess.name) === norm(answer.name) ? "hit" : "miss",
    affiliation: compareExact(answer.affiliation, guess.affiliation),
    devilFruit:  compareExact(answer.devilFruit, guess.devilFruit),
    haki:        compareHaki(answer.haki, guess.haki),
    origin:      compareExact(answer.origin, guess.origin),
    bounty:      compareBounty(answer.bounty, guess.bounty),
    firstArc:    compareExact(answer.firstArc, guess.firstArc),
    gender:      compareExact(answer.gender, guess.gender),
  };

  const hidden = new Set(hiddenCols);

  // Avatar with name overlay
  row.appendChild(makeAvatarTile(guess.image, guess.name, results.name));

  // Remaining fields
  const fields = [
    { key: "affiliation", text: guess.affiliation,                        result: results.affiliation },
    { key: "devilFruit",  text: guess.devilFruit,                         result: results.devilFruit },
    { key: "haki",        text: formatHaki(guess.haki),                  result: results.haki },
    { key: "origin",      text: guess.origin,                             result: results.origin },
    { key: "bounty",      text: formatBounty(guess.bounty),               result: results.bounty,
      arrow: bountyArrow(answer.bounty, guess.bounty), extra: "tile-bounty" },
    { key: "firstArc",    text: guess.firstArc,                           result: results.firstArc,
      arrow: arcArrow(answer.firstArc, guess.firstArc) },
    { key: "gender",      text: guess.gender,                             result: results.gender },
  ];

  fields.forEach((f, i) => {
    let tile;
    if (hidden.has(f.key)) {
      tile = makeHiddenTile();
    } else {
      tile = makeTile(f.text, f.result, f.arrow || "");
      if (f.extra) tile.classList.add(f.extra);
    }
    // stagger animation
    tile.style.animationDelay = `${(i + 1) * 55}ms`;
    row.appendChild(tile);
  });

  // Stagger animation: avatar at 0, data tiles follow
  row.children[0].style.animationDelay = "0ms";
  fields.forEach((_, i) => {
    if (row.children[i + 1]) row.children[i + 1].style.animationDelay = `${(i + 1) * 55}ms`;
  });

  boardRows.prepend(row);
  emptyState.style.display = "none";

  updateChips();

  const matched = results.name === "hit";

  // Announce result for screen readers
  if (!opts.suppressAnnouncement) {
    const resultColors = {
      name: results.name === "hit" ? "green" : "red",
      affiliation: results.affiliation === "hit" ? "green" : "red",
      devilFruit: results.devilFruit === "hit" ? "green" : "red",
      haki: results.haki === "hit" ? "green" : results.haki === "close" ? "yellow" : "red",
      origin: results.origin === "hit" ? "green" : "red",
      bounty: results.bounty === "hit" ? "green" : results.bounty === "close" ? "yellow" : "red",
      firstArc: results.firstArc === "hit" ? "green" : "red",
      gender: results.gender === "hit" ? "green" : "red",
    };
    const exact   = Object.values(resultColors).filter(v => v === "green").length;
    const partial = Object.values(resultColors).filter(v => v === "yellow").length;
    const missed  = Object.values(resultColors).filter(v => v === "red").length;
    const lead = opts.playerIdx !== null ? `${PLAYERS[opts.playerIdx]} guessed ${guess.name}. ` : `${guess.name}. `;
    announceLive(srAnnouncer, `${lead}${exact} exact, ${partial} partial, ${missed} missed fields.`);
  }

  if (suppressEnd) return matched;

  if (matched) {
    handleWin();
  } else {
    setStatus("Keep searching the seas…", "info");
    persistGameState();
  }

  return matched;
}

// ── Win / loss ────────────────────────────────────────────────
function handleWin() {
  solved = true;
  launchConfetti();
  boardContainer.classList.add("victory");
  setTimeout(() => boardContainer.classList.remove("victory"), 1500);
  setStatus(`You found ${answer.name}! ✓`, "success");
  searchInput.disabled = true;
  searchInput.value = "";
  recordResult(true);
  showRecap(true);

  if (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0) {
    newBtn.focus();
  }
}

function handleLoss(msg) {
  solved = true;
  searchInput.disabled = true;
  searchInput.value = "";
  setStatus(msg, "error");
  recordResult(false);
  showRecap(false);
}

// ── Duel privacy ──────────────────────────────────────────────
function updateDuelPrivacy() {
  if (!boardRows) return;
  Array.from(boardRows.children).forEach(row => {
    if (!row.dataset) return;
    if (!solved) {
      const owner = row.dataset.player || "";
      const shouldHide = duelAwaitingReady
        ? !!owner
        : (owner && owner !== PLAYERS[duelTurn]);
      row.classList.toggle("duel-hidden", shouldHide);
    } else {
      row.classList.remove("duel-hidden");
    }
  });
}

function showDuelGate() {
  if (!mode === "duel" || solved) return;
  clearTimeout(duelHandoffTimer);
  duelHandoffTimer = null;
  duelAwaitingReady = true;
  searchInput.value = "";
  searchInput.disabled = true;
  closeSuggestions();
  updateDuelPrivacy();
  duelGateTitle.textContent = `${PLAYERS[duelTurn]} Ready?`;
  duelGateMsg.textContent = "Pass the device to continue.";
  duelGate.classList.remove("hidden");
  setStatus(`Pass device to ${PLAYERS[duelTurn]}.`, "info");
}

function hideDuelGate() {
  duelAwaitingReady = false;
  clearTimeout(duelHandoffTimer);
  duelHandoffTimer = null;
  duelGate.classList.add("hidden");
}

function startDuelTurn() {
  hideDuelGate();
  if (solved) return;
  searchInput.disabled = false;
  updateDuelPrivacy();
  setStatus(`${PLAYERS[duelTurn]}'s turn — guess the character!`, "info");
  if (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0) {
    searchInput.focus();
  }
}

// ── Guess submission ──────────────────────────────────────────
function submitGuess() {
  if (solved || duelAwaitingReady) return;

  const raw = searchInput.value.trim();
  if (!raw) { setStatus("Type a character name first.", "error"); return; }

  const normalized = norm(raw);

  // Dupe check
  if (mode === "duel") {
    if (duelGuessed[duelTurn].has(normalized)) {
      setStatus("You already guessed that character.", "error"); return;
    }
  } else {
    if (guessedSet.has(normalized)) {
      setStatus("You already guessed that character.", "error"); return;
    }
  }

  // Find character
  const guess = findCharByName(raw);
  if (!guess) {
    setStatus("Character not found — pick from the list.", "error"); return;
  }

  // Register guess
  if (mode === "duel") {
    duelGuessed[duelTurn].add(normalized);
  } else {
    guessedSet.add(normalized);
    recentNames = [guess.name, ...recentNames.filter(n => norm(n) !== normalized)].slice(0, 6);
    renderRecent();
  }

  // Track guess history for session restore
  guessHistory.push({ name: guess.name, playerIndex: mode === "duel" ? duelTurn : null });

  // Duel flow
  if (mode === "duel") {
    const player = duelTurn;
    duelAttempts[player]++;
    attempts++;
    const matched = renderRow(guess, { playerIdx: player, suppressEnd: true });

    if (matched) {
      solved = true;
      duelOutcome = `${PLAYERS[player]} Wins! ⚔`;
      launchConfetti();
      boardContainer.classList.add("victory");
      setTimeout(() => boardContainer.classList.remove("victory"), 1500);
      setStatus(`${PLAYERS[player]} found ${answer.name}!`, "success");
      recordResult(true);
      showRecap(true);
      hideDuelGate();
      updateDuelPrivacy();
      closeSuggestions();
      searchInput.value = "";
      searchInput.disabled = true;
      return;
    }

    const p1Out = duelAttempts[0] >= DUEL_LIMIT;
    const p2Out = duelAttempts[1] >= DUEL_LIMIT;
    if (p1Out && p2Out) {
      solved = true;
      duelOutcome = "Draw — Neither Found It";
      attempts = DUEL_LIMIT * 2;
      setStatus(`Nobody found it. The answer was ${answer.name}.`, "error");
      recordResult(false);
      showRecap(false);
      hideDuelGate();
      updateDuelPrivacy();
      closeSuggestions();
      searchInput.value = "";
      searchInput.disabled = true;
      return;
    }

    const other = player === 0 ? 1 : 0;
    const next = duelAttempts[other] < DUEL_LIMIT ? other : player;
    const switching = next !== player;
    duelTurn = next;
    updateChips();
    searchInput.value = "";
    searchInput.disabled = true;
    closeSuggestions();

    if (switching) {
      setStatus(`${PLAYERS[player]} locked in. Pass the device…`, "info");
      duelHandoffTimer = setTimeout(() => {
        duelHandoffTimer = null;
        if (!solved) showDuelGate();
      }, 900);
    } else {
      startDuelTurn();
    }
    return;
  }

  // Normal flow
  attempts++;
  renderRow(guess);

  if (!solved && (mode === "hard" || mode === "extreme") && attempts >= HARD_LIMIT) {
    handleLoss(`Out of guesses! The answer was ${answer.name}.`);
    closeSuggestions();
    return;
  }

  searchInput.value = "";
  closeSuggestions();

  if (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0) {
    searchInput.focus();
  }
}

// ── New game ──────────────────────────────────────────────────
function newGame() {
  attempts   = 0;
  solved     = false;
  guessedSet = new Set();
  recentNames = [];
  guessHistory = [];
  duelTurn          = 0;
  duelAttempts      = [0, 0];
  duelGuessed       = [new Set(), new Set()];
  duelOutcome       = "";
  duelAwaitingReady = false;
  clearTimeout(duelHandoffTimer);
  duelHandoffTimer  = null;

  if (mode === "mystery" || mode === "extreme") {
    hiddenCols = pickHiddenCols();
  } else {
    hiddenCols = [];
  }

  updateHeaderHidden();
  hideRecap();
  setStatus("", "info");
  boardRows.innerHTML = "";
  emptyState.style.display = "";
  searchInput.value = "";
  searchInput.disabled = false;
  closeSuggestions();
  renderRecent();
  hideDuelGate();
  progressBar.classList.add("hidden");

  if (confettiTimer) { clearTimeout(confettiTimer); confettiTimer = null; }
  boardContainer.classList.remove("victory");

  // Pick answer
  if (!CHARS.length) return;
  if (mode === "daily") {
    answer = CHARS[hashStr(dateKey()) % CHARS.length];
  } else {
    answer = CHARS[Math.floor(Math.random() * CHARS.length)];
  }

  updateChips();

  if (mode === "duel") {
    showDuelGate();
  } else {
    if (!navigator.maxTouchPoints || navigator.maxTouchPoints === 0) {
      searchInput.focus();
    }
  }
}

// ── Mode switching ────────────────────────────────────────────
function setMode(m) {
  const valid = ["casual","hard","extreme","daily","mystery","duel"];
  mode = valid.includes(m) ? m : "casual";
  try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}

  modeGrid.querySelectorAll(".mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  newBtn.style.display = mode === "daily" ? "none" : "";
  newGame();
}

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(src) {
  if (!src) return;
  lightboxImg.src = src;
  lightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxImg.src = "";
  document.body.style.overflow = "";
}

// ── Panel helpers ─────────────────────────────────────────────
function openPanel(panel) {
  panel.classList.remove("hidden");
  panel.classList.add("open");
  overlay.classList.remove("hidden");
}

function closePanel(panel) {
  panel.classList.remove("open");
  overlay.classList.add("hidden");
  setTimeout(() => panel.classList.add("hidden"), 290);
}

// ── Event listeners ────────────────────────────────────────────
searchInput.addEventListener("input", e => {
  updateSuggestions(e.target.value);
});

searchInput.addEventListener("focus", () => {
  document.body.classList.add("keyboard-open");
});

searchInput.addEventListener("blur", () => {
  document.body.classList.remove("keyboard-open");
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" && suggestionItems.length) {
    e.preventDefault();
    setActiveSug((activeSugIdx + 1) % suggestionItems.length);
    return;
  }
  if (e.key === "ArrowUp" && suggestionItems.length) {
    e.preventDefault();
    setActiveSug(activeSugIdx > 0 ? activeSugIdx - 1 : suggestionItems.length - 1);
    return;
  }
  if (e.key === "Escape") { closeSuggestions(); closeLightbox(); return; }
  if (e.key === "Enter") {
    e.preventDefault();
    if (activeSugIdx >= 0) { selectSug(activeSugIdx); return; }
    submitGuess();
  }
});

document.addEventListener("click", e => {
  if (!e.target.closest(".search-zone")) closeSuggestions();
  if (e.target === lightbox) closeLightbox();
  if (e.target === overlay) {
    closePanel(settingsPanel);
    closePanel(helpPanel);
  }
});

document.addEventListener("keydown", e => {
  // Tab focus trapping for open modals
  const trap = getOpenTrapContainer();
  if (trap && trapFocus(trap, e)) return;

  if (e.key === "Escape") {
    closeLightbox();
    closePanel(settingsPanel);
    closePanel(helpPanel);
  }
  if ((e.key === "n" || e.key === "N") && !solved) return;
  if ((e.key === "n" || e.key === "N") && solved) {
    const active = document.activeElement;
    const typing = active && ["INPUT","TEXTAREA","SELECT"].includes(active.tagName);
    if (!typing && mode !== "daily") newGame();
  }
});

newBtn.addEventListener("click", newGame);

lightboxClose.addEventListener("click", closeLightbox);
duelReadyBtn.addEventListener("click", startDuelTurn);

$("menuBtn").addEventListener("click", () => {
  if (settingsPanel.classList.contains("open")) closePanel(settingsPanel);
  else openPanel(settingsPanel);
});

$("helpBtn").addEventListener("click", () => {
  if (helpPanel.classList.contains("open")) closePanel(helpPanel);
  else openPanel(helpPanel);
});

$("settingsClose").addEventListener("click", () => closePanel(settingsPanel));
$("helpClose").addEventListener("click",     () => closePanel(helpPanel));

modeGrid.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    setMode(btn.dataset.mode);
    closePanel(settingsPanel);
  });
});

compactToggle.addEventListener("change", () => {
  document.body.classList.toggle("compact", compactToggle.checked);
  try { localStorage.setItem(COMPACT_KEY, compactToggle.checked ? "1" : "0"); } catch (e) {}
});

// ── Background image ─────────────────────────────────────────
// ── Viewport height fix (iOS) ─────────────────────────────────
(function syncVh() {
  const set = () => document.documentElement.style.setProperty("--app-vh", window.innerHeight + "px");
  set();
  window.addEventListener("resize", set, { passive: true });
  window.addEventListener("orientationchange", set, { passive: true });
})();

// ── Game state persistence ────────────────────────────────────
function persistGameState() {
  if (!answer || solved) { clearGameState(); return; }
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify({
      version: 1, mode,
      answerName: answer.name,
      attempts, hiddenCols, recentNames, guessHistory,
      duelTurn, duelAttempts, duelOutcome, duelAwaitingReady,
      dailyDateKey: mode === "daily" ? dateKey() : null
    }));
  } catch (e) {}
}

function clearGameState() {
  try { localStorage.removeItem(GAME_STATE_KEY); } catch (e) {}
}

function restoreGameState() {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || !saved.answerName) { clearGameState(); return false; }
    if (saved.mode === "daily" && saved.dailyDateKey !== dateKey()) { clearGameState(); return false; }

    const savedAnswer = CHARS.find(c => norm(c.name) === norm(saved.answerName));
    if (!savedAnswer) { clearGameState(); return false; }

    // Restore mode silently
    if (saved.mode && saved.mode !== mode) {
      mode = saved.mode;
      modeGrid.querySelectorAll(".mode-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
      newBtn.style.display = mode === "daily" ? "none" : "";
    }

    answer      = savedAnswer;
    hiddenCols  = Array.isArray(saved.hiddenCols) ? saved.hiddenCols : [];
    guessHistory = Array.isArray(saved.guessHistory) ? saved.guessHistory : [];
    recentNames  = Array.isArray(saved.recentNames) ? saved.recentNames : [];
    duelTurn     = Number.isInteger(saved.duelTurn) ? saved.duelTurn : 0;
    duelAttempts = Array.isArray(saved.duelAttempts) ? saved.duelAttempts : [0, 0];
    duelOutcome  = typeof saved.duelOutcome === "string" ? saved.duelOutcome : "";
    duelAwaitingReady = !!saved.duelAwaitingReady;
    attempts     = 0; solved = false;
    guessedSet   = new Set();
    duelGuessed  = [new Set(), new Set()];

    updateHeaderHidden();
    boardRows.innerHTML = "";
    hideRecap();
    closeSuggestions();
    searchInput.value = "";
    searchInput.disabled = false;

    // Re-render all historical rows silently
    guessHistory.forEach((entry, i) => {
      const g = CHARS.find(c => norm(c.name) === norm(entry.name));
      if (!g) return;
      attempts = i + 1;
      if (mode === "duel" && Number.isInteger(entry.playerIndex)) {
        duelGuessed[entry.playerIndex].add(norm(g.name));
      } else {
        guessedSet.add(norm(g.name));
      }
      renderRow(g, {
        playerIdx: Number.isInteger(entry.playerIndex) ? entry.playerIndex : null,
        suppressEnd: true,
        suppressAnnouncement: true
      });
    });

    attempts = Number.isInteger(saved.attempts) ? saved.attempts : guessHistory.length;
    renderRecent();
    updateChips();

    if (mode === "duel") {
      if (duelAwaitingReady) showDuelGate();
      else startDuelTurn();
    } else {
      updateDuelPrivacy();
    }

    return true;
  } catch (e) { clearGameState(); return false; }
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  searchInput.disabled = true;
  searchInput.placeholder = "Loading crew manifest…";

  // Restore settings
  try {
    const savedMode = localStorage.getItem(MODE_KEY) || "casual";
    const savedCompact = localStorage.getItem(COMPACT_KEY) === "1";
    mode = ["casual","hard","extreme","daily","mystery","duel"].includes(savedMode) ? savedMode : "casual";
    modeGrid.querySelectorAll(".mode-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    compactToggle.checked = savedCompact;
    document.body.classList.toggle("compact", savedCompact);
    newBtn.style.display = mode === "daily" ? "none" : "";
  } catch (e) {}

  try {
    const res = await fetch("characters.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    CHARS = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (!Array.isArray(CHARS) || !CHARS.length) throw new Error("Empty character list");

    buildSearchIndex();
    searchInput.placeholder = "Search a character…";
    searchInput.disabled = false;

    renderStatsDash();

    // Try to restore in-progress game, otherwise start fresh
    if (!restoreGameState()) {
      newGame();
    }
  } catch (err) {
    searchInput.placeholder = "Failed to load — check console";
    setStatus(`Could not load characters.json: ${err.message}`, "error");
  }
}

init();
