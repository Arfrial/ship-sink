/* ---------- ELEMENTS ---------- */
const playerGrid = document.getElementById("player-grid");
const enemyGrid = document.getElementById("enemy-grid");
const turnText = document.getElementById("turn");
const statusText = document.getElementById("status");
const startBtn = document.getElementById("start");
const resetBtn = document.getElementById("reset");

const setupPanel = document.getElementById("setup-panel");
const usernameInput = document.getElementById("username-input");
const difficultySelect = document.getElementById("difficulty-select");
const confirmSetup = document.getElementById("confirm-setup");

const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const closeSettings = document.getElementById("close-settings");
const themeSelect = document.getElementById("theme-select");
const volumeSlider = document.getElementById("volume-slider");
const muteBtn = document.getElementById("mute-btn");
const muteEnemyBtn = document.getElementById("mute-enemy-btn");

const winnerModal = document.getElementById("winner");
const winnerText = document.getElementById("winner-text");
const statsBox = document.getElementById("stats");
const playAgainBtn = document.getElementById("play-again");
const winnerCommander = document.getElementById("winner-commander");

const commander = document.getElementById("commander");

/* ---------- AI MEMORY ---------- */
let huntQueue = [];
let huntHits = [];

function getNeighbors(idx) {
  const neighbors = [];
  const row = Math.floor(idx / 10);
  const col = idx % 10;

  if (col > 0) neighbors.push(idx - 1);
  if (col < 9) neighbors.push(idx + 1);
  if (row > 0) neighbors.push(idx - 10);
  if (row < 9) neighbors.push(idx + 10);

  return neighbors;
}

/* ---------- TERMINAL TYPING ---------- */
let typingTimeout;
function typeStatus(text, speed = 28) {
  clearTimeout(typingTimeout);
  statusText.textContent = "";
  let i = 0;
  (function type() {
    if (i < text.length) {
      statusText.textContent += text[i++];
      typingTimeout = setTimeout(type, speed);
    }
  })();
}

/* ---------- COMMANDER ---------- */
function setCommander(state) {
  commander.src = `commander/${state}.png`;
}

/* ---------- SOUND ---------- */
let audioReady = false;
let volume = 0.7;
let muted = false;
let muteEnemy = false; 

const sounds = {
  hit: new Audio("sounds/hit.mp3"),
  miss: new Audio("sounds/miss_V2.mp3"),
  place: new Audio("sounds/place_V3.mp3"),
  win: new Audio("sounds/win.mp3"),
  lose: new Audio("sounds/lose.mp3"),
};

muteEnemyBtn.onclick = () => {
  muteEnemy = !muteEnemy;
  muteEnemyBtn.textContent = muteEnemy ? "Unmute Enemy SFX" : "Mute Enemy SFX";
  localStorage.setItem("shipSinkersMuteEnemy", muteEnemy);
};

function playSound(name, isEnemy = false) {
  if (!audioReady || muted) return;
  if (isEnemy && muteEnemy) return;

  const s = sounds[name].cloneNode();
  s.volume = volume;
  s.play();
}

// ---------- LOAD SAVED THEME ----------
const savedTheme = localStorage.getItem("shipSinkersTheme");
if (savedTheme) {
  document.body.classList.remove("navy", "sonar", "neon");
  document.body.classList.add(savedTheme);
  themeSelect.value = savedTheme;
}

// ---------- LOAD SAVED USERNAME ----------
const savedUsername = localStorage.getItem("shipSinkersUsername");
if (savedUsername) {
  usernameInput.value = savedUsername;
}

// ---------- LOAD SAVED AUDIO SETTINGS ----------
const savedMuted = localStorage.getItem("shipSinkersMuted");
if (savedMuted !== null) {
  muted = savedMuted === "true";
  muteBtn.textContent = muted ? "Unmute" : "Mute";
}

const savedMuteEnemy = localStorage.getItem("shipSinkersMuteEnemy");
if (savedMuteEnemy !== null) {
  muteEnemy = savedMuteEnemy === "true";
  muteEnemyBtn.textContent = muteEnemy ? "Unmute Enemy SFX" : "Mute Enemy SFX";
}


/* ---------- SETTINGS ---------- */
settingsBtn.onclick = () => settingsPanel.classList.add("show");
closeSettings.onclick = () => settingsPanel.classList.remove("show");

themeSelect.onchange = (e) => {
  const theme = e.target.value;

  document.body.classList.remove("navy", "sonar", "neon");
  document.body.classList.add(theme);

  localStorage.setItem("shipSinkersTheme", theme);
};


volumeSlider.oninput = (e) => (volume = Number(e.target.value) / 100);
muteBtn.onclick = () => {
  muted = !muted;
  muteBtn.textContent = muted ? "Unmute" : "Mute";
  localStorage.setItem("shipSinkersMuted", muted);
};

/* ---------- GAME STATE ---------- */
const SHIPS = [5, 4, 3, 2, 2];
let shipIndex = 0;
let horizontal = true;
let placing = false;
let battleStarted = false;
let playerTurn = true;

let username = "";
let difficulty = "";

let playerShips = []; // array of arrays of indices-as-string
let enemyShips = [];  // array of arrays of indices-as-number
let enemyShots = new Set();

let playerShots = 0;
let playerHits = 0;
let turnCount = 0;

/* ---------- INIT TEXT ---------- */
typeStatus("Enter your credentials, Captain");
setCommander("neutral");

/* ---------- GRID BUILD ---------- */
function createGrid(grid, handler, hoverOn = false) {
  grid.innerHTML = "";
  for (let i = 0; i < 100; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = String(i);
    if (handler) cell.addEventListener("click", handler);
    if (hoverOn) {
      cell.addEventListener("mouseenter", preview);
      cell.addEventListener("mouseleave", clearPreview);
    }
    grid.appendChild(cell);
  }
}

/* ---------- ROTATE ---------- */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") horizontal = !horizontal;
});

/* ---------- PLACEMENT PREVIEW ---------- */
function clearPreview() {
  document.querySelectorAll(".preview").forEach((c) => c.classList.remove("preview"));
}

function canPlace(start, len, horiz) {
  const row = Math.floor(start / 10);
  const col = start % 10;

  // bounds
  if (horiz && col + len > 10) return false;
  if (!horiz && row + len > 10) return false;

  // overlap
  for (let i = 0; i < len; i++) {
    const idx = horiz ? start + i : start + i * 10;
    if (playerGrid.children[idx].classList.contains("ship")) return false;
  }
  return true;
}

function preview(e) {
  if (!placing) return;
  clearPreview();

  const start = Number(e.target.dataset.index);
  const len = SHIPS[shipIndex];
  if (!canPlace(start, len, horizontal)) return;

  for (let i = 0; i < len; i++) {
    const idx = horizontal ? start + i : start + i * 10;
    playerGrid.children[idx].classList.add("preview");
  }
}

/* ---------- PLACE SHIP ---------- */
function placeShip(e) {
  if (!placing) return;

  const start = Number(e.target.dataset.index);
  const len = SHIPS[shipIndex];
  if (!canPlace(start, len, horizontal)) return;

  const ship = [];
  for (let i = 0; i < len; i++) {
    const idx = horizontal ? start + i : start + i * 10;
    ship.push(idx);
  }

  ship.forEach((i) => playerGrid.children[i].classList.add("ship"));
  playerShips.push(ship.map(String));
  playSound("place");

  shipIndex++;
  clearPreview();

  if (shipIndex === SHIPS.length) {
    placing = false;
    startBtn.disabled = false;
    typeStatus(`Fleet ready, Captain ${username}. Press START BATTLE.`);
  }
}

/* ---------- ENEMY PLACEMENT ---------- */
function placeEnemyFleet() {
  enemyShips = [];
  const occupied = new Set();

  for (const len of SHIPS) {
    let placed = false;
    while (!placed) {
      const start = Math.floor(Math.random() * 100);
      const horiz = Math.random() > 0.5;
      const row = Math.floor(start / 10);
      const col = start % 10;

      if (horiz && col + len > 10) continue;
      if (!horiz && row + len > 10) continue;

      const ship = [];
      let ok = true;
      for (let i = 0; i < len; i++) {
        const idx = horiz ? start + i : start + i * 10;
        if (occupied.has(idx)) { ok = false; break; }
        ship.push(idx);
      }
      if (!ok) continue;

      ship.forEach((x) => occupied.add(x));
      enemyShips.push(ship);
      placed = true;
    }
  }
}

/* ---------- SETUP FLOW ---------- */
confirmSetup.onclick = () => {
  const u = usernameInput.value.trim();
  const d = difficultySelect.value;

  if (!u || !d) {
    typeStatus("ERROR: Enter username and difficulty.");
    return;
  }

  // unlock audio on user gesture
  audioReady = true;

  username = u;
  localStorage.setItem("shipSinkersUsername", username);
  difficulty = d;

  placing = true;
  shipIndex = 0;
  playerShips = [];
  playerShots = 0;
  playerHits = 0;
  turnCount = 0;
  enemyShots.clear();

  // build boards
  createGrid(playerGrid, placeShip, true);
  createGrid(enemyGrid, fireAtEnemy, false);
  enemyGrid.classList.add("disabled");

  startBtn.disabled = true;
  battleStarted = false;
  playerTurn = true;
  turnText.classList.add("hidden");
  setCommander("neutral");

  typeStatus(`Captain ${username}, place your ships in formation!`);
};

/* ---------- START BATTLE ---------- */
startBtn.onclick = () => {
  if (placing) return;
  battleStarted = true;
  playerTurn = true;

  placeEnemyFleet();

  enemyGrid.classList.remove("disabled");
  turnText.classList.remove("hidden");
  turnText.textContent = "YOUR TURN";

  typeStatus("Engage the enemy!");
};

/* ---------- PLAYER FIRE ---------- */
function fireAtEnemy(e) {
  if (!battleStarted || !playerTurn) return;

  const cell = e.target;
  const idx = Number(cell.dataset.index);

  if (cell.classList.contains("hit") || cell.classList.contains("miss")) return;

  playerShots++;

  const ship = enemyShips.find((s) => s.includes(idx));
  if (ship) {
    cell.classList.add("hit");
    playSound("hit",);
    setCommander("hit");
    typeStatus("HIT!");
    playerHits++;
    ship.splice(ship.indexOf(idx), 1);
  } else {
    cell.classList.add("miss");
    playSound("miss",);
    setCommander("miss");
    typeStatus("MISS...");
  }

  setTimeout(() => setCommander("neutral"), 800);

  // check player win before enemy shoots
  if (enemyShips.every((s) => s.length === 0)) {
    endGame(true);
    return;
  }

  playerTurn = false;
  turnText.textContent = "ENEMY TURN";
  setTimeout(enemyTurn, 650);
}

/* ---------- ENEMY AI (v1 = random; difficulty will expand later) ---------- */
function pickEnemyShot() {

  // IMPOSSIBLE — cheat (unchanged idea)
  if (difficulty === "impossible") {
    return Number(playerShips.flat()[0]);
  }

  // HARD & MEDIUM — hunt mode
  if ((difficulty === "medium" || difficulty === "hard") && huntQueue.length > 0) {
    let shot;
    do {
      shot = huntQueue.shift();
    } while (enemyShots.has(shot) && huntQueue.length);

    if (!enemyShots.has(shot)) return shot;
  }

  // EASY / fallback — random
  let shot;
  do {
    shot = Math.floor(Math.random() * 100);
  } while (enemyShots.has(shot));

  return shot;
}

/* ---------- ENEMY TURN ---------- */
function enemyTurn() {
  if (!battleStarted) return;

  turnCount++;

  const shot = pickEnemyShot();
  enemyShots.add(shot);

  const cell = playerGrid.children[shot];
  const ship = playerShips.find(s => s.includes(String(shot)));

  if (ship) {
    cell.classList.add("hit");
    playSound("hit", true);

    ship.splice(ship.indexOf(String(shot)), 1);

    // ---------- HUNT MODE MEMORY ----------
    if (difficulty === "medium" || difficulty === "hard") {
      getNeighbors(shot).forEach(n => {
        if (!enemyShots.has(n) && !huntQueue.includes(n)) {
          huntQueue.push(n);
        }
      });

      huntHits.push(shot);

      // HARD MODE: direction lock after 2 hits
      if (difficulty === "hard" && huntHits.length >= 2) {
        const a = huntHits[huntHits.length - 2];
        const b = huntHits[huntHits.length - 1];
        const diff = b - a;

        huntQueue = huntQueue.filter(n => {
          if (diff === 1) return Math.abs(n - b) === 1;
          if (diff === 10) return Math.abs(n - b) === 10;
          return true;
        });
      }
    }

  } else {
    cell.classList.add("miss");
    playSound("miss", true);
  }

  // ---------- CHECK PLAYER LOSS ----------
  if (playerShips.every(s => s.length === 0)) {
    endGame(false);
    return;
  }

  // ---------- RESET HUNT IF SHIP SUNK ----------
  if (
    huntHits.length &&
    !playerShips.some(s =>
      s.length > 0 && huntHits.some(h => s.includes(String(h)))
    )
  ) {
    huntQueue = [];
    huntHits = [];
  }

  playerTurn = true;
  turnText.textContent = "YOUR TURN";
  typeStatus("Your move, Captain.");
}


/* ---------- END GAME + STATS ---------- */
function endGame(playerWon) {
  battleStarted = false;
  enemyGrid.classList.add("disabled");
  turnText.classList.add("hidden");

  const accuracy = playerShots ? Math.round((playerHits / playerShots) * 100) : 0;

  if (playerWon) {
    winnerCommander.src = "commander/win.png";
    setCommander("win");
    winnerText.textContent = `Victory, Captain ${username}!`;
    typeStatus("Enemy fleet destroyed. Victory!");
    playSound("win");
  } else {
    winnerCommander.src = "commander/lose.png";
    setCommander("lose");
    winnerText.textContent = `Defeat, Captain ${username}…`;
    typeStatus("Our fleet has been sunk...");
    playSound("lose");
  }

  statsBox.innerHTML = `
    <strong>Difficulty:</strong> ${difficulty}<br>
    <strong>Turns:</strong> ${turnCount}<br>
    <strong>Shots Fired:</strong> ${playerShots}<br>
    <strong>Accuracy:</strong> ${accuracy}%
  `;

  winnerModal.classList.add("show");
}

playAgainBtn.onclick = () => location.reload();
resetBtn.onclick = () => location.reload();

/* ---------- INITIAL GRIDS (empty) ---------- */
createGrid(playerGrid, null, false);
createGrid(enemyGrid, null, false);
