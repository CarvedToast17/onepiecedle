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
const suggestionsEl = document.getElementById("suggestions");
const boardWrap = document.querySelector(".boardWrap");
const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
const hardModeEl = document.getElementById("hardMode");
const compactModeEl = document.getElementById("compactMode");
const progressPillEl = document.getElementById("progressPill");
const recentGuessesEl = document.getElementById("recentGuesses");
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalClose = document.getElementById("imageModalClose");

let guessedNames = new Set();
let suggestionItems = [];
let activeSuggestionIndex = -1;
let victoryFxTimer = null;
let recentGuessNames = [];
let isHardMode = false;

const HARD_GUESS_LIMIT = 5;




function normalize(str) {
  return (str || "").trim().toLowerCase();
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
  stats.textContent = `Attempts: ${attempts} \u2022 Best: ${best ? best : "\u2014"}`;
  if (boardWrap) {
    boardWrap.classList.toggle("hardMode", isHardMode);
  }
  if (progressPillEl) {
    if (isHardMode) {
      const remaining = Math.max(HARD_GUESS_LIMIT - attempts, 0);
      progressPillEl.textContent = `Guess ${Math.min(attempts + 1, HARD_GUESS_LIMIT)} / ${HARD_GUESS_LIMIT} \u2022 ${remaining} left`;
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
  answer = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  rows.innerHTML = "";
  setStatus("");
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



function renderRow(guess) {
  const r = document.createElement("div");
  r.className = "row";
  r.dataset.attempt = String(attempts);

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

 const cells = [
  { kind: "image", src: guess.image, cls: "tile imageCell" },
  { text: guess.name, cls: `tile ${results.name} nameCell` },
  { text: guess.affiliation, cls: `tile ${results.affiliation} affiliationCell` },
  { text: guess.devilFruit, cls: `tile ${results.devilFruit} devilFruitCell` },
  { text: (guess.haki || []).join(", ") || "None", cls: `tile ${results.haki} hakiCell` },
  { text: guess.origin, cls: `tile ${results.origin} originCell` },

  {
  kind: "bounty",
  value: formatBounty(guess.bounty),
  arrow: bountyHint(answer.bounty, guess.bounty).trim(),
  cls: `tile ${results.bounty} bountyCell`
},

{
  kind: "arc",
  value: (guess.firstArc || "\u2014"),
  arrow: arcHint(answer.firstArc, guess.firstArc),
  cls: `tile ${results.firstArc} arcCell`
},


  {
    text: guess.gender,
    cls: `tile ${results.gender}`
  }
];


  cells.forEach((c, i) => {
  let d;

  if (c.kind === "image") {
    d = document.createElement("div");
    d.className = c.cls;

    d.innerHTML = `
      <img class="gridAvatar" src="${c.src || ""}" data-fallback="img/placeholder.png" alt="">
    `;
    const img = d.querySelector(".gridAvatar");
    if (img) {
      img.addEventListener("click", () => openImageModal(img.getAttribute("src")));
    }
  }
  else if (c.kind === "bounty" || c.kind === "arc") {
    d = makeCell(c.value, "", c.arrow);
    d.className = c.cls;
    d.setAttribute("data-tip", c.value);
  }
  else {
    d = document.createElement("div");
    d.className = c.cls;
    d.innerHTML = c.text || "-";
  }

  d.classList.add("pop");
  d.style.animationDelay = `${i * 70}ms`;

  r.appendChild(d);
});

  attachImageFallback(r);

  rows.prepend(r);

  const bestBefore = localStorage.getItem("op_best");
  updateStats();

if (results.name === "green") {
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
  attempts++;
  renderRow(guess);

  if (!isSolved && isHardMode && attempts >= HARD_GUESS_LIMIT) {
    setStatus(`Out of guesses. The answer was ${answer.name}.`, "error");
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

    pickRandomAnswer();
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

    const imgSrc = c.image && c.image.trim() ? c.image : "img/placeholder.png";
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

if (hardModeEl) {
  hardModeEl.addEventListener("change", () => {
    isHardMode = hardModeEl.checked;
    localStorage.setItem("op_hard_mode", isHardMode ? "1" : "0");
    startNewGame();
    updateStats();
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

if (hardModeEl) {
  const savedHard = localStorage.getItem("op_hard_mode") === "1";
  hardModeEl.checked = savedHard;
  isHardMode = savedHard;
  updateStats();
}
