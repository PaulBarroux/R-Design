// =============================================================================
// ADMIN — script.js
// =============================================================================

// ── REFERENCES DOM ───────────────────────────────────────────────────────────

const screenJoin      = document.getElementById("screen-join");
const screenGame      = document.getElementById("screen-game");
const passwordInput   = document.getElementById("password-input");
const btnLogin        = document.getElementById("btn-login");
const loginError      = document.getElementById("login-error");

const statusDot       = document.getElementById("status-dot");
const statusText      = document.getElementById("status-text");
const gameError       = document.getElementById("game-error");

const tabs            = document.querySelectorAll(".tab");
const tabCanvas       = document.getElementById("tab-canvas");
const tabPlayers      = document.getElementById("tab-players");
const tabTeams        = document.getElementById("tab-teams");
const tabTeamDetail   = document.getElementById("tab-team-detail");
const tabTimelapse    = document.getElementById("tab-timelapse");

const canvasContainer = document.getElementById("canvas-container");
const canvasViewport  = document.getElementById("canvas-viewport");
const canvasEl        = document.getElementById("pixel-canvas");
const ctx             = canvasEl.getContext("2d");
const pixelCursor     = document.getElementById("pixel-cursor");
const coordsText      = document.getElementById("coords-text");
const btnZoomIn       = document.getElementById("btn-zoom-in");
const btnZoomOut      = document.getElementById("btn-zoom-out");
const zoomLevelEl     = document.getElementById("zoom-level");
const bottomSheet     = document.getElementById("bottom-sheet");
const paletteEl       = document.getElementById("palette");

const playersListEl   = document.getElementById("players-list");
const playersCountEl  = document.getElementById("players-count");
const teamsListEl     = document.getElementById("teams-list");
const teamsCountEl    = document.getElementById("teams-count");

const btnBackTeams       = document.getElementById("btn-back-teams");
const detailTeamDot      = document.getElementById("detail-team-dot");
const detailTeamName     = document.getElementById("detail-team-name");
const detailTeamStats    = document.getElementById("detail-team-stats");
const detailMembersList  = document.getElementById("detail-members-list");
const overlayPreviewRow  = document.getElementById("overlay-preview-row");
const overlayThumbnail   = document.getElementById("overlay-thumbnail");
const btnOverlayDelete   = document.getElementById("btn-overlay-delete");
const btnOverlayAdd      = document.getElementById("btn-overlay-add");
const overlayFileInput   = document.getElementById("overlay-file-input");

// Timelapse
const tlCanvasEl        = document.getElementById("timelapse-canvas");
const tlCtx             = tlCanvasEl ? tlCanvasEl.getContext("2d") : null;
const tlProgressBar     = document.getElementById("tl-progress-bar");
const tlProgressFill    = document.getElementById("tl-progress-fill");
const tlProgressThumb   = document.getElementById("tl-progress-thumb");
const tlTimeDisplay     = document.getElementById("tl-time-display");
const tlPixelCount      = document.getElementById("tl-pixel-count");
const btnTlPlay         = document.getElementById("btn-tl-play");
const btnTlRestart      = document.getElementById("btn-tl-restart");
const tlSpeedBtns       = document.querySelectorAll(".tl-speed-btn");

const adminOverlaysContainer = document.getElementById("admin-overlays-container");
const templatesPanel         = document.getElementById("templates-panel");
const btnTemplatesToggle     = document.getElementById("btn-templates-toggle");
const templatesBadge         = document.getElementById("templates-badge");
const templatesChevron       = document.getElementById("templates-chevron");
const templatesListEl        = document.getElementById("templates-list");

// ── ETAT LOCAL ───────────────────────────────────────────────────────────────

let ws = null;
let adminToken = null;
let selectedColor = null;
let selectedPixel = null;
let canvasData = null;
let canvasSize = { width: 200, height: 200 };
let palette = [];
let playersData = [];
let teamsData = {};
let detailTeamId = null;

// Zoom / pan
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let MIN_ZOOM = 1;
let CANVAS_FILL_ZOOM = 1;
const MAX_ZOOM = 20;
const CANVAS_PAD_H = 100;
const CANVAS_PAD_BOTTOM = 200;

let adminOverlayVisible = {}; // teamId -> bool
let adminOverlayEls    = {}; // teamId -> img element
let templatesPanelOpen = false;

let touchState = null;
let mouseDrag = null;
let adminMode = "move"; // "move" | "draw" | "bomb"
const btnModeToggle = document.getElementById("btn-mode-toggle");
const btnBombMode   = document.getElementById("btn-bomb-mode");

// Timelapse state
let tlHistory       = [];   // tableau trié par timestamp
let tlIndex         = 0;    // index courant dans l'histoire
let tlGameStart     = 0;    // timestamp du premier pixel
let tlGameEnd       = 0;    // timestamp du dernier pixel
let tlCurrentMs     = 0;    // position courante en ms de temps de jeu
let tlSpeed         = 200;  // multiplicateur de vitesse
let tlPlaying       = false;
let tlRAF           = null;
let tlLastRAFTime   = null;
let tlCanvasW       = 200;
let tlCanvasH       = 200;
let tlScrubbing     = false;

// =============================================================================
// TABS
// =============================================================================

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    tabCanvas.classList.toggle("hidden", target !== "canvas");
    tabPlayers.classList.toggle("hidden", target !== "players");
    if (target !== "teams") {
      tabTeamDetail.classList.add("hidden");
      detailTeamId = null;
    }
    tabTeams.classList.toggle("hidden", target !== "teams");
    tabTimelapse.classList.toggle("hidden", target !== "timelapse");
    if (target === "timelapse") openTimelapse();
  });
});

btnBackTeams.addEventListener("click", () => {
  tabTeamDetail.classList.add("hidden");
  tabTeams.classList.remove("hidden");
  detailTeamId = null;
});

// =============================================================================
// ERREURS
// =============================================================================

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
  setTimeout(() => loginError.classList.add("hidden"), 5000);
}

let gameErrorTimeout = null;
function showGameError(msg) {
  gameError.textContent = msg;
  gameError.classList.remove("hidden");
  if (gameErrorTimeout) clearTimeout(gameErrorTimeout);
  gameErrorTimeout = setTimeout(() => gameError.classList.add("hidden"), 4000);
}

// =============================================================================
// LOGIN
// =============================================================================

btnLogin.addEventListener("click", doLogin);
passwordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

async function doLogin() {
  const password = passwordInput.value.trim();
  if (!password) { passwordInput.style.borderColor = "#e94560"; passwordInput.focus(); return; }
  loginError.classList.add("hidden");
  btnLogin.disabled = true;
  btnLogin.textContent = "Connexion...";

  try {
    const res = await fetch("/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    if (json.ok) {
      adminToken = json.token;
      screenJoin.classList.add("hidden");
      screenGame.classList.remove("hidden");
      connectWS();
      setTimeout(initFillZoom, 50);
    } else {
      showLoginError(json.message || "Mot de passe incorrect.");
      btnLogin.disabled = false;
      btnLogin.textContent = "Connexion";
    }
  } catch {
    showLoginError("Erreur de connexion au serveur.");
    btnLogin.disabled = false;
    btnLogin.textContent = "Connexion";
  }
}

// =============================================================================
// WEBSOCKET
// =============================================================================

function connectWS() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.addEventListener("open", () => {
    statusDot.classList.add("connected");
    statusDot.classList.remove("disconnected");
    statusText.textContent = "Connecte";
    send("adminAuth", { token: adminToken });
  });

  ws.addEventListener("close", () => {
    statusDot.classList.remove("connected");
    statusDot.classList.add("disconnected");
    statusText.textContent = "Deconnecte";
    setTimeout(connectWS, 3000);
  });

  ws.addEventListener("message", (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    const { type, data } = msg;

    if (type === "init") {
      canvasSize = data.canvasSize;
      palette = data.palette;
      canvasData = data.canvas;
      playersData = data.players || [];
      teamsData = data.teams || {};
      buildPalette(palette);
      renderCanvas(canvasData);
      renderPlayersList();
      renderTeamsList();
      renderTemplatesPanel();
      updateViewport();
    }
    if (type === "pixelUpdate") {
      if (canvasData) {
        canvasData[data.y][data.x] = data.color;
        updatePixel(data.x, data.y, data.color);
      }
    }
    if (type === "playersUpdate") {
      playersData = data;
      renderPlayersList();
      if (detailTeamId) renderTeamDetail(detailTeamId);
    }
    if (type === "teamsUpdate") {
      teamsData = data;
      renderTeamsList();
      renderTemplatesPanel();
      renderPlayersList();
      if (detailTeamId) renderTeamDetail(detailTeamId);
    }
    if (type === "error" || type === "gameError") {
      showGameError(data.message);
    }
    if (type === "historyData") {
      handleHistoryData(data);
    }
  });
}

function send(type, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

// =============================================================================
// PALETTE
// =============================================================================

const LIGHT_COLORS = new Set([
  "#FFFFFF","#FFF8B8","#D5D7D9","#D4D7D9","#94B3FF","#51E9F4","#FED734","#FEA800","#FFB470","#FF99AA",
]);

function buildPalette(colors) {
  palette = colors;
  paletteEl.innerHTML = "";
  colors.forEach((color) => {
    const btn = document.createElement("div");
    btn.className = "palette-color";
    btn.style.background = color;
    if (LIGHT_COLORS.has(color)) btn.dataset.light = "";
    btn.addEventListener("click", () => {
      document.querySelectorAll(".palette-color").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedColor = color;
    });
    paletteEl.appendChild(btn);
  });
}

// =============================================================================
// CANVAS — RENDU
// =============================================================================

function renderCanvas(data) {
  if (!data) return;
  canvasData = data;
  canvasEl.width = canvasSize.width;
  canvasEl.height = canvasSize.height;
  const imageData = ctx.createImageData(canvasSize.width, canvasSize.height);
  for (let y = 0; y < canvasSize.height; y++) {
    for (let x = 0; x < canvasSize.width; x++) {
      const idx = (y * canvasSize.width + x) * 4;
      const color = data[y][x];
      if (color) {
        imageData.data[idx]     = parseInt(color.slice(1, 3), 16);
        imageData.data[idx + 1] = parseInt(color.slice(3, 5), 16);
        imageData.data[idx + 2] = parseInt(color.slice(5, 7), 16);
        imageData.data[idx + 3] = 255;
      } else {
        imageData.data[idx] = imageData.data[idx+1] = imageData.data[idx+2] = 255;
        imageData.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function updatePixel(x, y, color) {
  if (canvasData) canvasData[y][x] = color;
  const img = ctx.createImageData(1, 1);
  img.data[0] = parseInt(color.slice(1, 3), 16);
  img.data[1] = parseInt(color.slice(3, 5), 16);
  img.data[2] = parseInt(color.slice(5, 7), 16);
  img.data[3] = 255;
  ctx.putImageData(img, x, y);
}

// =============================================================================
// CANVAS — ZOOM / PAN
// =============================================================================

let zoomInitialized = false;

function initFillZoom() {
  if (!zoomInitialized) { zoomInitialized = true; updateViewport(); zoomLevel = CANVAS_FILL_ZOOM; }
  updateViewport();
}

function updateViewport() {
  const rect = canvasContainer.getBoundingClientRect();
  const cw = rect.width, ch = rect.height;
  if (!cw || !ch) return;

  const sheetMatrix = new DOMMatrix(getComputedStyle(bottomSheet).transform);
  const sheetVisibleH = Math.max(0, bottomSheet.offsetHeight - (sheetMatrix.m42 || 0));
  const SHEET_CLEARANCE = 24;
  const padBottom = Math.max(CANVAS_PAD_BOTTOM, sheetVisibleH + SHEET_CLEARANCE + 40);

  CANVAS_FILL_ZOOM = Math.min(cw / canvasSize.width, ch / canvasSize.height);
  const minZoomX = (cw - CANVAS_PAD_H * 2) / canvasSize.width;
  const minZoomY = (ch - CANVAS_PAD_H - padBottom) / canvasSize.height;
  MIN_ZOOM = Math.max(0.1, Math.min(minZoomX, minZoomY));
  if (zoomLevel < MIN_ZOOM) zoomLevel = MIN_ZOOM;

  const scaledW = canvasSize.width * zoomLevel;
  const scaledH = canvasSize.height * zoomLevel;
  const worldW = scaledW + CANVAS_PAD_H * 2;
  const worldH = scaledH + CANVAS_PAD_H + padBottom;

  canvasViewport.style.width  = worldW + "px";
  canvasViewport.style.height = worldH + "px";
  canvasEl.style.left   = CANVAS_PAD_H + "px";
  canvasEl.style.top    = CANVAS_PAD_H + "px";
  canvasEl.style.width  = scaledW + "px";
  canvasEl.style.height = scaledH + "px";

  const visibleH = ch - sheetVisibleH - SHEET_CLEARANCE;
  const overflowX = worldW - cw;
  const overflowY = CANVAS_PAD_H + scaledH - visibleH;
  if (overflowX <= 0) { panX = overflowX / 2; }
  else { panX = Math.max(0, Math.min(panX, overflowX)); }
  if (overflowY <= 0) { panY = overflowY / 2; }
  else { panY = Math.max(0, Math.min(panY, overflowY)); }
  canvasViewport.style.transform = `translate(${-panX}px, ${-panY}px)`;

  const ratio = zoomLevel / CANVAS_FILL_ZOOM;
  zoomLevelEl.textContent = (ratio >= 1 ? Math.round(ratio) : Math.round(ratio * 10) / 10) + "x";
  updatePixelCursor();
  updateAllAdminOverlays();
}

// =============================================================================
// MODE TOGGLE (move / draw / bomb) — 3 boutons radio indépendants
// =============================================================================

function setAdminMode(mode) {
  adminMode = mode;
  // btnModeToggle : actif uniquement en mode dessin
  btnModeToggle.textContent = "✏️";
  btnModeToggle.title = "Mode dessin";
  btnModeToggle.classList.toggle("mode-draw", adminMode === "draw");
  btnModeToggle.classList.toggle("mode-move", adminMode !== "draw");
  // btnBombMode : actif uniquement en mode bombe
  btnBombMode.classList.toggle("mode-draw", adminMode === "bomb");
  // curseur
  canvasEl.style.cursor = adminMode === "move" ? "grab" : "crosshair";
}

// Mode déplacement : bouton séparé (✋) ou clic sur btnModeToggle quand déjà en dessin
btnModeToggle.addEventListener("click", () => {
  setAdminMode(adminMode === "draw" ? "move" : "draw");
});

btnBombMode.addEventListener("click", () => {
  setAdminMode(adminMode === "bomb" ? "move" : "bomb");
});

// =============================================================================
// ZOOM BUTTONS
// =============================================================================

btnZoomIn.addEventListener("click", () => applyZoom(zoomLevel * 1.5));
btnZoomOut.addEventListener("click", () => applyZoom(zoomLevel / 1.5));

function applyZoom(newZoom) {
  const rect = canvasContainer.getBoundingClientRect();
  const cx = rect.width / 2, cy = rect.height / 2;
  const focusX = panX + cx, focusY = panY + cy;
  const oldZoom = zoomLevel;
  zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
  panX = CANVAS_PAD_H + (focusX - CANVAS_PAD_H) * (zoomLevel / oldZoom) - cx;
  panY = CANVAS_PAD_H + (focusY - CANVAS_PAD_H) * (zoomLevel / oldZoom) - cy;
  updateViewport();
}

// =============================================================================
// TOUCH — PINCH + PAN
// =============================================================================

canvasContainer.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    touchState = { type: "pan", startX: t.clientX, startY: t.clientY, startPanX: panX, startPanY: panY };
  } else if (e.touches.length === 2) {
    const [a, b] = [e.touches[0], e.touches[1]];
    touchState = {
      type: "pinch",
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      midX: (a.clientX + b.clientX) / 2,
      midY: (a.clientY + b.clientY) / 2,
      startZoom: zoomLevel, startPanX: panX, startPanY: panY,
    };
  }
}, { passive: false });

canvasContainer.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!touchState) return;
  if (touchState.type === "pan" && e.touches.length === 1) {
    const t = e.touches[0];
    panX = touchState.startPanX - (t.clientX - touchState.startX);
    panY = touchState.startPanY - (t.clientY - touchState.startY);
    updateViewport();
  }
  if (touchState.type === "pinch" && e.touches.length === 2) {
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const rect = canvasContainer.getBoundingClientRect();
    const midX = (a.clientX + b.clientX) / 2 - rect.left;
    const midY = (a.clientY + b.clientY) / 2 - rect.top;
    const focusX = touchState.startPanX + (touchState.midX - rect.left);
    const focusY = touchState.startPanY + (touchState.midY - rect.top);
    const oldZoom = zoomLevel;
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchState.startZoom * (dist / touchState.dist)));
    panX = CANVAS_PAD_H + (focusX - CANVAS_PAD_H) * (zoomLevel / touchState.startZoom) - midX;
    panY = CANVAS_PAD_H + (focusY - CANVAS_PAD_H) * (zoomLevel / touchState.startZoom) - midY;
    updateViewport();
  }
}, { passive: false });

canvasContainer.addEventListener("touchend", (e) => {
  if (touchState?.type === "pan" && e.changedTouches.length === 1) {
    const t = e.changedTouches[0];
    if (Math.abs(t.clientX - touchState.startX) < 10 && Math.abs(t.clientY - touchState.startY) < 10) {
      handlePixelTap(t.clientX, t.clientY);
    }
  }
  touchState = null;
});

// =============================================================================
// MOUSE — WHEEL + DRAG + CLICK
// =============================================================================

canvasContainer.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const focusX = panX + mx, focusY = panY + my;
  const oldZoom = zoomLevel;
  zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  panX = CANVAS_PAD_H + (focusX - CANVAS_PAD_H) * (zoomLevel / oldZoom) - mx;
  panY = CANVAS_PAD_H + (focusY - CANVAS_PAD_H) * (zoomLevel / oldZoom) - my;
  updateViewport();
}, { passive: false });

canvasContainer.addEventListener("mousedown", (e) => {
  // Clic gauche : pan en mode déplacement, ou initialise le drag pour tous les modes
  if (e.button === 0 || e.button === 1 || e.button === 2) {
    mouseDrag = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY, moved: false, button: e.button };
    if (e.button === 1 || e.button === 2 || adminMode === "move") e.preventDefault();
  }
});

window.addEventListener("mousemove", (e) => {
  if (mouseDrag) {
    const dx = e.clientX - mouseDrag.startX;
    const dy = e.clientY - mouseDrag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mouseDrag.moved = true;
    // Pan uniquement en mode déplacement ou clic milieu/droit
    if (mouseDrag.button !== 0 || adminMode === "move") {
      panX = mouseDrag.startPanX - dx;
      panY = mouseDrag.startPanY - dy;
      updateViewport();
    }
    return;
  }
  const rect = canvasContainer.getBoundingClientRect();
  const px = Math.floor((panX + e.clientX - rect.left - CANVAS_PAD_H) / zoomLevel);
  const py = Math.floor((panY + e.clientY - rect.top  - CANVAS_PAD_H) / zoomLevel);
  coordsText.textContent = (px >= 0 && px < canvasSize.width && py >= 0 && py < canvasSize.height)
    ? `(${px}, ${py})` : "—";
});

window.addEventListener("mouseup", (e) => {
  if (!mouseDrag) return;
  const wasMoved = mouseDrag.moved;
  const startX = mouseDrag.startX, startY = mouseDrag.startY;
  mouseDrag = null;
  // Déclencher l'action seulement si pas de déplacement significatif
  if (!wasMoved && e.button === 0) {
    if (adminMode === "draw") handlePixelTap(startX, startY);
    if (adminMode === "bomb") handleBombTap(startX, startY);
  }
});
canvasContainer.addEventListener("contextmenu", (e) => e.preventDefault());

function handleBombTap(clientX, clientY) {
  if (!selectedColor) return;
  const rect = canvasContainer.getBoundingClientRect();
  const cx = Math.floor((panX + clientX - rect.left - CANVAS_PAD_H) / zoomLevel);
  const cy = Math.floor((panY + clientY - rect.top  - CANVAS_PAD_H) / zoomLevel);
  // Centre du 5x5 sur le clic
  send("adminBomb", { x: cx - 2, y: cy - 2, color: selectedColor });
  coordsText.textContent = `(${cx}, ${cy})`;
}

function handlePixelTap(clientX, clientY) {
  const rect = canvasContainer.getBoundingClientRect();
  const px = Math.floor((panX + clientX - rect.left - CANVAS_PAD_H) / zoomLevel);
  const py = Math.floor((panY + clientY - rect.top  - CANVAS_PAD_H) / zoomLevel);
  if (px < 0 || px >= canvasSize.width || py < 0 || py >= canvasSize.height) return;
  if (selectedColor) send("adminPlacePixel", { x: px, y: py, color: selectedColor });
  selectedPixel = { x: px, y: py };
  updatePixelCursor();
  coordsText.textContent = `(${px}, ${py})`;
}

function updatePixelCursor() {
  if (!selectedPixel) { pixelCursor.classList.add("hidden"); return; }
  pixelCursor.classList.remove("hidden");
  pixelCursor.style.left   = (CANVAS_PAD_H + selectedPixel.x * zoomLevel) + "px";
  pixelCursor.style.top    = (CANVAS_PAD_H + selectedPixel.y * zoomLevel) + "px";
  pixelCursor.style.width  = zoomLevel + "px";
  pixelCursor.style.height = zoomLevel + "px";
}

// =============================================================================
// ONGLET JOUEURS — bloquer / debloquer
// =============================================================================

function renderPlayersList() {
  playersCountEl.textContent = playersData.length;
  if (playersData.length === 0) {
    playersListEl.innerHTML = '<p class="muted">Aucun joueur</p>';
    return;
  }
  playersListEl.innerHTML = "";
  playersData.forEach((p) => {
    const row = document.createElement("div");
    row.className = "member-item" + (p.blocked ? " blocked" : "");

    const dot = document.createElement("div");
    dot.className = "member-status " + (p.active ? "active" : "inactive");

    const name = document.createElement("span");
    name.className = "member-name";
    name.textContent = p.pseudo;

    if (p.blocked) {
      const icon = document.createElement("span");
      icon.className = "blocked-icon";
      icon.textContent = "🔒";
      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(icon);
    } else {
      row.appendChild(dot);
      row.appendChild(name);
    }

    const btnTest = document.createElement("button");
    btnTest.className = p.testPlayer ? "btn-unblock" : "btn-test";
    btnTest.textContent = p.testPlayer ? "Normal" : "Test";
    btnTest.addEventListener("click", () => send("adminToggleTest", { playerId: p.id }));

    const btn = document.createElement("button");
    btn.className = p.blocked ? "btn-unblock" : "btn-block";
    btn.textContent = p.blocked ? "Debloquer" : "Bloquer";
    btn.addEventListener("click", () => send("adminToggleBlock", { playerId: p.id }));

    row.appendChild(btnTest);
    row.appendChild(btn);
    playersListEl.appendChild(row);
  });
}

// =============================================================================
// ONGLET EQUIPES — liste
// =============================================================================

function renderTeamsList() {
  const teams = Object.values(teamsData);
  teamsCountEl.textContent = teams.length;
  if (teams.length === 0) {
    teamsListEl.innerHTML = '<p class="muted">Aucune equipe</p>';
    return;
  }
  teamsListEl.innerHTML = "";
  teams.forEach((team) => {
    const row = document.createElement("div");
    row.className = "team-item";
    row.style.cursor = "pointer";

    const dot = document.createElement("div");
    dot.className = "team-dot";
    dot.style.background = team.color;

    const info = document.createElement("div");
    info.className = "team-item-info";
    const nameEl = document.createElement("div");
    nameEl.className = "team-item-name";
    nameEl.textContent = team.name;
    const statsEl = document.createElement("div");
    statsEl.className = "team-item-stats";
    statsEl.textContent = team.memberCount + " membre" + (team.memberCount > 1 ? "s" : "")
      + " · " + (team.pixelCount || 0) + " px"
      + (team.overlay ? " · template ✓" : "");
    info.appendChild(nameEl);
    info.appendChild(statsEl);

    const arrow = document.createElement("span");
    arrow.textContent = "›";
    arrow.style.opacity = "0.3";
    arrow.style.fontSize = "1.2rem";

    row.appendChild(dot);
    row.appendChild(info);
    row.appendChild(arrow);
    row.addEventListener("click", () => openTeamDetail(team.id));
    teamsListEl.appendChild(row);
  });
}

// =============================================================================
// ONGLET EQUIPES — detail
// =============================================================================

let detailOverlayFileTeamId = null;

function openTeamDetail(teamId) {
  detailTeamId = teamId;
  tabTeams.classList.add("hidden");
  tabTeamDetail.classList.remove("hidden");
  renderTeamDetail(teamId);
}

function renderTeamDetail(teamId) {
  const team = teamsData[teamId];
  if (!team) { tabTeamDetail.classList.add("hidden"); tabTeams.classList.remove("hidden"); return; }

  detailTeamDot.style.background = team.color;
  detailTeamName.textContent = team.name;
  detailTeamStats.textContent = team.memberCount + " membre" + (team.memberCount > 1 ? "s" : "")
    + " · " + (team.pixelCount || 0) + " px";

  // Membres
  detailMembersList.innerHTML = "";
  (team.members || []).forEach((m) => {
    const player = playersData.find((p) => p.id === m.id);
    const row = document.createElement("div");
    row.className = "member-item";

    const dot = document.createElement("div");
    dot.className = "member-status " + (m.active ? "active" : "inactive");

    const name = document.createElement("span");
    name.className = "member-name";
    name.textContent = m.pseudo;

    const role = document.createElement("span");
    role.className = "member-role";
    if (m.isCreator) role.textContent = "Chef";

    const kick = document.createElement("button");
    kick.className = "btn-kick";
    kick.textContent = "Exclure";
    kick.addEventListener("click", () => send("adminKick", { playerId: m.id, teamId }));

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(role);
    row.appendChild(kick);
    detailMembersList.appendChild(row);
  });

  // Overlay
  detailOverlayFileTeamId = teamId;
  if (team.overlay) {
    overlayPreviewRow.classList.remove("hidden");
    overlayThumbnail.src = team.overlay.imageData;
  } else {
    overlayPreviewRow.classList.add("hidden");
  }
}

btnOverlayDelete.addEventListener("click", () => {
  if (!detailTeamId) return;
  send("adminDeleteOverlay", { teamId: detailTeamId });
  overlayPreviewRow.classList.add("hidden");
});

btnOverlayAdd.addEventListener("click", () => {
  overlayFileInput.value = "";
  overlayFileInput.click();
});

overlayFileInput.addEventListener("change", () => {
  const file = overlayFileInput.files[0];
  if (!file || !detailTeamId) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const imageData = e.target.result;
    send("adminSetOverlay", {
      teamId: detailTeamId,
      overlay: { imageData, x: 0, y: 0, scale: 1, opacity: 0.5 },
    });
  };
  reader.readAsDataURL(file);
});

// =============================================================================
// TEMPLATES PANEL
// =============================================================================

btnTemplatesToggle.addEventListener("click", () => {
  templatesPanelOpen = !templatesPanelOpen;
  templatesListEl.classList.toggle("hidden", !templatesPanelOpen);
  templatesChevron.textContent = templatesPanelOpen ? "▲" : "▼";
});

function renderTemplatesPanel() {
  const teamsWithOverlay = Object.values(teamsData).filter(t => t.overlay);
  templatesBadge.textContent = teamsWithOverlay.length;

  // Clean up removed teams
  for (const id of Object.keys(adminOverlayEls)) {
    if (!teamsData[id] || !teamsData[id].overlay) {
      adminOverlayEls[id]?.remove();
      delete adminOverlayEls[id];
      delete adminOverlayVisible[id];
    }
  }

  templatesListEl.innerHTML = "";
  if (teamsWithOverlay.length === 0) {
    templatesListEl.innerHTML = '<p class="muted" style="padding:0.5rem 0;margin:0;font-size:0.8rem">Aucun template</p>';
    return;
  }

  teamsWithOverlay.forEach((team) => {
    const row = document.createElement("div");
    row.className = "template-row";

    const dot = document.createElement("div");
    dot.className = "team-dot";
    dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${team.color};flex-shrink:0`;

    const name = document.createElement("span");
    name.className = "template-team-name";
    name.textContent = team.name;

    const btnToggle = document.createElement("button");
    btnToggle.className = "btn-template-toggle " + (adminOverlayVisible[team.id] ? "active" : "");
    btnToggle.textContent = adminOverlayVisible[team.id] ? "👁" : "👁";
    btnToggle.title = "Afficher/masquer";
    btnToggle.addEventListener("click", () => {
      adminOverlayVisible[team.id] = !adminOverlayVisible[team.id];
      btnToggle.classList.toggle("active", adminOverlayVisible[team.id]);
      updateAdminOverlayEl(team.id);
    });

    const btnDel = document.createElement("button");
    btnDel.className = "btn-template-delete";
    btnDel.textContent = "✕";
    btnDel.title = "Supprimer le template";
    btnDel.addEventListener("click", () => {
      send("adminDeleteOverlay", { teamId: team.id });
      adminOverlayEls[team.id]?.remove();
      delete adminOverlayEls[team.id];
      delete adminOverlayVisible[team.id];
      row.remove();
      // update badge
      templatesBadge.textContent = parseInt(templatesBadge.textContent) - 1;
    });

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(btnToggle);
    row.appendChild(btnDel);
    templatesListEl.appendChild(row);

    // Ensure overlay el exists
    if (!adminOverlayEls[team.id]) {
      const img = document.createElement("img");
      img.draggable = false;
      img.style.cssText = "position:absolute;pointer-events:none;image-rendering:pixelated;display:none;";
      img.onload = () => updateAdminOverlayEl(team.id);
      adminOverlaysContainer.appendChild(img);
      adminOverlayEls[team.id] = img;
    }
    updateAdminOverlayEl(team.id);
  });
}

function updateAdminOverlayEl(teamId) {
  const img = adminOverlayEls[teamId];
  const team = teamsData[teamId];
  if (!img || !team || !team.overlay) { img && (img.style.display = "none"); return; }
  if (!adminOverlayVisible[teamId]) { img.style.display = "none"; return; }
  const ov = team.overlay;
  img.src = ov.imageData;
  img.style.display = "block";
  img.style.opacity = ov.opacity != null ? ov.opacity : 0.5;
  img.style.left = (CANVAS_PAD_H + ov.x * zoomLevel) + "px";
  img.style.top  = (CANVAS_PAD_H + ov.y * zoomLevel) + "px";
  // Même formule que controller applyOverlayTransform :
  // scale 1 = l'image couvre la largeur entière du canvas
  const imgW = img.naturalWidth || 1;
  const imgH = img.naturalHeight || 1;
  const targetW = canvasSize.width * (ov.scale != null ? ov.scale : 1) * zoomLevel;
  img.style.width  = targetW + "px";
  img.style.height = (imgH * (targetW / imgW)) + "px";
}

function updateAllAdminOverlays() {
  for (const teamId of Object.keys(adminOverlayEls)) {
    updateAdminOverlayEl(teamId);
  }
}

// =============================================================================
// TIMELAPSE
// =============================================================================

function openTimelapse() {
  // Demander l'historique au serveur
  send("adminGetHistory", {});
}

function initTlCanvas(w, h) {
  tlCanvasW = w; tlCanvasH = h;
  tlCanvasEl.width = w;
  tlCanvasEl.height = h;
  tlCtx.fillStyle = "#fff";
  tlCtx.fillRect(0, 0, w, h);
}

// Rebuild canvas from scratch up to index i (batch via ImageData)
function tlRebuildTo(i) {
  const imgData = tlCtx.createImageData(tlCanvasW, tlCanvasH);
  for (let k = 0; k < imgData.data.length; k += 4) {
    imgData.data[k] = imgData.data[k+1] = imgData.data[k+2] = 255;
    imgData.data[k+3] = 255;
  }
  for (let k = 0; k < i; k++) {
    const p = tlHistory[k];
    if (!p || !p.color) continue;
    const idx = (p.y * tlCanvasW + p.x) * 4;
    imgData.data[idx]   = parseInt(p.color.slice(1, 3), 16);
    imgData.data[idx+1] = parseInt(p.color.slice(3, 5), 16);
    imgData.data[idx+2] = parseInt(p.color.slice(5, 7), 16);
    imgData.data[idx+3] = 255;
  }
  tlCtx.putImageData(imgData, 0, 0);
  tlIndex = i;
}

// Draw a single pixel incrementally (during playback)
function tlDrawPixel(p) {
  if (!p || !p.color) return;
  const r = parseInt(p.color.slice(1, 3), 16);
  const g = parseInt(p.color.slice(3, 5), 16);
  const b = parseInt(p.color.slice(5, 7), 16);
  const img = tlCtx.createImageData(1, 1);
  img.data[0] = r; img.data[1] = g; img.data[2] = b; img.data[3] = 255;
  tlCtx.putImageData(img, p.x, p.y);
}

function tlUpdateUI() {
  if (tlHistory.length === 0) return;
  const totalMs = tlGameEnd - tlGameStart || 1;
  const pct = Math.min(1, tlCurrentMs / totalMs);
  tlProgressFill.style.width  = (pct * 100) + "%";
  tlProgressThumb.style.left  = (pct * 100) + "%";
  tlTimeDisplay.textContent   = tlFmtTime(tlCurrentMs) + " / " + tlFmtTime(totalMs);
  tlPixelCount.textContent    = tlIndex + " / " + tlHistory.length + " pixels";
  btnTlPlay.textContent       = tlPlaying ? "⏸" : "▶";
}

function tlFmtTime(ms) {
  const s  = Math.floor(ms / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return h + ":" + String(m).padStart(2,"0") + ":" + String(ss).padStart(2,"0");
  return m + ":" + String(ss).padStart(2,"0");
}

function tlSeekToMs(ms) {
  tlCurrentMs = Math.max(0, Math.min(tlGameEnd - tlGameStart, ms));
  const targetTs = tlGameStart + tlCurrentMs;
  // Find index of first pixel after targetTs
  let i = 0;
  while (i < tlHistory.length && tlHistory[i].timestamp <= targetTs) i++;
  tlRebuildTo(i);
  tlUpdateUI();
}

function tlPlay() {
  if (tlHistory.length === 0) return;
  if (tlIndex >= tlHistory.length) {
    tlRebuildTo(0);
    tlCurrentMs = 0;
  }
  tlPlaying = true;
  tlLastRAFTime = null;
  btnTlPlay.textContent = "⏸";
  tlRAF = requestAnimationFrame(tlTick);
}

function tlPause() {
  tlPlaying = false;
  if (tlRAF) { cancelAnimationFrame(tlRAF); tlRAF = null; }
  btnTlPlay.textContent = "▶";
}

function tlTick(now) {
  if (!tlPlaying) return;
  if (tlLastRAFTime === null) tlLastRAFTime = now;
  const dtReal = now - tlLastRAFTime;    // ms réels écoulés
  tlLastRAFTime = now;
  const dtGame = dtReal * tlSpeed;       // ms de jeu à avancer
  tlCurrentMs = Math.min(tlCurrentMs + dtGame, tlGameEnd - tlGameStart);

  const targetTs = tlGameStart + tlCurrentMs;
  // Draw pixels up to targetTs
  while (tlIndex < tlHistory.length && tlHistory[tlIndex].timestamp <= targetTs) {
    tlDrawPixel(tlHistory[tlIndex]);
    tlIndex++;
  }
  tlUpdateUI();

  if (tlIndex >= tlHistory.length || tlCurrentMs >= tlGameEnd - tlGameStart) {
    tlPause();
    return;
  }
  tlRAF = requestAnimationFrame(tlTick);
}

// --- Boutons ---
btnTlPlay.addEventListener("click", () => {
  if (tlPlaying) tlPause(); else tlPlay();
});

btnTlRestart.addEventListener("click", () => {
  tlPause();
  tlRebuildTo(0);
  tlCurrentMs = 0;
  tlUpdateUI();
});

tlSpeedBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tlSpeed = parseInt(btn.dataset.speed);
    tlSpeedBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// --- Scrubbing sur la progress bar ---
function tlGetMsFromEvent(e) {
  const rect = tlProgressBar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  return pct * (tlGameEnd - tlGameStart);
}

tlProgressBar.addEventListener("pointerdown", (e) => {
  tlScrubbing = true;
  tlProgressBar.setPointerCapture(e.pointerId);
  const wasPLaying = tlPlaying;
  tlPause();
  tlSeekToMs(tlGetMsFromEvent(e));
  tlProgressBar._wasPlaying = wasPLaying;
});

tlProgressBar.addEventListener("pointermove", (e) => {
  if (!tlScrubbing) return;
  tlSeekToMs(tlGetMsFromEvent(e));
});

tlProgressBar.addEventListener("pointerup", (e) => {
  if (!tlScrubbing) return;
  tlScrubbing = false;
  tlSeekToMs(tlGetMsFromEvent(e));
  if (tlProgressBar._wasPlaying) tlPlay();
});

// --- Réception des données depuis le serveur ---
// (à appeler dans le handler WS message)
function handleHistoryData(data) {
  tlPause();
  tlHistory = (data.history || []).slice().sort((a, b) => a.timestamp - b.timestamp);
  if (tlHistory.length === 0) {
    tlTimeDisplay.textContent = "Aucun pixel";
    return;
  }
  tlGameStart = tlHistory[0].timestamp;
  tlGameEnd   = tlHistory[tlHistory.length - 1].timestamp;
  tlCurrentMs = 0;
  const sz = data.canvasSize || { width: 200, height: 200 };
  initTlCanvas(sz.width, sz.height);
  tlUpdateUI();
}
