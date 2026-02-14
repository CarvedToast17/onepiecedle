let CHARACTERS = [];
let answer = null;

let attempts = 0;
let isSolved = false;

const stats = document.getElementById("stats");
const namesList = document.getElementById("names");
const submitBtn = document.getElementById("submitBtn");
const rows = document.getElementById("rows");
const msg = document.getElementById("msg");
const guessInput = document.getElementById("guessInput");
const newBtn = document.getElementById("newBtn");
const suggestionsEl = document.getElementById("suggestions");
console.log("suggestionsEl:", suggestionsEl);




function normalize(str) {
  return (str || "").trim().toLowerCase();
}

function launchConfetti() {
  const duration = 800;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5,
      spread: 70,
      origin: { y: 0.6 }
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}


function pickRandomAnswer() {
  answer = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  rows.innerHTML = "";
  msg.textContent = "";
  guessInput.value = "";
  guessInput.focus();

  attempts = 0;
  isSolved = false;

  guessInput.disabled = false;
  submitBtn.disabled = false;

  const best = localStorage.getItem("op_best");
  stats.textContent = `Attempts: ${attempts} • Best: ${best ? best : "—"}`;
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
  if (g < a) return " ↑";
  if (g > a) return " ↓";
  return "";
}

function formatBounty(n) {
  if (!n) return "—";
  return "฿ " + n.toLocaleString();
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

const ARC_SAGA = {
  // East Blue Saga
  "Romance Dawn": "East Blue",
  "Orange Town": "East Blue",
  "Syrup Village": "East Blue",
  "Baratie": "East Blue",
  "Arlong Park": "East Blue",
  "Loguetown": "East Blue",

  // Alabasta Saga
  "Reverse Mountain": "Alabasta",
  "Whisky Peak": "Alabasta",
  "Little Garden": "Alabasta",
  "Drum Island": "Alabasta",
  "Arabasta": "Alabasta",

  // Sky Island Saga
  "Jaya": "Sky Island",
  "Skypiea": "Sky Island",

  // Water 7 Saga
  "Long Ring Long Land": "Water 7",
  "Water 7": "Water 7",
  "Enies Lobby": "Water 7",
  "Post-Enies Lobby": "Water 7",

  // Thriller Bark Saga
  "Thriller Bark": "Thriller Bark",

  // Summit War Saga
  "Sabaody Archipelago": "Summit War",
  "Amazon Lily": "Summit War",
  "Impel Down": "Summit War",
  "Marineford": "Summit War",
  "Post-War": "Summit War",

  // Fish-Man Island Saga
  "Return to Sabaody": "Fish-Man Island",
  "Fish-Man Island": "Fish-Man Island",

  // Dressrosa Saga
  "Punk Hazard": "Dressrosa",
  "Dressrosa": "Dressrosa",

  // Whole Cake Island Saga
  "Zou": "Whole Cake Island",
  "Whole Cake Island": "Whole Cake Island",
  "Reverie": "Whole Cake Island",

  // Wano / Final
  "Wano Country": "Wano",
  "Egghead": "Final"
};

const ARC_SAGA_NORM = {};
for (const [k, v] of Object.entries(ARC_SAGA)) {
  ARC_SAGA_NORM[normArc(k)] = v;
}

function sagaOfArc(arc) {
  return ARC_SAGA_NORM[normArc(arc)] || "";
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

  if (gi < ai) return "↑";
  if (gi > ai) return "↓";
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



function renderRow(guess) {
  const r = document.createElement("div");
  r.className = "row";

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
  { text: guess.affiliation, cls: `tile ${results.affiliation}` },
  { text: guess.devilFruit, cls: `tile ${results.devilFruit}` },
  { text: (guess.haki || []).join(", ") || "None", cls: `tile ${results.haki}` },
  { text: guess.origin, cls: `tile ${results.origin}` },

  {
  kind: "bounty",
  value: formatBounty(guess.bounty),
  arrow: bountyHint(answer.bounty, guess.bounty).trim(),
  cls: `tile ${results.bounty} bountyCell`
},

{
  kind: "arc",
  value: (guess.firstArc || "—"),
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
      <img class="gridAvatar" src="${c.src || ""}" alt="">
    `;
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






  rows.prepend(r);

  // update stats every guess
const bestBefore = localStorage.getItem("op_best");
stats.textContent = `Attempts: ${attempts} • Best: ${bestBefore ? bestBefore : "—"}`;

if (results.name === "green") {
  isSolved = true;
  launchConfetti();

  const best = bestBefore ? parseInt(bestBefore, 10) : null;
  if (best === null || attempts < best) {
    localStorage.setItem("op_best", String(attempts));
  }

  const bestAfter = localStorage.getItem("op_best");
  stats.textContent = `Attempts: ${attempts} • Best: ${bestAfter ? bestAfter : "—"}`;

  msg.textContent = `✅ You got it: ${answer.name} (in ${attempts} guesses)`;

  guessInput.value = "";
  guessInput.disabled = true;
  submitBtn.disabled = true;

  newBtn.focus();
  newBtn.scrollIntoView({ behavior: "smooth", block: "center" });

} else {
  msg.textContent = "Keep going 👀";
}

}

function onGuess() {
  if (isSolved) return;

  const guessName = guessInput.value;
  const guess = findCharacterByName(guessName);

  if (!guess) {
    msg.textContent = "Pick a name from the list.";
    return;
  }

  attempts++;  
  renderRow(guess);
  guessInput.value = "";
  guessInput.focus();
}

async function init() {
  const res = await fetch("characters.json");
  CHARACTERS = await res.json();

  pickRandomAnswer();
}


function showSuggestions(items) {
  if (!items.length) {
    suggestionsEl.classList.add("hidden");
    suggestionsEl.innerHTML = "";
    return;
  }

  suggestionsEl.classList.remove("hidden");

  suggestionsEl.innerHTML = items.map(c => {
    const meta = `${c.affiliation || ""}${c.origin ? " • " + c.origin : ""}`;

    // If no image, use a placeholder (optional)
    const imgSrc = c.image && c.image.trim() ? c.image : "img/placeholder.png";

    return `
      <div class="suggestionItem" data-name="${c.name}">
        <img class="suggestionImg" src="${imgSrc}" alt="${c.name}">
        <div class="suggestionText">
          <div class="suggestionName">${c.name}</div>
          <div class="suggestionMeta">${meta}</div>
        </div>
      </div>
    `;
  }).join("");



  suggestionsEl.querySelectorAll(".suggestionItem").forEach(el => {
    el.addEventListener("click", () => {
      guessInput.value = el.dataset.name;
      suggestionsEl.classList.add("hidden");
      suggestionsEl.innerHTML = "";
      guessInput.focus();
    });
  });
}

function updateSuggestions(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return showSuggestions([]);

  const matches = CHARACTERS
    .filter(c => (c.name || "").toLowerCase().includes(q))
    .slice(0, 8);

  showSuggestions(matches);
}

function startNewGame(){
  attempts = 0;
  isSolved = false;
  msg.textContent = "";
  rows.innerHTML = "";
  guessInput.value = "";
  pickRandomAnswer();
}


guessInput.addEventListener("input", (e) => {
  updateSuggestions(e.target.value);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".searchWrap")) {
    suggestionsEl.classList.add("hidden");
    suggestionsEl.innerHTML = "";
  }
});


// press Enter → submit guess
guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onGuess();
});

submitBtn.addEventListener("click", () => {
  onGuess();
});

// click New Game
newBtn.addEventListener("click", () => {
  attempts = 0;
  isSolved = false;
  msg.textContent = "";
  rows.innerHTML = "";
  guessInput.value = "";
  pickRandomAnswer();
});


init();
