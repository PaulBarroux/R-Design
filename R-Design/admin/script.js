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

let touchState = null;
let mouseDrag = null;
let adminMode = "move"; // "move" ou "draw"
const btnModeToggle = document.getElementById("btn-mode-toggle");

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
    // Quitter les equipes : fermer le detail
    if (target !== "teams") {
      tabTeamDetail.classList.add("hidden");
      detailTeamId = null;
    }
    tabTeams.classList.toggle("hidden", target !== "teams");
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
      renderPlayersList();
      if (detailTeamId) renderTeamDetail(detailTeamId);
    }
    if (type === "error" || type === "gameError") {
      showGameError(data.message);
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

function buildPalette(colors) {
  palette = colors;
  paletteEl.innerHTML = "";
  colors.forEach((color) => {
    const btn = document.createElement("div");
    btn.className = "palette-color";
    btn.style.background = color;
    if (["#FFFFFF", "#D4D7D9", "#D5D7D9", "#FFF8B8", "#94B3FF", "#51E9F4", "#FEA800", "#FED734"].includes(color)) {
      btn.style.border = "2px solid #555";
    }
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
}

// =============================================================================
// MODE TOGGLE (move / draw)
// =============================================================================

btnModeToggle.addEventListener("click", () => {
  adminMode = adminMode === "move" ? "draw" : "move";
  btnModeToggle.textContent = adminMode === "move" ? "✋" : "✏️";
  btnModeToggle.className = "ctrl-btn mode-" + adminMode;
  btnModeToggle.title = adminMode === "move" ? "Mode deplacement" : "Mode dessin";
  canvasEl.style.cursor = adminMode === "move" ? "grab" : "crosshair";
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
  // Middle/right click always pans, left click pans only in move mode
  if (e.button === 1 || e.button === 2 || (e.button === 0 && adminMode === "move")) {
    mouseDrag = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY, moved: false };
    e.preventDefault();
  }
});

window.addEventListener("mousemove", (e) => {
  if (mouseDrag) {
    const dx = e.clientX - mouseDrag.startX;
    const dy = e.clientY - mouseDrag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mouseDrag.moved = true;
    panX = mouseDrag.startPanX - dx;
    panY = mouseDrag.startPanY - dy;
    updateViewport();
    return;
  }
  const rect = canvasContainer.getBoundingClientRect();
  const px = Math.floor((panX + e.clientX - rect.left - CANVAS_PAD_H) / zoomLevel);
  const py = Math.floor((panY + e.clientY - rect.top  - CANVAS_PAD_H) / zoomLevel);
  coordsText.textContent = (px >= 0 && px < canvasSize.width && py >= 0 && py < canvasSize.height)
    ? `(${px}, ${py})` : "—";
});

window.addEventListener("mouseup", () => { mouseDrag = null; });
canvasContainer.addEventListener("contextmenu", (e) => e.preventDefault());

canvasContainer.addEventListener("click", (e) => {
  if (e.button === 0 && adminMode === "draw") handlePixelTap(e.clientX, e.clientY);
});

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
