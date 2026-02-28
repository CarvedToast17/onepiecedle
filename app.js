let CHARACTERS = [];
let answer = null;

let attempts = 0;
let isSolved = false;

const stats = document.getElementById("stats");
const submitBtn = document.getElementById("submitBtn");
const rows = document.getElementById("rows");
const msg = document.getElementById("msg");
const guessInput = document.getElementById("guessInput");
const newBtn = document.getElementById("newBtn");
const controlsEl = document.querySelector(".controls");
const suggestionsEl = document.getElementById("suggestions");
const boardWrap = document.querySelector(".boardWrap");
const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
const modePresetEl = document.getElementById("modePreset");
const compactModeEl = document.getElementById("compactMode");
const progressPillEl = document.getElementById("progressPill");
const recentGuessesEl = document.getElementById("recentGuesses");
const statsDashboardEl = document.getElementById("statsDashboard");
const recapCardEl = document.getElementById("recapCard");
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalClose = document.getElementById("imageModalClose");

let guessedNames = new Set();
let suggestionItems = [];
let activeSuggestionIndex = -1;
let victoryFxTimer = null;
let recentGuessNames = [];
let isHardMode = false;
let isDailyMode = false;
let isMysteryTilesMode = false;
let isDuelMode = false;
let activeModePreset = "casual";
let playerStats = null;
let hiddenFieldKeys = [];
let duelCurrentTurn = 0;
let duelAttempts = [0, 0];
let duelOutcomeText = "";

const HARD_GUESS_LIMIT = 5;
const PLAYER_STATS_KEY = "op_player_stats_v1";
const MODE_PRESET_KEY = "op_mode_preset";
const PLACEHOLDER_IMAGE = "img/placeholder.png";
const MYSTERY_FIELD_POOL = ["affiliation", "haki", "firstArc", "gender"];
const DUEL_GUESS_LIMIT = 6;
const DUEL_PLAYERS = ["Player 1", "Player 2"];

playerStats = loadPlayerStats();




function normalize(str) {
  return (str || "").trim().toLowerCase();
}

function getModeLabel(modeKey = activeModePreset) {
  switch (modeKey) {
    case "hard": return "Hard";
    case "daily": return "Daily";
    case "mystery_tiles": return "Mystery Tiles";
    case "duel_1v1": return "1v1 Duel";
    default: return "Casual";
  }
}

function pickHiddenFields(count = 2) {
  const pool = [...MYSTERY_FIELD_POOL];
  const picked = [];
  while (pool.length && picked.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

function updateHiddenHeaders() {
  const header = document.querySelector(".headerRow");
  if (!header) return;
  const cells = Array.from(header.children);
  const mapping = {
    affiliation: { index: 2, label: "Affiliation" },
    haki: { index: 4, label: "Haki" },
    firstArc: { index: 7, label: "First Arc" },
    gender: { index: 8, label: "Gender" }
  };

  Object.values(mapping).forEach(({ index, label }) => {
    if (!cells[index]) return;
    cells[index].textContent = label;
    cells[index].classList.remove("hiddenHeader");
  });

  hiddenFieldKeys.forEach((key) => {
    const cfg = mapping[key];
    if (!cfg || !cells[cfg.index]) return;
    cells[cfg.index].textContent = "Hidden";
    cells[cfg.index].classList.add("hiddenHeader");
  });
}

function getLocalDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function createDefaultStats() {
  return {
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalAttempts: 0,
    bestAttempts: null,
    byMode: {}
  };
}

function getModeStats(modeKey = activeModePreset) {
  if (!playerStats.byMode[modeKey]) {
    playerStats.byMode[modeKey] = {
      gamesPlayed: 0,
      wins: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalAttempts: 0,
      bestAttempts: null
    };
  }
  return playerStats.byMode[modeKey];
}

function loadPlayerStats() {
  try {
    const raw = localStorage.getItem(PLAYER_STATS_KEY);
    if (!raw) return createDefaultStats();
    const parsed = JSON.parse(raw);
    return { ...createDefaultStats(), ...parsed, byMode: parsed.byMode || {} };
  } catch {
    return createDefaultStats();
  }
}

function savePlayerStats() {
  localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify(playerStats));
}

function renderStatsDashboard() {
  if (!statsDashboardEl || !playerStats) return;
  const modeStats = getModeStats();
  const winRate = playerStats.gamesPlayed ? Math.round((playerStats.wins / playerStats.gamesPlayed) * 100) : 0;
  const modeWinRate = modeStats.gamesPlayed ? Math.round((modeStats.wins / modeStats.gamesPlayed) * 100) : 0;

  statsDashboardEl.innerHTML = [
    { label: "Games", value: playerStats.gamesPlayed },
    { label: "Win Rate", value: `${winRate}%` },
    { label: "Streak", value: playerStats.currentStreak },
    { label: `${getModeLabel()} WR`, value: `${modeWinRate}%` },
    { label: "Best Guess", value: modeStats.bestAttempts ?? "--" }
  ].map((x) => `
    <div class="statTile">
      <div class="statLabel">${x.label}</div>
      <div class="statValue">${x.value}</div>
    </div>
  `).join("");
}

function recordGameResult(didWin) {
  playerStats.gamesPlayed += 1;
  if (didWin) playerStats.wins += 1;
  playerStats.totalAttempts += attempts;
  if (didWin) {
    playerStats.bestAttempts = playerStats.bestAttempts === null ? attempts : Math.min(playerStats.bestAttempts, attempts);
  }

  if (didWin) {
    playerStats.currentStreak += 1;
    playerStats.bestStreak = Math.max(playerStats.bestStreak, playerStats.currentStreak);
  } else {
    playerStats.currentStreak = 0;
  }

  const modeStats = getModeStats();
  modeStats.gamesPlayed += 1;
  if (didWin) modeStats.wins += 1;
  modeStats.totalAttempts += attempts;
  if (didWin) {
    modeStats.currentStreak += 1;
    modeStats.bestStreak = Math.max(modeStats.bestStreak, modeStats.currentStreak);
    modeStats.bestAttempts = modeStats.bestAttempts === null ? attempts : Math.min(modeStats.bestAttempts, attempts);
  } else {
    modeStats.currentStreak = 0;
  }

  savePlayerStats();
  renderStatsDashboard();
}

function getVisibleImageSrc(rawSrc) {
  return rawSrc && String(rawSrc).trim() ? rawSrc : PLACEHOLDER_IMAGE;
}

function renderRecap(didWin) {
  if (!recapCardEl || !answer) return;
  const modeLabel = getModeLabel();
  const dateSuffix = isDailyMode ? ` | ${getLocalDateKey()}` : "";
  const recapTitle = isDuelMode
    ? (duelOutcomeText || "Duel Complete")
    : (didWin ? "Round Complete" : "Round Failed");
  const recapSub = isDuelMode
    ? `P1: ${duelAttempts[0]}/${DUEL_GUESS_LIMIT} • P2: ${duelAttempts[1]}/${DUEL_GUESS_LIMIT}`
    : (didWin
    ? `Solved in ${attempts} guess${attempts === 1 ? "" : "es"}`
    : `Answer was ${answer.name} after ${attempts} guesses`);

  recapCardEl.classList.remove("hidden");
  const replayMarkup = isDailyMode ? "" : `<button id="recapPlayAgain" class="recapBtn secondary" type="button">Play Again</button>`;

  recapCardEl.innerHTML = `
    <div class="recapTitle">${recapTitle} | ${modeLabel}${dateSuffix}</div>
    <div class="recapBody">
      <img class="recapImage" src="${escapeHtml(getVisibleImageSrc(answer.image))}" data-fallback="${PLACEHOLDER_IMAGE}" alt="${escapeHtml(answer.name)}">
      <div class="recapMeta">
        <div class="recapName">${escapeHtml(answer.name)}</div>
        <div class="recapSub">${escapeHtml(recapSub)}</div>
      </div>
      ${replayMarkup}
    </div>
  `;

  attachImageFallback(recapCardEl);
  const recapBtn = document.getElementById("recapPlayAgain");
  if (recapBtn) {
    recapBtn.addEventListener("click", () => startNewGame());
  }
}

function hideRecap() {
  if (!recapCardEl) return;
  recapCardEl.classList.add("hidden");
  recapCardEl.innerHTML = "";
}

function applyModePreset(modeKey, restart = true) {
  const safeMode = ["casual", "hard", "daily", "mystery_tiles", "duel_1v1"].includes(modeKey) ? modeKey : "casual";
  activeModePreset = safeMode;
  isHardMode = safeMode === "hard";
  isDailyMode = safeMode === "daily";
  isMysteryTilesMode = safeMode === "mystery_tiles";
  isDuelMode = safeMode === "duel_1v1";
  if (isDuelMode) {
    duelAttempts = [0, 0];
    duelCurrentTurn = 0;
    duelOutcomeText = "";
  }
  hiddenFieldKeys = isMysteryTilesMode ? pickHiddenFields(2) : [];

  localStorage.setItem(MODE_PRESET_KEY, safeMode);
  if (modePresetEl) modePresetEl.value = safeMode;
  if (newBtn) {
    newBtn.classList.toggle("hidden", isDailyMode);
  }
  if (controlsEl) {
    controlsEl.classList.toggle("dailyOnly", isDailyMode);
  }
  updateHiddenHeaders();

  updateStats();
  renderStatsDashboard();
  if (restart) startNewGame();
}

function pickAnswerByCurrentMode() {
  if (!CHARACTERS.length) return null;
  if (isDailyMode) {
    const idx = hashString(getLocalDateKey()) % CHARACTERS.length;
    return CHARACTERS[idx];
  }
  return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
}

function setStatus(text, tone = "info") {
  const prefix = tone === "success" ? "\u2705 " : tone === "error" ? "\u274c " : "\u2139\ufe0f ";
  msg.textContent = text ? `${prefix}${text}` : "";
  msg.classList.remove("status-info", "status-error", "status-success");
  if (!text) return;
  msg.classList.add(`status-${tone}`);
}

function updateStats() {
  const best = localStorage.getItem("op_best");
  if (isDuelMode) {
    stats.textContent = `Mode: ${getModeLabel()} \u2022 P1: ${duelAttempts[0]}/${DUEL_GUESS_LIMIT} \u2022 P2: ${duelAttempts[1]}/${DUEL_GUESS_LIMIT}`;
  } else {
    stats.textContent = `Mode: ${getModeLabel()} \u2022 Attempts: ${attempts} \u2022 Best: ${best ? best : "\u2014"}`;
  }
  if (boardWrap) {
    boardWrap.classList.toggle("hardMode", isHardMode);
  }
  if (progressPillEl) {
    if (isDuelMode) {
      const left = Math.max(DUEL_GUESS_LIMIT - duelAttempts[duelCurrentTurn], 0);
      progressPillEl.textContent = `${DUEL_PLAYERS[duelCurrentTurn]} turn \u2022 ${left} left`;
    } else if (isHardMode) {
      const remaining = Math.max(HARD_GUESS_LIMIT - attempts, 0);
      progressPillEl.textContent = `Guess ${Math.min(attempts + 1, HARD_GUESS_LIMIT)} / ${HARD_GUESS_LIMIT} \u2022 ${remaining} left`;
    } else if (isDailyMode) {
      progressPillEl.textContent = `Daily ${getLocalDateKey()} \u2022 Guess ${attempts + 1}`;
    } else {
      progressPillEl.textContent = `Guess ${attempts + 1}`;
    }
  }
}

function setSubmitState() {
  const hasInput = guessInput.value.trim().length > 0;
  if (submitBtn) {
    submitBtn.disabled = isSolved || !hasInput;
  }
}

function closeSuggestions() {
  suggestionsEl.classList.add("hidden");
  suggestionsEl.innerHTML = "";
  suggestionItems = [];
  activeSuggestionIndex = -1;
}

function renderRecentGuesses() {
  if (!recentGuessesEl) return;

  if (!recentGuessNames.length) {
    recentGuessesEl.classList.add("hidden");
    recentGuessesEl.innerHTML = "";
    return;
  }

  recentGuessesEl.classList.remove("hidden");
  recentGuessesEl.innerHTML = `<span class="recentLabel">Recent</span>${recentGuessNames
    .map((name) => `<button class="recentChip" type="button" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
    .join("")}`;

  recentGuessesEl.querySelectorAll(".recentChip").forEach((chip) => {
    chip.addEventListener("click", () => {
      guessInput.value = chip.dataset.name || "";
      setSubmitState();
      guessInput.focus();
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text, query) {
  const safeText = escapeHtml(text ?? "");
  const q = (query || "").trim();
  if (!q) return safeText;

  const escaped = escapeRegExp(q);
  const pattern = new RegExp(`(${escaped})`, "ig");
  return safeText.replace(pattern, "<mark>$1</mark>");
}

function getFactionTag(affiliation) {
  const a = normalize(affiliation);
  if (!a) return { label: "Unknown", className: "faction-unknown" };
  if (a.includes("marine")) return { label: "Marines", className: "faction-marines" };
  if (a.includes("straw hat")) return { label: "Straw Hat", className: "faction-strawhat" };
  if (a.includes("cross guild") || a.includes("warlord")) return { label: "Warlord", className: "faction-warlord" };
  if (a.includes("yonko") || a.includes("beasts pirates") || a.includes("big mom pirates") || a.includes("red hair pirates") || a.includes("blackbeard pirates") || a.includes("whitebeard pirates")) {
    return { label: "Yonko", className: "faction-yonko" };
  }
  if (a.includes("revolutionary")) return { label: "Revolutionary", className: "faction-revo" };
  if (a.includes("kozuki") || a.includes("akazaya") || a.includes("samurai")) return { label: "Wano", className: "faction-wano" };
  return { label: "Pirate", className: "faction-pirate" };
}

function attachImageFallback(root = document) {
  root.querySelectorAll("img[data-fallback]").forEach((img) => {
    if (img.dataset.fallbackBound === "1") return;
    img.dataset.fallbackBound = "1";

    img.addEventListener("error", () => {
      const fallback = img.dataset.fallback || "img/placeholder.png";
      if (img.getAttribute("src") !== fallback) {
        img.setAttribute("src", fallback);
      } else {
        img.classList.add("is-fallback");
      }
    });

    img.addEventListener("load", () => {
      const fallback = img.dataset.fallback || "img/placeholder.png";
      if (img.getAttribute("src") === fallback) {
        img.classList.add("is-fallback");
      } else {
        img.classList.remove("is-fallback");
      }
    });
  });
}

function launchConfetti() {
  const duration = 2200;
  const end = Date.now() + duration;

  confetti({
    particleCount: 160,
    spread: 95,
    startVelocity: 48,
    ticks: 260,
    origin: { x: 0.5, y: 0.58 }
  });

  (function frame() {
    confetti({
      particleCount: 8,
      spread: 80,
      startVelocity: 42,
      origin: { x: 0.1, y: 0.65 },
      angle: 58
    });

    confetti({
      particleCount: 8,
      spread: 80,
      startVelocity: 42,
      origin: { x: 0.9, y: 0.65 },
      angle: 122
    });

    if (Date.now() % 3 === 0) {
      confetti({
        particleCount: 6,
        spread: 120,
        startVelocity: 34,
        origin: { x: Math.random(), y: 0.35 + Math.random() * 0.3 }
      });
    }

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}


function pickRandomAnswer() {
  if (isDuelMode) {
    duelAttempts = [0, 0];
    duelCurrentTurn = 0;
    duelOutcomeText = "";
  }
  if (isMysteryTilesMode) {
    hiddenFieldKeys = pickHiddenFields(2);
  }
  updateHiddenHeaders();
  answer = pickAnswerByCurrentMode();
  rows.innerHTML = "";
  setStatus("");
  hideRecap();
  guessInput.value = "";
  guessInput.focus();

  attempts = 0;
  isSolved = false;
  guessedNames = new Set();
  recentGuessNames = [];
  if (victoryFxTimer) {
    clearTimeout(victoryFxTimer);
    victoryFxTimer = null;
  }
  if (boardWrap) {
    boardWrap.classList.remove("victory-glow");
  }

  guessInput.disabled = false;
  setSubmitState();
  closeSuggestions();
  renderRecentGuesses();

  updateStats();
  if (isDuelMode) {
    setStatus(`${DUEL_PLAYERS[duelCurrentTurn]}'s turn`, "info");
  }
}


function findCharacterByName(name) {
  const n = normalize(name);
  return CHARACTERS.find(c => normalize(c.name) === n) || null;
}

function compareExact(a, b) {
  return normalize(a) === normalize(b) ? "green" : "red";
}


function compareHaki(answerHaki, guessHaki) {
  const a = new Set((answerHaki || []).map(normalize));
  const g = new Set((guessHaki || []).map(normalize));

  // both have no haki -> exact match
  if (a.size === 0 && g.size === 0) return "green";

  // one has haki and the other doesn't -> mismatch
  if (a.size === 0 || g.size === 0) return "red";

  // count overlap
  let shared = 0;
  for (const x of g) if (a.has(x)) shared++;

  // exact same set -> green
  if (shared === a.size && shared === g.size) return "green";

  // some overlap -> yellow
  if (shared > 0) return "yellow";

  // no overlap -> red
  return "red";
}

function compareBounty(a, b) {
  const A = Number(a);
  const B = Number(b);

  if (!Number.isFinite(A) || !Number.isFinite(B)) return "red";
  return A === B ? "green" : "red";
}


function bountyHint(answerBounty, guessBounty) {
  const a = Number(answerBounty);
  const g = Number(guessBounty);
  if (!Number.isFinite(a) || !Number.isFinite(g)) return "";
  if (g < a) return " \u2191";
  if (g > a) return " \u2193";
  return "";
}

function formatBounty(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "\u2014";
  return "\u20BF " + value.toLocaleString();
}
const ARC_ORDER = [
  "Romance Dawn","Orange Town","Syrup Village","Baratie","Arlong Park","Loguetown",
  "Reverse Mountain","Whisky Peak","Little Garden","Drum Island","Arabasta",
  "Jaya","Skypiea","Long Ring Long Land","Water 7","Enies Lobby","Post-Enies Lobby",
  "Thriller Bark","Sabaody Archipelago","Amazon Lily","Impel Down","Marineford",
  "Post-War","Return to Sabaody","Fish-Man Island","Punk Hazard","Dressrosa",
  "Zou","Whole Cake Island","Reverie","Wano Country","Egghead"
];

function normArc(s) {
  return (s || "").trim().toLowerCase();
}

// case-insensitive index lookup
function arcIndex(arc) {
  const a = normArc(arc);
  return ARC_ORDER.findIndex(x => normArc(x) === a);
}

function compareArc(answerArc, guessArc) {
  const a = (answerArc || "").trim().toLowerCase();
  const g = (guessArc || "").trim().toLowerCase();

  // if either is missing, treat as incorrect
  if (!a || !g) return "red";

  return a === g ? "green" : "red";
}



function arcHint(answerArc, guessArc) {
  const ai = arcIndex(answerArc);
  const gi = arcIndex(guessArc);

  if (ai === -1 || gi === -1) return "";

  if (gi < ai) return "\u2191";
  if (gi > ai) return "\u2193";
  return "";
}

function makeCell(value, color, arrow = "") {
  const d = document.createElement("div");
  d.className = `tile ${color || ""}`.trim();

  const safeValue = value ?? "";

  d.innerHTML = `
    <span class="cellText" title="${String(safeValue).replaceAll('"', '&quot;')}">${safeValue}</span>
    <span class="cellArrow">${arrow ?? ""}</span>
  `;

  return d;
}

function openImageModal(src) {
  if (!imageModal || !imageModalImg || !src) return;
  imageModalImg.src = src;
  imageModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeImageModal() {
  if (!imageModal || !imageModalImg) return;
  imageModal.classList.add("hidden");
  imageModalImg.src = "";
  document.body.style.overflow = "";
}



function renderRow(guess, options = {}) {
  const { playerIndex = null, suppressEndHandling = false } = options;
  const r = document.createElement("div");
  r.className = "row";
  r.dataset.attempt = String(attempts);
  if (playerIndex !== null) {
    r.dataset.player = DUEL_PLAYERS[playerIndex];
  }

  const results = {
    name: normalize(guess.name) === normalize(answer.name) ? "green" : "red",
    affiliation: compareExact(answer.affiliation, guess.affiliation),
    devilFruit: compareExact(answer.devilFruit, guess.devilFruit),
    haki: compareHaki(answer.haki, guess.haki),
    origin: compareExact(answer.origin, guess.origin),
    bounty: compareBounty(answer.bounty, guess.bounty),
    firstArc: compareArc(answer.firstArc, guess.firstArc),
    gender: compareExact(answer.gender, guess.gender)
  };
  const hiddenSet = new Set(hiddenFieldKeys);

 const cells = [
  { kind: "image", src: getVisibleImageSrc(guess.image), cls: "tile imageCell", fieldKey: "image" },
  { text: guess.name, cls: `tile ${results.name} nameCell` },
  { text: guess.affiliation, cls: `tile ${results.affiliation} affiliationCell`, fieldKey: "affiliation" },
  { text: guess.devilFruit, cls: `tile ${results.devilFruit} devilFruitCell`, fieldKey: "devilFruit" },
  { text: (guess.haki || []).join(", ") || "None", cls: `tile ${results.haki} hakiCell`, fieldKey: "haki" },
  { text: guess.origin, cls: `tile ${results.origin} originCell`, fieldKey: "origin" },

  {
  kind: "bounty",
  value: formatBounty(guess.bounty),
  arrow: bountyHint(answer.bounty, guess.bounty).trim(),
  cls: `tile ${results.bounty} bountyCell`,
  fieldKey: "bounty"
},

{
  kind: "arc",
  value: (guess.firstArc || "\u2014"),
  arrow: arcHint(answer.firstArc, guess.firstArc),
  cls: `tile ${results.firstArc} arcCell`,
  fieldKey: "firstArc"
},


  {
    text: guess.gender,
    cls: `tile ${results.gender}`,
    fieldKey: "gender"
  }
];


  cells.forEach((c, i) => {
  let d;
  const isHiddenField = hiddenSet.has(c.fieldKey);

  if (c.kind === "image") {
    d = document.createElement("div");
    d.className = c.cls;

    d.innerHTML = `
      <img class="gridAvatar" src="${c.src || PLACEHOLDER_IMAGE}" data-fallback="${PLACEHOLDER_IMAGE}" alt="">
    `;
    const img = d.querySelector(".gridAvatar");
    if (img) {
      img.addEventListener("click", () => openImageModal(img.getAttribute("src")));
    }
  }
  else if (c.kind === "bounty" || c.kind === "arc") {
    if (isHiddenField) {
      d = makeCell("Hidden", "grey", "");
      d.className = "tile grey maskedCell";
      d.removeAttribute("data-tip");
    } else {
      d = makeCell(c.value, "", c.arrow);
      d.className = c.cls;
      d.setAttribute("data-tip", c.value);
    }
  }
  else {
    d = document.createElement("div");
    d.className = isHiddenField ? "tile grey maskedCell" : c.cls;
    d.innerHTML = isHiddenField ? "Hidden" : (c.text || "-");
  }

  d.classList.add("pop");
  d.style.animationDelay = `${i * 70}ms`;

  r.appendChild(d);
});

  attachImageFallback(r);

  rows.prepend(r);

  const bestBefore = localStorage.getItem("op_best");
  updateStats();

  const matched = results.name === "green";
  if (suppressEndHandling) {
    return matched;
  }

if (matched) {
  isSolved = true;
  launchConfetti();
  if (boardWrap) {
    boardWrap.classList.add("victory-glow");
    if (victoryFxTimer) clearTimeout(victoryFxTimer);
    victoryFxTimer = setTimeout(() => {
      boardWrap.classList.remove("victory-glow");
      victoryFxTimer = null;
    }, 1500);
  }

  const best = bestBefore ? parseInt(bestBefore, 10) : null;
  if (best === null || attempts < best) {
    localStorage.setItem("op_best", String(attempts));
  }

  updateStats();

  setStatus(`You got it: ${answer.name} (in ${attempts} guesses)`, "success");
  recordGameResult(true);
  renderRecap(true);

  guessInput.value = "";
  guessInput.disabled = true;
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  newBtn.focus();
  newBtn.scrollIntoView({ behavior: "smooth", block: "center" });

} else {
  setStatus("Keep going", "info");
}

  return matched;
}

function onGuess() {
  if (isSolved) return;

  const guessName = guessInput.value.trim();
  if (!guessName) {
    setStatus("Type a character name first.", "error");
    return;
  }

  if (guessedNames.has(normalize(guessName))) {
    setStatus("You already guessed that character.", "error");
    return;
  }

  const guess = findCharacterByName(guessName);

  if (!guess) {
    setStatus("Pick a name from the list.", "error");
    return;
  }

  guessedNames.add(normalize(guess.name));
  recentGuessNames = [guess.name, ...recentGuessNames.filter((n) => normalize(n) !== normalize(guess.name))].slice(0, 6);
  renderRecentGuesses();

  if (isDuelMode) {
    const player = duelCurrentTurn;
    duelAttempts[player] += 1;
    attempts++;
    const didMatch = renderRow(guess, { playerIndex: player, suppressEndHandling: true });

    if (didMatch) {
      isSolved = true;
      duelOutcomeText = `${DUEL_PLAYERS[player]} Wins`;
      launchConfetti();
      if (boardWrap) {
        boardWrap.classList.add("victory-glow");
        if (victoryFxTimer) clearTimeout(victoryFxTimer);
        victoryFxTimer = setTimeout(() => {
          boardWrap.classList.remove("victory-glow");
          victoryFxTimer = null;
        }, 1500);
      }

      setStatus(`${DUEL_PLAYERS[player]} guessed ${answer.name} first!`, "success");
      recordGameResult(true);
      renderRecap(true);
      guessInput.value = "";
      guessInput.disabled = true;
      closeSuggestions();
      return;
    }

    const p1Out = duelAttempts[0] >= DUEL_GUESS_LIMIT;
    const p2Out = duelAttempts[1] >= DUEL_GUESS_LIMIT;
    if (p1Out && p2Out) {
      isSolved = true;
      duelOutcomeText = "Draw";
      setStatus(`No one found it in 6 turns each. Answer: ${answer.name}`, "error");
      recordGameResult(false);
      renderRecap(false);
      guessInput.value = "";
      guessInput.disabled = true;
      closeSuggestions();
      return;
    }

    const other = player === 0 ? 1 : 0;
    duelCurrentTurn = duelAttempts[other] < DUEL_GUESS_LIMIT ? other : player;
    setStatus(`${DUEL_PLAYERS[duelCurrentTurn]}'s turn`, "info");
    updateStats();
    guessInput.value = "";
    closeSuggestions();
    guessInput.focus();
    return;
  }

  attempts++;
  renderRow(guess);

  if (!isSolved && isHardMode && attempts >= HARD_GUESS_LIMIT) {
    setStatus(`Out of guesses. The answer was ${answer.name}.`, "error");
    recordGameResult(false);
    renderRecap(false);
    guessInput.value = "";
    guessInput.disabled = true;
    if (submitBtn) {
      submitBtn.disabled = true;
    }
    closeSuggestions();
    setTimeout(() => {
      startNewGame();
    }, 1100);
    return;
  }

  guessInput.value = "";
  setSubmitState();
  closeSuggestions();
  guessInput.focus();
}

async function init() {
  try {
    const res = await fetch("characters.json");
    if (!res.ok) {
      throw new Error(`Failed to load characters.json (${res.status})`);
    }

    CHARACTERS = await res.json();
    if (!Array.isArray(CHARACTERS) || CHARACTERS.length === 0) {
      throw new Error("characters.json did not contain a character list");
    }

    renderStatsDashboard();
    startNewGame();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    setStatus(`Failed to load game data. ${detail}`, "error");
    guessInput.disabled = true;
    if (submitBtn) {
      submitBtn.disabled = true;
    }
  }
}


function setActiveSuggestion(index) {
  if (!suggestionItems.length) {
    activeSuggestionIndex = -1;
    return;
  }

  activeSuggestionIndex = index;
  suggestionItems.forEach((el, i) => {
    const isActive = i === activeSuggestionIndex;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) {
      el.scrollIntoView({ block: "nearest" });
    }
  });
}

function selectSuggestionByIndex(index) {
  if (index < 0 || index >= suggestionItems.length) return;
  const selected = suggestionItems[index];
  guessInput.value = selected.dataset.name || "";
  onGuess();
  setSubmitState();
  closeSuggestions();
  guessInput.focus();
}

function showSuggestions(items, query = "") {
  if (!items.length) {
    closeSuggestions();
    return;
  }

  suggestionsEl.classList.remove("hidden");
  suggestionsEl.setAttribute("role", "listbox");

  suggestionsEl.innerHTML = items.map(c => {
    const meta = `${c.affiliation || ""}${c.origin ? " \u2022 " + c.origin : ""}`;
    const faction = getFactionTag(c.affiliation);

    const imgSrc = getVisibleImageSrc(c.image);
    const highlightedName = highlightMatch(c.name, query);

    return `
      <div class="suggestionItem" role="option" aria-selected="false" data-name="${escapeHtml(c.name)}">
        <img class="suggestionImg" src="${escapeHtml(imgSrc)}" data-fallback="img/placeholder.png" alt="${escapeHtml(c.name)}">
        <div class="suggestionText">
          <div class="suggestionName">${highlightedName}</div>
          <span class="factionBadge ${faction.className}">${faction.label}</span>
          <div class="suggestionMeta">${escapeHtml(meta)}</div>
        </div>
      </div>
    `;
  }).join("");

  attachImageFallback(suggestionsEl);
  suggestionItems = Array.from(suggestionsEl.querySelectorAll(".suggestionItem"));
  setActiveSuggestion(-1);

  suggestionItems.forEach((el, i) => {
    el.addEventListener("mouseenter", () => {
      setActiveSuggestion(i);
    });
    el.addEventListener("click", () => {
      selectSuggestionByIndex(i);
    });
  });
}

function updateSuggestions(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return showSuggestions([]);

  const matches = CHARACTERS
    .filter(c => (c.name || "").toLowerCase().includes(q))
    .slice(0, 8);

  showSuggestions(matches, q);
}

function startNewGame() {
  attempts = 0;
  isSolved = false;
  setStatus("");
  rows.innerHTML = "";
  guessInput.value = "";
  recentGuessNames = [];
  renderRecentGuesses();
  pickRandomAnswer();
  updateStats();
}


guessInput.addEventListener("input", (e) => {
  setStatus("");
  setSubmitState();
  updateSuggestions(e.target.value);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".searchWrap")) {
    closeSuggestions();
  }

  if (menuPanel && menuBtn && !e.target.closest(".sideMenu")) {
    menuPanel.classList.add("hidden");
    menuBtn.setAttribute("aria-expanded", "false");
  }

  if (imageModal && e.target === imageModal) {
    closeImageModal();
  }
});


// Press Enter to submit guess or choose active suggestion.
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" && suggestionItems.length) {
    e.preventDefault();
    const next = activeSuggestionIndex < suggestionItems.length - 1 ? activeSuggestionIndex + 1 : 0;
    setActiveSuggestion(next);
    return;
  }

  if (e.key === "ArrowUp" && suggestionItems.length) {
    e.preventDefault();
    const next = activeSuggestionIndex > 0 ? activeSuggestionIndex - 1 : suggestionItems.length - 1;
    setActiveSuggestion(next);
    return;
  }

  if (e.key === "Escape") {
    closeImageModal();
    closeSuggestions();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    if (activeSuggestionIndex >= 0) {
      selectSuggestionByIndex(activeSuggestionIndex);
      return;
    }
    onGuess();
  }
});

if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    onGuess();
  });
}

// click New Game
newBtn.addEventListener("click", () => {
  startNewGame();
});

if (compactModeEl) {
  compactModeEl.addEventListener("change", () => {
    document.body.classList.toggle("compactMode", compactModeEl.checked);
    localStorage.setItem("op_compact_mode", compactModeEl.checked ? "1" : "0");
  });
}

if (modePresetEl) {
  modePresetEl.addEventListener("change", () => {
    applyModePreset(modePresetEl.value, true);
  });
}

if (menuBtn && menuPanel) {
  menuBtn.addEventListener("click", () => {
    const isOpen = !menuPanel.classList.contains("hidden");
    menuPanel.classList.toggle("hidden", isOpen);
    menuBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
}

if (imageModalClose) {
  imageModalClose.addEventListener("click", closeImageModal);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeImageModal();
  }
});


init();

if (compactModeEl) {
  const savedCompact = localStorage.getItem("op_compact_mode") === "1";
  compactModeEl.checked = savedCompact;
  document.body.classList.toggle("compactMode", savedCompact);
}

applyModePreset(localStorage.getItem(MODE_PRESET_KEY) || "casual", false);


