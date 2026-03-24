// =============================================================================
// CONTROLLER — script.js
// =============================================================================

const ws = new WebSocket(`ws://${location.host}`);

function send(type, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

// =============================================================================
// REFERENCES DOM
// =============================================================================

// Join screen
const screenJoin = document.getElementById("screen-join");
const screenIdReveal = document.getElementById("screen-id-reveal");
const screenGame = document.getElementById("screen-game");
const pseudoInput = document.getElementById("pseudo");
const btnJoin = document.getElementById("btn-join");
const reconnectInput = document.getElementById("reconnect-id");
const btnReconnect = document.getElementById("btn-reconnect");
const joinError = document.getElementById("join-error");
const revealId = document.getElementById("reveal-id");
const btnContinue = document.getElementById("btn-continue");
const btnCopyId = document.getElementById("btn-copy-id");
const btnSmsId = document.getElementById("btn-sms-id");

// Game screen
const displayPseudo = document.getElementById("display-pseudo");
const displayId = document.getElementById("display-id");
const displayTeam = document.getElementById("display-team");
const gameError = document.getElementById("game-error");

// Canvas
const canvasContainer = document.getElementById("canvas-container");
const canvasViewport = document.getElementById("canvas-viewport");
const canvasEl = document.getElementById("pixel-canvas");
const ctx = canvasEl.getContext("2d");
const pixelCursor = document.getElementById("pixel-cursor");
const coordsText = document.getElementById("coords-text");
const btnZoomIn = document.getElementById("btn-zoom-in");
const btnZoomOut = document.getElementById("btn-zoom-out");
const zoomLevelEl = document.getElementById("zoom-level");

// Palette & confirm
const paletteEl = document.getElementById("palette");
const btnConfirmPixel = document.getElementById("btn-confirm-pixel");

// Cooldown
const cooldownBar = document.getElementById("cooldown-bar");
const cooldownFill = document.getElementById("cooldown-fill");
const cooldownText = document.getElementById("cooldown-text");

// Tabs
const tabs = document.querySelectorAll(".tab");
const tabCanvas = document.getElementById("tab-canvas");
const tabTeam = document.getElementById("tab-team");

// Team — vue generale
const tabTeamDetail = document.getElementById("tab-team-detail");
const myTeamBanner = document.getElementById("my-team-banner");
const bannerDot = document.getElementById("banner-dot");
const bannerName = document.getElementById("banner-name");
const btnToggleCreate = document.getElementById("btn-toggle-create");
const createTeamForm = document.getElementById("create-team-form");
const teamNameInput = document.getElementById("team-name");
const teamColorPicker = document.getElementById("team-color-picker");
const btnCreateTeam = document.getElementById("btn-create-team");
const teamSearchInput = document.getElementById("team-search");
const teamsListEl = document.getElementById("teams-list");

// Team — vue detail
const btnBackTeams = document.getElementById("btn-back-teams");
const detailTeamDot = document.getElementById("detail-team-dot");
const detailTeamName = document.getElementById("detail-team-name");
const detailTeamStats = document.getElementById("detail-team-stats");
const detailMembersList = document.getElementById("detail-members-list");
const btnDetailJoin = document.getElementById("btn-detail-join");
const btnDetailLeave = document.getElementById("btn-detail-leave");

// =============================================================================
// ETAT LOCAL
// =============================================================================

let playerId = null;
let selectedColor = null;
let selectedPixel = null; // { x, y }
let cooldownEnd = 0;
let cooldownDuration = 30000;
let canvasData = null;
let canvasSize = { width: 200, height: 200 };
let palette = [];
let allTeams = {};
let myTeamId = null;
let selectedTeamColor = "#3690EA";
let detailTeamId = null;
let isCreator = false;

// Zoom/pan state
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let MIN_ZOOM = 1; // recalcule dynamiquement (entier) pour que le canvas remplisse le container
const MAX_ZOOM = 20;

// =============================================================================
// LOCAL STORAGE — AUTO-RECONNEXION
// =============================================================================

const savedId = localStorage.getItem("pixelwar_playerId");
if (savedId) {
  reconnectInput.value = savedId;
  // Activer le style "primary" sur le bouton reconnect
  btnReconnect.classList.add("highlight");
  btnReconnect.classList.remove("btn-secondary");
  btnReconnect.classList.add("btn-primary");
}

// =============================================================================
// BOUTON RECONNECT : devient primary quand 5 chars
// =============================================================================

reconnectInput.addEventListener("input", () => {
  const val = reconnectInput.value.trim();
  if (val.length === 5) {
    btnReconnect.classList.add("highlight");
    btnReconnect.classList.remove("btn-secondary");
    btnReconnect.classList.add("btn-primary");
  } else {
    btnReconnect.classList.remove("highlight");
    btnReconnect.classList.remove("btn-primary");
    btnReconnect.classList.add("btn-secondary");
  }
  // Reset error
  joinError.classList.add("hidden");
});

// =============================================================================
// TABS — toujours en haut
// =============================================================================

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    tabCanvas.classList.toggle("hidden", target !== "canvas");
    // En quittant l'onglet equipe, fermer le detail si ouvert
    if (target !== "team") {
      tabTeamDetail.classList.add("hidden");
      detailTeamId = null;
    }
    tabTeam.classList.toggle("hidden", target !== "team");
  });
});

// =============================================================================
// ERREURS IN-GAME
// =============================================================================

function showJoinError(msg) {
  joinError.textContent = msg;
  joinError.classList.remove("hidden");
  setTimeout(() => joinError.classList.add("hidden"), 5000);
}

let gameErrorTimeout = null;
function showGameError(msg) {
  gameError.textContent = msg;
  gameError.classList.remove("hidden");
  if (gameErrorTimeout) clearTimeout(gameErrorTimeout);
  gameErrorTimeout = setTimeout(() => gameError.classList.add("hidden"), 4000);
}

// =============================================================================
// REJOINDRE / RECONNECTER
// =============================================================================

btnJoin.addEventListener("click", () => {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) {
    pseudoInput.style.borderColor = "#e94560";
    pseudoInput.focus();
    return;
  }
  send("join", { pseudo });
});

btnReconnect.addEventListener("click", () => {
  const id = reconnectInput.value.trim().toUpperCase();
  if (!id || id.length !== 5) {
    reconnectInput.style.borderColor = "#e94560";
    reconnectInput.focus();
    return;
  }
  send("reconnect", { playerId: id });
});

pseudoInput.addEventListener("keydown", (e) => { if (e.key === "Enter") btnJoin.click(); });
reconnectInput.addEventListener("keydown", (e) => { if (e.key === "Enter") btnReconnect.click(); });

// ID reveal screen — continuer
btnContinue.addEventListener("click", () => {
  screenIdReveal.classList.add("hidden");
  screenGame.classList.remove("hidden");
});

// Copier l'ID dans le presse-papier
function copyIdToClipboard(id) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(id).then(() => {
      btnCopyId.textContent = "Copie !";
      setTimeout(() => { btnCopyId.textContent = "Copier l'ID"; }, 1500);
    });
  }
}

btnCopyId.addEventListener("click", () => {
  const id = revealId.textContent.trim();
  if (id && id !== "-----") copyIdToClipboard(id);
});

// Cliquer sur l'ID en jeu pour le copier
displayId.addEventListener("click", () => {
  const id = displayId.textContent.trim();
  if (!id || id === "—") return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(id).then(() => {
      const orig = displayId.textContent;
      displayId.textContent = "✓";
      setTimeout(() => { displayId.textContent = orig; }, 1000);
    });
  }
});

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
    if (["#FFFFFF", "#D4D7D9"].includes(color)) {
      btn.style.border = "2px solid #555";
    }
    btn.addEventListener("click", () => {
      document.querySelectorAll(".palette-color").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedColor = color;
      updateConfirmButton();
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
        imageData.data[idx] = parseInt(color.slice(1, 3), 16);
        imageData.data[idx + 1] = parseInt(color.slice(3, 5), 16);
        imageData.data[idx + 2] = parseInt(color.slice(5, 7), 16);
        imageData.data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function updatePixel(x, y, color) {
  if (canvasData) canvasData[y][x] = color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const img = ctx.createImageData(1, 1);
  img.data[0] = r; img.data[1] = g; img.data[2] = b; img.data[3] = 255;
  ctx.putImageData(img, x, y);
}

// =============================================================================
// CANVAS — ZOOM & PAN
// =============================================================================

function updateViewport() {
  const containerRect = canvasContainer.getBoundingClientRect();
  const containerSize = containerRect.width;

  // Zoom minimum exact : le canvas remplit pile le container, maxPan = 0
  MIN_ZOOM = containerSize / canvasSize.width;
  if (zoomLevel < MIN_ZOOM) zoomLevel = MIN_ZOOM;

  // La taille du canvas dans le viewport
  const scaledSize = canvasSize.width * zoomLevel;

  canvasEl.style.width = scaledSize + "px";
  canvasEl.style.height = scaledSize + "px";

  canvasViewport.style.width = scaledSize + "px";
  canvasViewport.style.height = scaledSize + "px";

  // Limiter le pan
  const maxPan = Math.max(0, scaledSize - containerSize);
  panX = Math.max(0, Math.min(panX, maxPan));
  panY = Math.max(0, Math.min(panY, maxPan));

  canvasViewport.style.transform = `translate(${-panX}px, ${-panY}px)`;
  const displayZoom = Math.round(zoomLevel / MIN_ZOOM);
  zoomLevelEl.textContent = `${displayZoom}x`;

  // Mettre a jour le curseur de selection
  updatePixelCursor();
}

btnZoomIn.addEventListener("click", () => {
  if (zoomLevel < MAX_ZOOM) {
    const containerRect = canvasContainer.getBoundingClientRect();
    const centerX = panX + containerRect.width / 2;
    const centerY = panY + containerRect.height / 2;

    const oldZoom = zoomLevel;
    // Sauter au prochain palier (displayZoom + 1) * MIN_ZOOM
    const currentDisplay = Math.round(zoomLevel / MIN_ZOOM);
    zoomLevel = Math.min(MAX_ZOOM, MIN_ZOOM * (currentDisplay + 1));

    panX = centerX * (zoomLevel / oldZoom) - containerRect.width / 2;
    panY = centerY * (zoomLevel / oldZoom) - containerRect.height / 2;

    updateViewport();
  }
});

btnZoomOut.addEventListener("click", () => {
  if (zoomLevel > MIN_ZOOM) {
    const containerRect = canvasContainer.getBoundingClientRect();
    const centerX = panX + containerRect.width / 2;
    const centerY = panY + containerRect.height / 2;

    const oldZoom = zoomLevel;
    // Revenir au palier precedent (displayZoom - 1) * MIN_ZOOM, minimum MIN_ZOOM
    const currentDisplay = Math.round(zoomLevel / MIN_ZOOM);
    zoomLevel = Math.max(MIN_ZOOM, MIN_ZOOM * (currentDisplay - 1));

    panX = centerX * (zoomLevel / oldZoom) - containerRect.width / 2;
    panY = centerY * (zoomLevel / oldZoom) - containerRect.height / 2;

    updateViewport();
  }
});

// Pan par touch/souris
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartPanX = 0;
let panStartPanY = 0;
let panMoved = false;

canvasContainer.addEventListener("pointerdown", (e) => {
  isPanning = true;
  panMoved = false;
  panStartX = e.clientX;
  panStartY = e.clientY;
  panStartPanX = panX;
  panStartPanY = panY;
  canvasContainer.setPointerCapture(e.pointerId);
});

canvasContainer.addEventListener("pointermove", (e) => {
  if (!isPanning) return;
  const dx = e.clientX - panStartX;
  const dy = e.clientY - panStartY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMoved = true;

  panX = panStartPanX - dx;
  panY = panStartPanY - dy;
  updateViewport();
});

canvasContainer.addEventListener("pointerup", (e) => {
  if (!panMoved && isPanning) {
    // C'est un clic, pas un pan → selectionner un pixel
    handlePixelClick(e);
  }
  isPanning = false;
});

// Pinch-to-zoom
let lastPinchDist = 0;
canvasContainer.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastPinchDist = Math.sqrt(dx * dx + dy * dy);
  }
}, { passive: true });

canvasContainer.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = dist / lastPinchDist;

    if ((scale > 1.02 && zoomLevel < MAX_ZOOM) || (scale < 0.98 && zoomLevel > MIN_ZOOM)) {
      // Point milieu entre les deux doigts dans le container
      const rect = canvasContainer.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      // Point correspondant sur le canvas avant zoom
      const focusX = panX + midX;
      const focusY = panY + midY;

      const oldZoom = zoomLevel;
      zoomLevel = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel * scale));

      // Ajuster le pan pour que le point reste sous les doigts
      panX = focusX * (zoomLevel / oldZoom) - midX;
      panY = focusY * (zoomLevel / oldZoom) - midY;

      updateViewport();
    }
    lastPinchDist = dist;
  }
}, { passive: true });

// =============================================================================
// SELECTION D'UN PIXEL (clic → selectionner, puis couleur, puis confirmer)
// =============================================================================

function handlePixelClick(e) {
  const rect = canvasContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left + panX;
  const clickY = e.clientY - rect.top + panY;

  const pixelX = Math.floor(clickX / zoomLevel);
  const pixelY = Math.floor(clickY / zoomLevel);

  if (pixelX >= 0 && pixelX < canvasSize.width && pixelY >= 0 && pixelY < canvasSize.height) {
    selectedPixel = { x: pixelX, y: pixelY };
    coordsText.textContent = `(${pixelX}, ${pixelY})`;
    updatePixelCursor();
    updateConfirmButton();
  }
}

function updatePixelCursor() {
  if (!selectedPixel) {
    pixelCursor.classList.add("hidden");
    return;
  }
  pixelCursor.classList.remove("hidden");
  const size = zoomLevel;
  pixelCursor.style.width = size + "px";
  pixelCursor.style.height = size + "px";
  pixelCursor.style.left = selectedPixel.x * zoomLevel + "px";
  pixelCursor.style.top = selectedPixel.y * zoomLevel + "px";

  // Colorer le curseur avec la couleur selectionnee
  if (selectedColor) {
    pixelCursor.style.background = selectedColor + "66";
  } else {
    pixelCursor.style.background = "transparent";
  }
}

function updateConfirmButton() {
  if (selectedPixel && selectedColor) {
    btnConfirmPixel.classList.remove("hidden");
    btnConfirmPixel.disabled = false;
    btnConfirmPixel.textContent = `Placer en (${selectedPixel.x}, ${selectedPixel.y})`;
    btnConfirmPixel.style.background = selectedColor;
    // Texte noir ou blanc selon la luminosite de la couleur
    const r = parseInt(selectedColor.slice(1, 3), 16);
    const g = parseInt(selectedColor.slice(3, 5), 16);
    const b = parseInt(selectedColor.slice(5, 7), 16);
    const lum = (r * 299 + g * 587 + b * 114) / 1000;
    btnConfirmPixel.style.color = lum > 150 ? "#000" : "#fff";
  } else if (selectedPixel) {
    btnConfirmPixel.classList.remove("hidden");
    btnConfirmPixel.disabled = true;
    btnConfirmPixel.textContent = "Choisis une couleur";
    btnConfirmPixel.style.background = "#555";
    btnConfirmPixel.style.color = "#fff";
  } else {
    btnConfirmPixel.classList.remove("hidden");
    btnConfirmPixel.disabled = true;
    btnConfirmPixel.textContent = "Selectionne un pixel";
    btnConfirmPixel.style.background = "#555";
    btnConfirmPixel.style.color = "#fff";
  }
}

btnConfirmPixel.addEventListener("click", () => {
  if (!selectedPixel || !selectedColor || !playerId) return;
  send("placePixel", { x: selectedPixel.x, y: selectedPixel.y, color: selectedColor });
});

// =============================================================================
// COOLDOWN
// =============================================================================

let cooldownInterval = null;

function startCooldown(endTime, duration) {
  cooldownEnd = endTime;
  cooldownDuration = duration;
  cooldownBar.classList.remove("ready");

  // Reset la selection apres un placement reussi
  selectedPixel = null;
  pixelCursor.classList.add("hidden");
  updateConfirmButton();

  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    const remaining = cooldownEnd - Date.now();
    if (remaining <= 0) {
      clearInterval(cooldownInterval);
      cooldownFill.style.width = "100%";
      cooldownBar.classList.add("ready");
      cooldownText.textContent = "Pret !";
      return;
    }
    cooldownFill.style.width = `${(1 - remaining / cooldownDuration) * 100}%`;
    cooldownText.textContent = `${Math.ceil(remaining / 1000)}s`;
  }, 200);
}

// =============================================================================
// EQUIPES — UI
// =============================================================================

const teamColors = [
  "#FF4500", "#FF0000", "#BE0039", "#FFA800", "#FFD635",
  "#00A368", "#00CC78", "#009EAA", "#3690EA", "#2450A4",
  "#493AC1", "#811E9F", "#FF3881", "#FFFFFF", "#000000",
];

teamColors.forEach((color) => {
  const btn = document.createElement("div");
  btn.className = "team-color-option";
  btn.style.background = color;
  if (color === selectedTeamColor) btn.classList.add("selected");
  btn.addEventListener("click", () => {
    document.querySelectorAll(".team-color-option").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTeamColor = color;
  });
  teamColorPicker.appendChild(btn);
});

// Toggle formulaire creation
btnToggleCreate.addEventListener("click", () => {
  createTeamForm.classList.toggle("hidden");
  btnToggleCreate.textContent = createTeamForm.classList.contains("hidden")
    ? "+ Creer une equipe"
    : "− Annuler";
});

btnCreateTeam.addEventListener("click", () => {
  const name = teamNameInput.value.trim();
  if (!name) { teamNameInput.style.borderColor = "#e94560"; return; }
  send("createTeam", { name, color: selectedTeamColor });
  createTeamForm.classList.add("hidden");
  btnToggleCreate.textContent = "+ Creer une equipe";
  teamNameInput.value = "";
});

// Recherche d'equipes
teamSearchInput.addEventListener("input", () => {
  send("searchTeams", { query: teamSearchInput.value.trim() });
});

// =============================================================================
// EQUIPES — LISTE GENERALE
// =============================================================================

function renderTeamsList(teamsData) {
  let teamArray = Array.isArray(teamsData) ? teamsData : Object.values(teamsData);
  teamArray.sort((a, b) => (b.pixelCount || 0) - (a.pixelCount || 0));

  if (teamArray.length === 0) {
    teamsListEl.innerHTML = '<p class="muted">Aucune equipe pour l\'instant</p>';
    return;
  }

  teamsListEl.innerHTML = "";
  teamArray.forEach((team) => {
    const item = document.createElement("div");
    item.className = "team-item";
    const isMine = team.id === myTeamId;
    item.innerHTML = `
      <div class="team-dot" style="background: ${team.color}"></div>
      <div class="team-item-info">
        <div class="team-item-name">${team.name}${isMine ? ' <span class="member-role">Mon equipe</span>' : ""}</div>
        <div class="team-item-stats">${team.memberCount} membre${team.memberCount > 1 ? "s" : ""} · ${team.pixelCount || 0} px</div>
      </div>
      <span style="font-size:0.8rem; opacity:0.4;">›</span>
    `;
    item.addEventListener("click", () => showTeamDetail(team.id));
    teamsListEl.appendChild(item);
  });
}

// =============================================================================
// EQUIPES — VUE DETAIL
// =============================================================================

function showTeamDetail(teamId) {
  detailTeamId = teamId;
  const team = allTeams[teamId];
  if (!team) return;

  detailTeamDot.style.background = team.color;
  detailTeamName.textContent = team.name;
  detailTeamStats.textContent = `${team.memberCount} membre${team.memberCount > 1 ? "s" : ""} · ${team.pixelCount || 0} px`;

  // Membres
  detailMembersList.innerHTML = "";
  const amCreator = team.creatorId === playerId;
  if (team.members) {
    team.members.forEach((member) => {
      const el = document.createElement("div");
      el.className = "member-item";
      let kickBtn = "";
      if (amCreator && member.id !== playerId) {
        kickBtn = `<button class="btn-kick" data-id="${member.id}">Exclure</button>`;
      }
      let roleTag = member.isCreator ? `<span class="member-role">Chef</span>` : "";
      el.innerHTML = `
        <div class="member-status ${member.active ? "active" : "inactive"}"></div>
        <span class="member-name">${member.pseudo}${member.id === playerId ? " (moi)" : ""}</span>
        ${roleTag}
        ${kickBtn}
      `;
      const kickBtnEl = el.querySelector(".btn-kick");
      if (kickBtnEl) {
        kickBtnEl.addEventListener("click", () => send("kickMember", { targetId: member.id }));
      }
      detailMembersList.appendChild(el);
    });
  }

  // Boutons join/leave
  const isMine = teamId === myTeamId;
  btnDetailJoin.classList.toggle("hidden", isMine);
  btnDetailLeave.classList.toggle("hidden", !isMine);
  btnDetailJoin.textContent = myTeamId ? "Changer pour cette equipe" : "Rejoindre";

  // Afficher le detail
  tabTeam.classList.add("hidden");
  tabTeamDetail.classList.remove("hidden");
}

btnBackTeams.addEventListener("click", () => {
  tabTeamDetail.classList.add("hidden");
  tabTeam.classList.remove("hidden");
  detailTeamId = null;
});

btnDetailJoin.addEventListener("click", () => {
  if (detailTeamId) send("joinTeam", { teamId: detailTeamId });
});

btnDetailLeave.addEventListener("click", () => {
  send("leaveTeam", {});
});

// =============================================================================
// EQUIPES — BANDEAU + PLAYER BAR
// =============================================================================

// Clic sur le bandeau → ouvre le detail de mon equipe
myTeamBanner.addEventListener("click", () => {
  if (myTeamId && allTeams[myTeamId]) showTeamDetail(myTeamId);
});

function updateTeamUI() {
  if (myTeamId && allTeams[myTeamId]) {
    const team = allTeams[myTeamId];
    isCreator = team.creatorId === playerId;

    bannerDot.style.background = team.color;
    bannerName.textContent = team.name;
    // Fond teinté avec la couleur de l'equipe via CSS custom properties
    myTeamBanner.style.setProperty("--team-color-bg", team.color + "22");
    myTeamBanner.style.setProperty("--team-color-border", team.color + "66");
    myTeamBanner.style.setProperty("--team-color-text", team.color);
    myTeamBanner.style.cursor = "pointer";

    displayTeam.textContent = team.name;
    displayTeam.style.background = team.color + "33";
    displayTeam.style.color = team.color;
  } else {
    isCreator = false;
    bannerDot.style.background = "#ccc";
    bannerName.textContent = "Pas d'equipe";
    myTeamBanner.style.setProperty("--team-color-bg", "#f5f5f5");
    myTeamBanner.style.setProperty("--team-color-border", "#ddd");
    myTeamBanner.style.setProperty("--team-color-text", "#999");
    myTeamBanner.style.cursor = "default";

    displayTeam.textContent = "Solo";
    displayTeam.style.background = "#00000010";
    displayTeam.style.color = "#888";
  }

  // Rafraichir le detail si ouvert
  if (detailTeamId && allTeams[detailTeamId]) {
    showTeamDetail(detailTeamId);
  }
}

// =============================================================================
// RECEPTION DES MESSAGES
// =============================================================================

ws.addEventListener("message", (event) => {
  const { type, data } = JSON.parse(event.data);

  // --- Init ---
  if (type === "init") {
    canvasSize = data.canvasSize;
    renderCanvas(data.canvas);
    buildPalette(data.palette);
    allTeams = data.teams;
    renderTeamsList(data.teams);
    updateViewport();

    // Auto-reconnexion si on a un ID sauvegarde
    if (savedId && !playerId) {
      send("reconnect", { playerId: savedId });
    }
  }

  // --- Joined (nouveau ou reconnecte) ---
  if (type === "joined") {
    playerId = data.playerId;
    cooldownDuration = data.cooldown;
    canvasSize = data.canvasSize;

    // Sauvegarder l'ID en localStorage
    localStorage.setItem("pixelwar_playerId", data.playerId);

    displayPseudo.textContent = data.pseudo;
    displayId.textContent = data.playerId;

    if (data.teamId) myTeamId = data.teamId;
    updateTeamUI();

    if (data.palette) buildPalette(data.palette);

    // Cooldown pret
    cooldownBar.classList.add("ready");
    cooldownText.textContent = "Pret !";
    cooldownFill.style.width = "100%";

    // Si c'est un nouveau joueur (pas une reconnexion), montrer l'ecran ID
    if (!screenGame.classList.contains("hidden") || screenIdReveal.classList.contains("hidden") === false) {
      // Deja en jeu ou deja sur l'ecran reveal → juste passer au jeu
      screenJoin.classList.add("hidden");
      screenIdReveal.classList.add("hidden");
      screenGame.classList.remove("hidden");
    } else if (reconnectInput.value.trim().toUpperCase() === data.playerId) {
      // C'est une reconnexion → direct au jeu
      screenJoin.classList.add("hidden");
      screenGame.classList.remove("hidden");
    } else {
      // Nouveau joueur → montrer l'ID
      revealId.textContent = data.playerId;
      // Lien SMS avec l'ID pre-rempli
      const smsBody = encodeURIComponent(`Mon ID Pixel War : ${data.playerId}`);
      btnSmsId.href = `sms:?body=${smsBody}`;
      screenJoin.classList.add("hidden");
      screenIdReveal.classList.remove("hidden");
    }

    updateViewport();
  }

  // --- Erreur de join/reconnexion (in-game) ---
  if (type === "joinError") {
    showJoinError(data.message);
  }

  // --- Erreur generique in-game ---
  if (type === "gameError") {
    showGameError(data.message);
  }

  // --- Pixel place ---
  if (type === "pixelPlaced") {
    updatePixel(data.x, data.y, data.color);
    startCooldown(data.nextPlacement, data.cooldown);
  }

  // --- Pixel update (d'un autre joueur) ---
  if (type === "pixelUpdate") {
    updatePixel(data.x, data.y, data.color);
  }

  // --- Cooldown error ---
  if (type === "cooldownError") {
    showGameError(data.message);
  }

  // --- Leaderboard ---
  if (type === "leaderboard") {
    // Pas utilise cote controller pour l'instant
  }

  // --- Team joined ---
  if (type === "teamJoined") {
    myTeamId = data.teamId;
    if (data.team) allTeams[data.teamId] = data.team;
    updateTeamUI();
    teamNameInput.value = "";
  }

  // --- Team left ---
  if (type === "teamLeft") {
    myTeamId = null;
    updateTeamUI();
  }

  // --- Kicked ---
  if (type === "kicked") {
    myTeamId = null;
    updateTeamUI();
    showGameError(`Vous avez ete exclu de l'equipe "${data.teamName}"`);
  }

  // --- Teams update ---
  if (type === "teamsUpdate") {
    allTeams = data;
    renderTeamsList(data);
    updateTeamUI();
  }

  // --- Search results ---
  if (type === "searchResults") {
    renderTeamsList(data.teams);
  }

  // --- State (full refresh) ---
  if (type === "state") {
    canvasSize = data.canvasSize;
    renderCanvas(data.canvas);
    if (data.palette) buildPalette(data.palette);
    allTeams = data.teams;
    renderTeamsList(data.teams);
    updateTeamUI();
    updateViewport();
  }
});

// =============================================================================
// DECONNEXION
// =============================================================================

ws.addEventListener("close", () => {
  console.log("Connexion perdue. Rechargez la page.");
});

// =============================================================================
// INIT VIEWPORT AU CHARGEMENT
// =============================================================================

window.addEventListener("load", () => {
  const containerRect = canvasContainer.getBoundingClientRect();
  zoomLevel = containerRect.width / canvasSize.width;
  updateViewport();
  updateConfirmButton();
});