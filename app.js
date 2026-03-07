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
const statsBarEl = document.getElementById("statsBar");
const modeChipEl = document.getElementById("modeChip");
const attemptChipEl = document.getElementById("attemptChip");
const streakChipEl = document.getElementById("streakChip");
const suggestionsEl = document.getElementById("suggestions");
const boardWrap = document.querySelector(".boardWrap");
const helpBtn = document.getElementById("helpBtn");
const helpPanel = document.getElementById("helpPanel");
const helpClose = document.getElementById("helpClose");
const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsClose = document.getElementById("settingsClose");
const modePresetEl = document.getElementById("modePreset");
const compactModeEl = document.getElementById("compactMode");
const modeCardEls = Array.from(document.querySelectorAll(".modeCard"));
const progressPillEl = document.getElementById("progressPill");
const progressBarEl = document.getElementById("progressBar");
const progressFillEl = document.getElementById("progressFill");
const progressLabelEl = document.getElementById("progressLabel");
const recentGuessesEl = document.getElementById("recentGuesses");
const statsDashboardEl = document.getElementById("statsDashboard");
const recapCardEl = document.getElementById("recapCard");
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalClose = document.getElementById("imageModalClose");
const duelPassModalEl = document.getElementById("duelPassModal");
const duelReadyTitleEl = document.getElementById("duelReadyTitle");
const duelReadyBtn = document.getElementById("duelReadyBtn");
const srAnnouncer = document.getElementById("srAnnouncer");
const srStatusAnnouncer = document.getElementById("srStatusAnnouncer");

let guessedNames = new Set();
let suggestionItems = [];
let activeSuggestionIndex = -1;
let victoryFxTimer = null;
let recentGuessNames = [];
let guessHistory = [];
let isHardMode = false;
let isDailyMode = false;
let isMysteryTilesMode = false;
let isExtremeMode = false;
let isDuelMode = false;
let activeModePreset = "casual";
let playerStats = null;
let hiddenFieldKeys = [];
let duelCurrentTurn = 0;
let duelAttempts = [0, 0];
let duelOutcomeText = "";
let duelAwaitingReady = false;
let duelGuessedNames = [new Set(), new Set()];
let duelHandoffTimer = null;
let lastFocusEl = null;

const HARD_GUESS_LIMIT = 5;
const PLAYER_STATS_KEY = "op_player_stats_v1";
const MODE_PRESET_KEY = "op_mode_preset";
const CURRENT_GAME_STATE_KEY = "op_current_game_v1";
const PLACEHOLDER_IMAGE = "img/placeholder.jpg";
const MYSTERY_FIELD_POOL = ["affiliation", "haki", "firstArc", "gender"];
const DUEL_GUESS_LIMIT = 6;
const DUEL_PLAYERS = ["Player 1", "Player 2"];
const SEARCH_SUGGESTION_LIMIT = 8;
const MATCH_NO_RESULT_HINT_LEN = 2;
const PRECISE_MATCH_THRESHOLD = 920;
const FUZZY_MATCH_THRESHOLD = 700;
const MIN_SUGGESTION_SCORE = 240;
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const SEARCH_DEBOUNCE_MS = 90;

let characterSearchIndex = [];
let suggestionDebounceTimer = null;

playerStats = loadPlayerStats();




function normalize(str) {
  return (str || "").trim().toLowerCase();
}

function normalizeForSearch(str) {
  return normalize(str).replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function getModeLabel(modeKey = activeModePreset) {
  switch (modeKey) {
    case "hard": return "Hard";
    case "extreme": return "Extreme";
    case "daily": return "Daily";
    case "mystery_tiles": return "Mystery Tiles";
    case "duel_1v1": return "1v1 Duel";
    default: return "Casual";
  }
}

function rememberFocus() {
  if (document.activeElement instanceof HTMLElement) {
    lastFocusEl = document.activeElement;
  }
}

function restoreFocus(fallbackEl = null) {
  const target = (lastFocusEl && document.contains(lastFocusEl)) ? lastFocusEl : fallbackEl;
  if (target && typeof target.focus === "function") {
    target.focus();
  }
  lastFocusEl = null;
}

function announceLive(regionEl, text) {
  if (!regionEl) return;
  regionEl.textContent = "";
  if (!text) return;
  window.setTimeout(() => {
    regionEl.textContent = text;
  }, 20);
}

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
}

function trapFocus(container, event) {
  if (!container || event.key !== "Tab") return false;

  const focusable = getFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    if (typeof container.focus === "function") container.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}

function getOpenTrapContainer() {
  if (duelPassModalEl && !duelPassModalEl.classList.contains("hidden")) return duelPassModalEl;
  if (imageModal && !imageModal.classList.contains("hidden")) return imageModal;
  if (helpPanel && !helpPanel.classList.contains("hidden")) return helpPanel;
  if (menuPanel && !menuPanel.classList.contains("hidden")) return menuPanel;
  return null;
}

function syncModeCardState() {
  if (!modeCardEls.length) return;
  modeCardEls.forEach((card) => {
    const isActive = card.dataset.mode === activeModePreset;
    card.classList.toggle("active", isActive);
    card.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function openHelpPanel() {
  if (!helpPanel || !helpBtn) return;
  rememberFocus();
  helpPanel.classList.remove("hidden");
  helpPanel.setAttribute("aria-hidden", "false");
  helpBtn.setAttribute("aria-expanded", "true");
  const focusable = getFocusableElements(helpPanel);
  (focusable[0] || helpPanel).focus();
}

function closeHelpPanel(restore = false) {
  if (!helpPanel || !helpBtn) return;
  helpPanel.classList.add("hidden");
  helpPanel.setAttribute("aria-hidden", "true");
  helpBtn.setAttribute("aria-expanded", "false");
  if (restore) restoreFocus(helpBtn);
}

function openMenuPanel() {
  if (!menuPanel || !menuBtn) return;
  rememberFocus();
  menuPanel.classList.remove("hidden");
  menuPanel.setAttribute("aria-hidden", "false");
  if (settingsOverlay) {
    settingsOverlay.classList.remove("hidden");
    settingsOverlay.setAttribute("aria-hidden", "false");
  }
  menuBtn.setAttribute("aria-expanded", "true");
  const focusable = getFocusableElements(menuPanel);
  (focusable[0] || menuPanel).focus();
}

function closeMenuPanel(restore = false) {
  if (!menuPanel || !menuBtn) return;
  menuPanel.classList.add("hidden");
  menuPanel.setAttribute("aria-hidden", "true");
  if (settingsOverlay) {
    settingsOverlay.classList.add("hidden");
    settingsOverlay.setAttribute("aria-hidden", "true");
  }
  menuBtn.setAttribute("aria-expanded", "false");
  if (restore) restoreFocus(menuBtn);
}

function getMatchLabel(color) {
  switch (color) {
    case "green": return "Match";
    case "yellow": return "Partial";
    case "red": return "Miss";
    default: return "";
  }
}

function announceRowResult(guess, results, playerIndex = null) {
  const exact = Object.values(results).filter((value) => value === "green").length;
  const partial = Object.values(results).filter((value) => value === "yellow").length;
  const missed = Object.values(results).filter((value) => value === "red").length;
  const lead = playerIndex !== null ? `${DUEL_PLAYERS[playerIndex]} guessed ${guess.name}. ` : `${guess.name}. `;
  announceLive(srAnnouncer, `${lead}${exact} exact, ${partial} partial, ${missed} missed fields.`);
}

function getCharacterByExactName(name) {
  const n = normalize(name);
  return CHARACTERS.find((c) => normalize(c.name) === n) || null;
}

function clearCurrentGameState() {
  localStorage.removeItem(CURRENT_GAME_STATE_KEY);
}

function persistCurrentGameState() {
  if (!answer || isSolved) {
    clearCurrentGameState();
    return;
  }

  const payload = {
    version: 1,
    mode: activeModePreset,
    answerName: answer.name,
    attempts,
    hiddenFieldKeys,
    recentGuessNames,
    guessHistory,
    duelCurrentTurn,
    duelAttempts,
    duelOutcomeText,
    duelAwaitingReady,
    dailyDateKey: isDailyMode ? getLocalDateKey() : null
  };

  localStorage.setItem(CURRENT_GAME_STATE_KEY, JSON.stringify(payload));
}

function restoreCurrentGameState() {
  const raw = localStorage.getItem(CURRENT_GAME_STATE_KEY);
  if (!raw) return false;

  try {
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || !saved.answerName) {
      clearCurrentGameState();
      return false;
    }

    if (saved.mode && saved.mode !== activeModePreset) {
      applyModePreset(saved.mode, false);
    }

    if (saved.mode === "daily" && saved.dailyDateKey !== getLocalDateKey()) {
      clearCurrentGameState();
      return false;
    }

    const savedAnswer = getCharacterByExactName(saved.answerName);
    if (!savedAnswer) {
      clearCurrentGameState();
      return false;
    }

    answer = savedAnswer;
    hiddenFieldKeys = Array.isArray(saved.hiddenFieldKeys) ? saved.hiddenFieldKeys : [];
    attempts = 0;
    isSolved = false;
    guessedNames = new Set();
    duelGuessedNames = [new Set(), new Set()];
    guessHistory = Array.isArray(saved.guessHistory) ? saved.guessHistory : [];
    recentGuessNames = Array.isArray(saved.recentGuessNames) ? saved.recentGuessNames : [];
    duelAttempts = Array.isArray(saved.duelAttempts) ? saved.duelAttempts : [0, 0];
    duelCurrentTurn = Number.isInteger(saved.duelCurrentTurn) ? saved.duelCurrentTurn : 0;
    duelOutcomeText = typeof saved.duelOutcomeText === "string" ? saved.duelOutcomeText : "";
    duelAwaitingReady = !!saved.duelAwaitingReady;

    rows.innerHTML = "";
    hideRecap();
    closeSuggestions();
    guessInput.value = "";
    guessInput.disabled = false;
    updateHiddenHeaders();

    guessHistory.forEach((entry, index) => {
      const guess = getCharacterByExactName(entry.name);
      if (!guess) return;

      attempts = index + 1;
      if (isDuelMode && Number.isInteger(entry.playerIndex)) {
        duelGuessedNames[entry.playerIndex].add(normalize(guess.name));
      } else {
        guessedNames.add(normalize(guess.name));
      }

      renderRow(guess, {
        playerIndex: Number.isInteger(entry.playerIndex) ? entry.playerIndex : null,
        suppressEndHandling: true,
        suppressAnnouncement: true
      });
    });

    attempts = Number.isInteger(saved.attempts) ? saved.attempts : guessHistory.length;
    renderRecentGuesses();
    updateStats();
    setSubmitState();

    if (isDuelMode) {
      if (duelAwaitingReady) {
        showDuelReadyGate();
      } else {
        updateDuelRowPrivacy();
        setStatus(`${DUEL_PLAYERS[duelCurrentTurn]}'s turn`, "info");
      }
    } else {
      updateDuelRowPrivacy();
      setStatus("Restored your unfinished round.", "info");
      guessInput.focus();
    }

    return true;
  } catch (err) {
    clearCurrentGameState();
    return false;
  }
}

function scheduleSuggestionsUpdate(query) {
  if (suggestionDebounceTimer) {
    clearTimeout(suggestionDebounceTimer);
    suggestionDebounceTimer = null;
  }

  if (!(query || "").trim()) {
    updateSuggestions("");
    return;
  }

  suggestionDebounceTimer = setTimeout(() => {
    suggestionDebounceTimer = null;
    updateSuggestions(query);
  }, SEARCH_DEBOUNCE_MS);
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
    affiliation: { index: 1, label: "Affiliation" },
    haki: { index: 3, label: "Haki" },
    firstArc: { index: 6, label: "First Arc" },
    gender: { index: 7, label: "Gender" }
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
  } catch (err) {
    return createDefaultStats();
  }
}

function savePlayerStats() {
  localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify(playerStats));
}

function renderStatsDashboard() {
  if (!statsDashboardEl || !playerStats) return;
  const modeStats = getModeStats();
  const isWrMode = activeModePreset === "hard" || activeModePreset === "extreme";

  const hardStats = getModeStats("hard");
  const extremeStats = getModeStats("extreme");
  const rankedGames = hardStats.gamesPlayed + extremeStats.gamesPlayed;
  const rankedWins = hardStats.wins + extremeStats.wins;
  const rankedWinRate = rankedGames ? Math.round((rankedWins / rankedGames) * 100) : 0;
  const modeWinRate = modeStats.gamesPlayed ? Math.round((modeStats.wins / modeStats.gamesPlayed) * 100) : 0;

  const statTiles = [
    { label: "🎮 Games", value: playerStats.gamesPlayed },
    { label: "🔥 Streak", value: playerStats.currentStreak },
    { label: "🏆 Best Guess", value: modeStats.bestAttempts == null ? "--" : modeStats.bestAttempts }
  ];

  if (isWrMode) {
    statTiles.splice(1, 0, { label: "Win Rate", value: `${rankedWinRate}%` });
    statTiles.splice(3, 0, { label: `${getModeLabel()} WR`, value: `${modeWinRate}%` });
  }

  statsDashboardEl.innerHTML = statTiles.map((x) => `
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
  const safeMode = ["casual", "hard", "extreme", "daily", "mystery_tiles", "duel_1v1"].includes(modeKey) ? modeKey : "casual";
  activeModePreset = safeMode;
  isExtremeMode = safeMode === "extreme";
  isHardMode = safeMode === "hard" || isExtremeMode;
  isDailyMode = safeMode === "daily";
  isMysteryTilesMode = safeMode === "mystery_tiles" || isExtremeMode;
  isDuelMode = safeMode === "duel_1v1";
  if (isDuelMode) {
    duelAttempts = [0, 0];
    duelCurrentTurn = 0;
    duelOutcomeText = "";
  }
  hiddenFieldKeys = isMysteryTilesMode ? pickHiddenFields(2) : [];

  localStorage.setItem(MODE_PRESET_KEY, safeMode);
  if (modePresetEl) modePresetEl.value = safeMode;
  syncModeCardState();
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
  if (!text) {
    announceLive(srStatusAnnouncer, "");
    return;
  }
  msg.classList.add(`status-${tone}`);
  announceLive(tone === "error" ? srStatusAnnouncer : srAnnouncer, text);
}

function updateStats() {
  const best = localStorage.getItem("op_best");
  const currentModeStats = getModeStats();

  if (modeChipEl) {
    modeChipEl.textContent = getModeLabel();
  }

  if (attemptChipEl) {
    if (isDuelMode) {
      const remaining = Math.max(DUEL_GUESS_LIMIT - duelAttempts[duelCurrentTurn], 0);
      attemptChipEl.textContent = `${DUEL_PLAYERS[duelCurrentTurn]} • ${remaining} left`;
    } else if (isHardMode) {
      const remaining = Math.max(HARD_GUESS_LIMIT - attempts, 0);
      attemptChipEl.textContent = `${Math.min(attempts + 1, HARD_GUESS_LIMIT)} / ${HARD_GUESS_LIMIT} • ${remaining} left`;
    } else if (isDailyMode) {
      attemptChipEl.textContent = `Daily • #${attempts + 1}`;
    } else {
      attemptChipEl.textContent = `Guess ${attempts + 1}`;
    }
  }

  if (streakChipEl) {
    streakChipEl.textContent = `🔥 ${currentModeStats.currentStreak}`;
  }

  if (statsBarEl) {
    statsBarEl.classList.remove("hidden");
  }

  if (stats) {
    if (isDuelMode) {
      stats.textContent = `Mode: ${getModeLabel()} \u2022 P1: ${duelAttempts[0]}/${DUEL_GUESS_LIMIT} \u2022 P2: ${duelAttempts[1]}/${DUEL_GUESS_LIMIT}`;
    } else {
      stats.textContent = `Mode: ${getModeLabel()} \u2022 Attempts: ${attempts} \u2022 Best: ${best ? best : "\u2014"}`;
    }
  }
  if (boardWrap) {
    boardWrap.classList.toggle("hardMode", isHardMode);
    boardWrap.classList.toggle("extremeMode", isExtremeMode);
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

  if (progressBarEl && progressFillEl && progressLabelEl) {
    if (isHardMode) {
      const remaining = Math.max(HARD_GUESS_LIMIT - attempts, 0);
      const pct = (attempts / HARD_GUESS_LIMIT) * 100;
      progressBarEl.classList.remove("hidden");
      progressFillEl.style.width = `${pct}%`;
      progressFillEl.style.background = pct >= 80
        ? "linear-gradient(to right,#c0392b,#e74c3c)"
        : pct >= 60
          ? "linear-gradient(to right,#8b6914,#d4af58)"
          : "linear-gradient(to right,#1a6b3c,#d4af58)";
      progressLabelEl.textContent = `${remaining} guess${remaining !== 1 ? "es" : ""} remaining`;
    } else {
      progressBarEl.classList.add("hidden");
      progressFillEl.style.width = "0%";
      progressFillEl.style.background = "linear-gradient(to right,#1a6b3c,#d4af58)";
      progressLabelEl.textContent = "";
    }
  }
}

function setSubmitState() {
  const hasInput = guessInput.value.trim().length > 0;
  if (submitBtn) {
    submitBtn.disabled = isSolved || duelAwaitingReady || !hasInput;
  }
}

function closeSuggestions() {
  if (suggestionDebounceTimer) {
    clearTimeout(suggestionDebounceTimer);
    suggestionDebounceTimer = null;
  }
  suggestionsEl.classList.add("hidden");
  suggestionsEl.innerHTML = "";
  suggestionItems = [];
  activeSuggestionIndex = -1;
  guessInput.setAttribute("aria-expanded", "false");
  guessInput.removeAttribute("aria-activedescendant");
}

function clearDuelHandoffTimer() {
  if (duelHandoffTimer) {
    clearTimeout(duelHandoffTimer);
    duelHandoffTimer = null;
  }
}

function updateDuelRowPrivacy() {
  if (!rows) return;
  const activePlayer = DUEL_PLAYERS[duelCurrentTurn];
  const shouldMask = isDuelMode && !isSolved;
  const hideAllRows = shouldMask && duelAwaitingReady;
  Array.from(rows.children).forEach((rowEl) => {
    if (!rowEl || !rowEl.dataset) return;
    if (!shouldMask) {
      rowEl.classList.remove("duelHiddenRow");
      return;
    }
    const owner = rowEl.dataset.player || "";
    const hideRow = hideAllRows ? !!owner : (owner && owner !== activePlayer);
    rowEl.classList.toggle("duelHiddenRow", hideRow);
  });
}

function showDuelReadyGate() {
  if (!isDuelMode || isSolved) return;
  rememberFocus();
  clearDuelHandoffTimer();
  duelAwaitingReady = true;
  guessInput.value = "";
  guessInput.disabled = true;
  if (submitBtn) {
    submitBtn.disabled = true;
  }
  closeSuggestions();
  updateDuelRowPrivacy();
  if (duelReadyTitleEl) {
    duelReadyTitleEl.textContent = `${DUEL_PLAYERS[duelCurrentTurn]} ready?`;
  }
  if (duelPassModalEl) {
    duelPassModalEl.classList.remove("hidden");
    duelPassModalEl.setAttribute("aria-hidden", "false");
  }
  document.body.classList.add("duelGateOpen");
  setStatus(`Pass device to ${DUEL_PLAYERS[duelCurrentTurn]}.`, "info");
  if (duelReadyBtn) {
    duelReadyBtn.focus();
  }
  persistCurrentGameState();
}

function hideDuelReadyGate() {
  duelAwaitingReady = false;
  clearDuelHandoffTimer();
  if (duelPassModalEl) {
    duelPassModalEl.classList.add("hidden");
    duelPassModalEl.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("duelGateOpen");
}

function startDuelTurn() {
  hideDuelReadyGate();
  if (!isDuelMode || isSolved) return;
  guessInput.disabled = false;
  setSubmitState();
  updateDuelRowPrivacy();
  setStatus(`${DUEL_PLAYERS[duelCurrentTurn]}'s turn`, "info");
  guessInput.focus();
  persistCurrentGameState();
}

function renderRecentGuesses() {
  if (!recentGuessesEl) return;
  if (isDuelMode) {
    recentGuessesEl.classList.add("hidden");
    recentGuessesEl.innerHTML = "";
    return;
  }

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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text, query) {
  const safeText = escapeHtml(text == null ? "" : text);
  const q = (query || "").trim();
  if (!q) return safeText;

  const escaped = escapeRegExp(q);
  const pattern = new RegExp(`(${escaped})`, "ig");
  return safeText.replace(pattern, "<mark>$1</mark>");
}

function getFactionTag(affiliation, name = "") {
  const a = normalize(affiliation);
  const n = normalize(name);
  if (!a) return { label: "Unknown", className: "faction-unknown" };
  if (a.includes("marine")) return { label: "Marines", className: "faction-marines" };
  if (a.includes("straw hat")) return { label: "Straw Hat", className: "faction-strawhat" };
  if (a.includes("cross guild") || a.includes("warlord")) return { label: "Warlord", className: "faction-warlord" };
  if (a.includes("beasts pirates") && (n.includes("ulti") || n.includes("page one"))) {
    return { label: "Pirate", className: "faction-pirate" };
  }
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
      const fallback = img.dataset.fallback || "img/placeholder.jpg";
      if (img.getAttribute("src") !== fallback) {
        img.setAttribute("src", fallback);
      } else {
        img.classList.add("is-fallback");
      }
    });

    img.addEventListener("load", () => {
      const fallback = img.dataset.fallback || "img/placeholder.jpg";
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
    duelAwaitingReady = false;
    duelGuessedNames = [new Set(), new Set()];
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
  if (!isDuelMode) {
    guessInput.focus();
  }

  attempts = 0;
  isSolved = false;
  guessedNames = new Set();
  recentGuessNames = [];
  guessHistory = [];
  if (victoryFxTimer) {
    clearTimeout(victoryFxTimer);
    victoryFxTimer = null;
  }
  if (boardWrap) {
    boardWrap.classList.remove("victory-glow");
  }

  hideDuelReadyGate();
  guessInput.disabled = false;
  setSubmitState();
  closeSuggestions();
  renderRecentGuesses();

  updateStats();
  if (isDuelMode) {
    showDuelReadyGate();
  } else {
    updateDuelRowPrivacy();
  }
}


function findCharacterByName(name) {
  return resolveCharacterFromInput(name);
}

function buildCharacterSearchIndex() {
  characterSearchIndex = CHARACTERS
    .map((character) => {
      const names = new Set();
      const add = (value) => {
        const normalized = normalizeForSearch(value);
        if (normalized.length >= 2) {
          names.add(normalized);
        }
      };

      const baseName = character && character.name ? String(character.name) : "";
      add(baseName);

      if (baseName) {
        const compact = normalizeForSearch(baseName);
        if (compact) add(compact);
        const inParens = /\(([^)]+)\)/.exec(baseName);
        if (inParens && inParens[1]) add(inParens[1]);
      }

      const parts = normalizeForSearch(baseName).split(" ").filter(Boolean);
      if (parts.length > 1) {
        add(parts[0]);
        add(parts[parts.length - 1]);
        add(`${parts[0]} ${parts[parts.length - 1]}`);
      }

      if (Array.isArray(character && character.aliases)) {
        character.aliases.forEach(add);
      }
      if (Array.isArray(character && character.nicknames)) {
        character.nicknames.forEach(add);
      }
      if (Array.isArray(character && character.alsoKnownAs)) {
        character.alsoKnownAs.forEach(add);
      }
      if (typeof character.alias === "string") add(character.alias);
      if (typeof character.nickname === "string") add(character.nickname);
      if (typeof character.alsoKnownAs === "string") add(character.alsoKnownAs);

      return { character, names: Array.from(names) };
    })
    .filter((entry) => entry.character && typeof entry.character.name === "string");
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const left = a.length;
  const right = b.length;
  let prev = Array(right + 1).fill(0);
  let curr = Array(right + 1).fill(0);

  for (let c = 0; c <= right; c++) {
    prev[c] = c;
  }

  for (let i = 1; i <= left; i++) {
    curr[0] = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= right; j++) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }

  return prev[right];
}

function getMatchScore(query, candidate) {
  const q = normalizeForSearch(query);
  const c = normalizeForSearch(candidate);
  if (!q || !c) return 0;

  if (q === c) return 1000;
  if (c.startsWith(q)) return 900 + Math.min(80, q.length * 4);
  if (c.includes(q)) return 780 + Math.min(60, q.length * 3);
  if (q.startsWith(c) && c.length >= 3) return 650 + Math.min(50, c.length * 2);

  const maxLen = Math.max(q.length, c.length);
  const distance = levenshteinDistance(q, c);
  const ratio = 1 - distance / maxLen;
  if (ratio < 0.58) return 0;
  return Math.round(ratio * 500);
}

function getCharacterMatches(query, { limit = SEARCH_SUGGESTION_LIMIT, minScore = 0 } = {}) {
  const q = normalizeForSearch(query);
  if (!q) return [];

  const matches = [];
  for (const entry of characterSearchIndex) {
    let bestScore = 0;
    for (const candidate of entry.names) {
      const score = getMatchScore(q, candidate);
      if (score > bestScore) bestScore = score;
    }
    if (bestScore >= minScore) {
      matches.push({
        character: entry.character,
        score: bestScore
      });
    }
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return normalize(a.character.name).localeCompare(normalize(b.character.name));
  });
  return matches.slice(0, limit);
}

function resolveCharacterFromInput(input) {
  const matches = getCharacterMatches(input, { limit: 4, minScore: MIN_SUGGESTION_SCORE });
  if (!matches.length) return null;

  const best = matches[0];
  const next = matches[1];
  const gap = next ? best.score - next.score : Infinity;

  if (best.score >= PRECISE_MATCH_THRESHOLD) return best.character;
  if (best.score >= FUZZY_MATCH_THRESHOLD && (normalizeForSearch(input).length >= 3 || gap >= 110)) return best.character;
  if (best.score >= FUZZY_MATCH_THRESHOLD && gap >= 120) return best.character;
  if (best.score >= 860 && !next) return best.character;

  return null;
}

function compareExact(a, b) {
  return normalize(a) === normalize(b) ? "green" : "red";
}

const HAKI_CANONICAL_MAP = {
  observation: "observation",
  armament: "armament",
  conqueror: "conqueror",
  "\ud83d\udc40": "observation",
  "\ud83d\udcaa": "armament",
  "\ud83d\udc51": "conqueror"
};

const HAKI_DISPLAY_MAP = {
  observation: "\ud83d\udc40",
  armament: "\ud83d\udcaa",
  conqueror: "\ud83d\udc51"
};

function canonicalizeHaki(value) {
  const key = normalize(value);
  return HAKI_CANONICAL_MAP[key] || key;
}

function formatHaki(hakiList) {
  const items = (hakiList || [])
    .map(canonicalizeHaki)
    .filter(Boolean)
    .map((item) => HAKI_DISPLAY_MAP[item] || item);
  return items.join(", ") || "None";
}


function compareHaki(answerHaki, guessHaki) {
  const a = new Set((answerHaki || []).map(canonicalizeHaki));
  const g = new Set((guessHaki || []).map(canonicalizeHaki));

  // both have no haki -> exact match
  if (a.size === 0 && g.size === 0) return "green";

  // one has haki and the other doesn't -> mismatch
  if (a.size === 0 || g.size === 0) return "red";

  // exact same set -> green
  if (a.size === g.size) {
    let exactMatch = true;
    for (const x of g) {
      if (!a.has(x)) {
        exactMatch = false;
        break;
      }
    }
    if (exactMatch) return "green";
  }

  // both characters have haki, but the sets differ
  return "yellow";
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

function safeScrollIntoView(el, options) {
  if (!el || typeof el.scrollIntoView !== "function") return;
  try {
    el.scrollIntoView(options);
  } catch (err) {
    el.scrollIntoView();
  }
}

function makeCell(value, color, arrow = "") {
  const d = document.createElement("div");
  d.className = `tile ${color || ""}`.trim();

  const safeValue = value == null ? "" : value;

  d.innerHTML = `
    <span class="cellText" title="${String(safeValue).replace(/\"/g, '&quot;')}">${safeValue}</span>
    <span class="cellArrow">${arrow == null ? "" : arrow}</span>
  `;

  return d;
}

function openImageModal(src) {
  if (!imageModal || !imageModalImg || !src) return;
  rememberFocus();
  imageModalImg.src = src;
  imageModal.classList.remove("hidden");
  imageModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  if (imageModalClose) {
    imageModalClose.focus();
  }
}

function closeImageModal(restore = true) {
  if (!imageModal || !imageModalImg) return;
  imageModal.classList.add("hidden");
  imageModal.setAttribute("aria-hidden", "true");
  imageModalImg.src = "";
  document.body.style.overflow = "";
  if (restore) {
    restoreFocus(guessInput);
  }
}



function renderRow(guess, options = {}) {
  const { playerIndex = null, suppressEndHandling = false, suppressAnnouncement = false } = options;
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
  { kind: "image", src: getVisibleImageSrc(guess.image), cls: `tile imageCell imageCell-${results.name}`, fieldKey: "image" },
  { text: guess.affiliation, cls: `tile ${results.affiliation} affiliationCell`, fieldKey: "affiliation" },
  { text: guess.devilFruit, cls: `tile ${results.devilFruit} devilFruitCell`, fieldKey: "devilFruit" },
  { text: formatHaki(guess.haki), cls: `tile ${results.haki} hakiCell`, fieldKey: "haki" },
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
  const matchTone = ["green", "yellow", "red"].find((tone) => d.classList.contains(tone));
  if (matchTone) {
    d.dataset.matchLabel = getMatchLabel(matchTone);
  }

  r.appendChild(d);
});

  attachImageFallback(r);

  rows.prepend(r);
  if (!suppressAnnouncement) {
    announceRowResult(guess, results, playerIndex);
  }

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

  setStatus(`You found ${answer.name}! ✓`, "success");
  recordGameResult(true);
  renderRecap(true);
  clearCurrentGameState();

  guessInput.value = "";
  guessInput.disabled = true;
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  newBtn.focus();
  safeScrollIntoView(newBtn, { behavior: "smooth", block: "center" });

} else {
  setStatus("Keep going", "info");
}

  return matched;
}

function onGuess() {
  if (isSolved || duelAwaitingReady) return;

  const guessName = guessInput.value.trim();
  if (!guessName) {
    setStatus("Type a character name first.", "error");
    return;
  }

  const guess = findCharacterByName(guessName);

  if (!guess) {
    const closeMatches = getCharacterMatches(guessName, { limit: 4, minScore: 260 });
    if (closeMatches.length >= 2) {
      setStatus("Multiple close matches. Pick from the list below.", "error");
    } else if (closeMatches.length === 1) {
      setStatus(`Did you mean “${closeMatches[0].character.name}”?`, "error");
    } else {
      setStatus("Pick a name from the list.", "error");
    }
    return;
  }

  const normalizedGuess = normalize(guess.name);
  if (isDuelMode) {
    const playerSet = duelGuessedNames[duelCurrentTurn];
    if (playerSet.has(normalizedGuess)) {
      setStatus("You already guessed that character.", "error");
      return;
    }
  } else if (guessedNames.has(normalizedGuess)) {
    setStatus("You already guessed that character.", "error");
    return;
  }

  if (isDuelMode) {
    duelGuessedNames[duelCurrentTurn].add(normalize(guess.name));
  } else {
    guessedNames.add(normalize(guess.name));
  }
  guessHistory.push({
    name: guess.name,
    playerIndex: isDuelMode ? duelCurrentTurn : null
  });
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
      clearDuelHandoffTimer();
      guessInput.value = "";
      guessInput.disabled = true;
      hideDuelReadyGate();
      updateDuelRowPrivacy();
      closeSuggestions();
      clearCurrentGameState();
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
      clearDuelHandoffTimer();
      guessInput.value = "";
      guessInput.disabled = true;
      hideDuelReadyGate();
      updateDuelRowPrivacy();
      closeSuggestions();
      clearCurrentGameState();
      return;
    }

    const other = player === 0 ? 1 : 0;
    const nextTurn = duelAttempts[other] < DUEL_GUESS_LIMIT ? other : player;
    const switchedPlayer = nextTurn !== player;
    duelCurrentTurn = nextTurn;
    updateStats();
    guessInput.value = "";
    guessInput.disabled = true;
    if (submitBtn) {
      submitBtn.disabled = true;
    }
    closeSuggestions();
    if (switchedPlayer) {
      setStatus(`${DUEL_PLAYERS[player]} locked in. Pass device.`, "info");
      clearDuelHandoffTimer();
      duelHandoffTimer = setTimeout(() => {
        duelHandoffTimer = null;
        if (!isDuelMode || isSolved) return;
        showDuelReadyGate();
      }, 1000);
    } else {
      startDuelTurn();
    }
    persistCurrentGameState();
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
    clearCurrentGameState();
    return;
  }

  guessInput.value = "";
  setSubmitState();
  closeSuggestions();
  guessInput.focus();
  persistCurrentGameState();
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
    buildCharacterSearchIndex();

    renderStatsDashboard();
    if (!restoreCurrentGameState()) {
      startNewGame();
    }
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
    guessInput.removeAttribute("aria-activedescendant");
    return;
  }

  activeSuggestionIndex = index;
  suggestionItems.forEach((el, i) => {
    const isActive = i === activeSuggestionIndex;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-selected", isActive ? "true" : "false");
    if (isActive) {
      guessInput.setAttribute("aria-activedescendant", el.id);
      safeScrollIntoView(el, { block: "nearest" });
    }
  });

  if (activeSuggestionIndex < 0) {
    guessInput.removeAttribute("aria-activedescendant");
  }
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
    if (query && query.length >= MATCH_NO_RESULT_HINT_LEN) {
      suggestionsEl.classList.remove("hidden");
      suggestionsEl.setAttribute("role", "listbox");
      guessInput.setAttribute("aria-expanded", "true");
      suggestionsEl.innerHTML = `
        <div class="suggestionItem no-match" role="status" aria-live="polite">
          No character found for “${escapeHtml(query)}”.
        </div>
      `;
      suggestionItems = [];
      activeSuggestionIndex = -1;
      return;
    }

    closeSuggestions();
    return;
  }

  suggestionsEl.classList.remove("hidden");
  suggestionsEl.setAttribute("role", "listbox");
  guessInput.setAttribute("aria-expanded", "true");

  suggestionsEl.innerHTML = items.map((c, index) => {
    const meta = `${c.affiliation || ""}${c.origin ? " \u2022 " + c.origin : ""}`;
    const faction = getFactionTag(c.affiliation, c.name);

    const imgSrc = getVisibleImageSrc(c.image);
    const highlightedName = highlightMatch(c.name, query);

    return `
      <div id="suggestion-option-${index}" class="suggestionItem" role="option" aria-selected="false" data-name="${escapeHtml(c.name)}">
        <img class="suggestionImg" src="${escapeHtml(imgSrc)}" data-fallback="img/placeholder.jpg" alt="${escapeHtml(c.name)}">
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
  setActiveSuggestion(suggestionItems.length ? 0 : -1);

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
  if (duelAwaitingReady) {
    closeSuggestions();
    return;
  }
  const q = (query || "").trim().toLowerCase();
  if (!q) return showSuggestions([]);

  const matches = getCharacterMatches(q, { limit: SEARCH_SUGGESTION_LIMIT, minScore: MIN_SUGGESTION_SCORE });
  const suggestions = matches.map((match) => match.character);

  if (!suggestions.length && q.length < MATCH_NO_RESULT_HINT_LEN) {
    return closeSuggestions();
  }

  showSuggestions(suggestions, q);
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
  persistCurrentGameState();
}


guessInput.addEventListener("input", (e) => {
  setStatus("");
  setSubmitState();
  scheduleSuggestionsUpdate(e.target.value);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".searchWrap")) {
    closeSuggestions();
  }

  if (helpPanel && helpBtn && !e.target.closest(".helpMenu")) {
    closeHelpPanel(false);
  }

  if (menuPanel && menuBtn && !e.target.closest(".sideMenu") && e.target !== settingsOverlay) {
    closeMenuPanel(false);
  }

  if (imageModal && e.target === imageModal) {
    closeImageModal(true);
  }
});

guessInput.addEventListener("focus", () => {
  document.body.classList.add("keyboardOpen");
});

guessInput.addEventListener("blur", () => {
  document.body.classList.remove("keyboardOpen");
});


// Press Enter to submit guess or choose active suggestion.
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!suggestionItems.length) {
      updateSuggestions(guessInput.value);
    }
    if (!suggestionItems.length) return;
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

  if (e.key === "Home" && suggestionItems.length) {
    e.preventDefault();
    setActiveSuggestion(0);
    return;
  }

  if (e.key === "End" && suggestionItems.length) {
    e.preventDefault();
    setActiveSuggestion(suggestionItems.length - 1);
    return;
  }

  if (e.key === "Escape") {
    closeImageModal(false);
    closeSuggestions();
    closeHelpPanel(false);
    closeMenuPanel(false);
    return;
  }

  if (e.key === "Tab" && suggestionItems.length) {
    closeSuggestions();
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

if (modeCardEls.length) {
  modeCardEls.forEach((card) => {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode || "casual";
      if (modePresetEl) modePresetEl.value = mode;
      applyModePreset(mode, true);
    });
  });
}

if (menuBtn && menuPanel) {
  menuPanel.tabIndex = -1;
  menuPanel.setAttribute("aria-hidden", "true");
  menuBtn.addEventListener("click", () => {
    closeHelpPanel(false);
    const isOpen = !menuPanel.classList.contains("hidden");
    if (isOpen) {
      closeMenuPanel(true);
    } else {
      openMenuPanel();
    }
  });
}

if (settingsOverlay) {
  settingsOverlay.setAttribute("aria-hidden", "true");
  settingsOverlay.addEventListener("click", () => closeMenuPanel(true));
}

if (settingsClose) {
  settingsClose.addEventListener("click", () => closeMenuPanel(true));
}

if (helpBtn && helpPanel) {
  helpPanel.tabIndex = -1;
  helpPanel.setAttribute("aria-hidden", "true");
  helpBtn.addEventListener("click", () => {
    closeMenuPanel(false);
    const isOpen = !helpPanel.classList.contains("hidden");
    if (isOpen) {
      closeHelpPanel(true);
    } else {
      openHelpPanel();
    }
  });
}

if (helpClose) {
  helpClose.addEventListener("click", () => closeHelpPanel(true));
}

if (imageModalClose) {
  imageModalClose.addEventListener("click", () => closeImageModal(true));
}

if (duelReadyBtn) {
  duelReadyBtn.addEventListener("click", () => {
    startDuelTurn();
  });
}

document.addEventListener("keydown", (e) => {
  const trapContainer = getOpenTrapContainer();
  if (trapContainer && e.key === "Tab") {
    if (trapFocus(trapContainer, e)) return;
  }

  if (e.key === "Escape") {
    if (duelPassModalEl && !duelPassModalEl.classList.contains("hidden")) {
      startDuelTurn();
      return;
    }
    if (imageModal && !imageModal.classList.contains("hidden")) {
      closeImageModal(true);
      return;
    }
    if (helpPanel && !helpPanel.classList.contains("hidden")) {
      closeHelpPanel(true);
      return;
    }
    if (menuPanel && !menuPanel.classList.contains("hidden")) {
      closeMenuPanel(true);
      return;
    }
    closeSuggestions();
  }
});


init();

if (compactModeEl) {
  const savedCompact = localStorage.getItem("op_compact_mode") === "1";
  compactModeEl.checked = savedCompact;
  document.body.classList.toggle("compactMode", savedCompact);
}

applyModePreset(localStorage.getItem(MODE_PRESET_KEY) || "casual", false);

if (guessInput) {
  guessInput.setAttribute("aria-autocomplete", "list");
  guessInput.setAttribute("aria-controls", "suggestions");
  guessInput.setAttribute("aria-expanded", "false");
  guessInput.setAttribute("aria-haspopup", "listbox");
}

if (imageModal) {
  imageModal.tabIndex = -1;
  imageModal.setAttribute("aria-hidden", "true");
}

if (helpPanel) {
  helpPanel.tabIndex = -1;
  helpPanel.setAttribute("aria-hidden", "true");
}

if (duelPassModalEl) {
  duelPassModalEl.tabIndex = -1;
  duelPassModalEl.setAttribute("aria-hidden", "true");
}


