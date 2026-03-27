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
const modalOnboarding      = document.getElementById("modal-onboarding");
const btnOnboardingNext    = document.getElementById("btn-onboarding-next");
const btnOnboardingPrev    = document.getElementById("btn-onboarding-prev");
const btnOnboardingSkip    = document.getElementById("btn-onboarding-skip");
const onboardingStepEls    = document.querySelectorAll(".onboarding-step");
const onboardingDotEls     = document.querySelectorAll(".onboarding-dot");

// Game screen
const displayPseudo      = document.getElementById("display-pseudo");
const displayPoints      = document.getElementById("display-points");
const displayId          = document.getElementById("display-id");
const profilePseudo      = document.getElementById("profile-pseudo");
const displayPointsProfile = document.getElementById("display-points-profile");
const btnCopyDisplayId   = document.getElementById("btn-copy-display-id");
const displayTeam = document.getElementById("display-team");
const displayTeamDot = document.getElementById("display-team-dot");
const displayTeamText = document.getElementById("display-team-text");
const gameError = document.getElementById("game-error");

// Canvas
const canvasContainer = document.getElementById("canvas-container");
const canvasViewport = document.getElementById("canvas-viewport");
const canvasEl = document.getElementById("pixel-canvas");
const ctx = canvasEl.getContext("2d");
const pixelCursor = document.getElementById("pixel-cursor");
const coordsText = document.getElementById("coords-text");
const pixelPlacerText = document.getElementById("pixel-placer-text");
const btnZoomIn = document.getElementById("btn-zoom-in");
const btnZoomOut = document.getElementById("btn-zoom-out");
const zoomLevelEl = document.getElementById("zoom-level");
const btnToggleOverlay = document.getElementById("btn-toggle-overlay");
const memberOverlayControls = document.getElementById("member-overlay-controls");
const memberOpacitySlider = document.getElementById("member-opacity-slider");

// Overlay
const overlayImg   = document.getElementById("overlay-img");
const overlayGuide = document.getElementById("overlay-guide");
const overlayEditBar = document.getElementById("overlay-edit-bar");
const overlayOpacitySlider = document.getElementById("overlay-opacity-slider");
const btnOverlayScaleDown = document.getElementById("btn-overlay-scale-down");
const btnOverlayScaleUp = document.getElementById("btn-overlay-scale-up");
const btnOverlayCancel = document.getElementById("btn-overlay-cancel");
const btnOverlayConfirm = document.getElementById("btn-overlay-confirm");
const overlayFileInput = document.getElementById("overlay-file-input");
const overlaySection = document.getElementById("overlay-section");

// Crop modal
const modalCrop = document.getElementById("modal-crop");
const cropImg = document.getElementById("crop-img");
const cropBox = document.getElementById("crop-box");
const btnCropCancel = document.getElementById("btn-crop-cancel");
const btnCropConfirm = document.getElementById("btn-crop-confirm");
const overlayPreviewRow = document.getElementById("overlay-preview-row");
const overlayThumbnail = document.getElementById("overlay-thumbnail");
const btnOverlayAdd = document.getElementById("btn-overlay-add");
const btnOverlayDelete = document.getElementById("btn-overlay-delete");
const bottomSheet = document.getElementById("bottom-sheet");
const sheetHandleEl = document.querySelector(".sheet-handle");

// Palette & confirm
const paletteEl = document.getElementById("palette");
const btnConfirmPixel = document.getElementById("btn-confirm-pixel");

// Cooldown (removed from header, now in bottom sheet)

// Powers
const displayGold        = document.getElementById("display-gold");
const btnPowers          = document.getElementById("btn-powers");
const powersMenu         = document.getElementById("powers-menu");
const powersGoldCount    = document.getElementById("powers-gold-count");
const powersDiamondCount = document.getElementById("powers-diamond-count");
const powersDiamondWrap  = document.getElementById("powers-diamond-wrap");
const powersTeamSection  = document.getElementById("powers-team-section");
const btnPowersClose     = document.getElementById("btn-powers-close");

// Timer bars
const sheetTimerBar   = document.getElementById("sheet-timer-bar");
const sheetTimerFill  = document.getElementById("sheet-timer-fill");
const sheetTimerText  = document.getElementById("sheet-timer-text");
const sheetBuffBar    = document.getElementById("sheet-buff-bar");
const sheetBuffFill   = document.getElementById("sheet-buff-fill");
const sheetBuffText   = document.getElementById("sheet-buff-text");

// Toast
const toastContainer = document.getElementById("toast-container");

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

// Avatar picker
const createAvatarPreview = document.getElementById("create-avatar-preview");
const btnAvatarEmoji       = document.getElementById("btn-avatar-emoji");
const btnAvatarImage       = document.getElementById("btn-avatar-image");
const btnAvatarReset       = document.getElementById("btn-avatar-reset");
const emojiPickerGrid      = document.getElementById("emoji-picker-grid");
const avatarFileInput      = document.getElementById("avatar-file-input");

// Team — vue detail
const btnBackTeams = document.getElementById("btn-back-teams");
const detailTeamDot = document.getElementById("detail-team-dot");
const detailTeamName = document.getElementById("detail-team-name");
const detailTeamStats = document.getElementById("detail-team-stats");
const detailMembersList = document.getElementById("detail-members-list");
const btnDetailJoin = document.getElementById("btn-detail-join");
const btnDetailLeave = document.getElementById("btn-detail-leave");
const btnDetailInvite = document.getElementById("btn-detail-invite");

// Modal Invite
const modalInvite = document.getElementById("modal-invite");
const btnInviteClose = document.getElementById("btn-invite-close");
const modalInviteTeamName = document.getElementById("modal-invite-team-name");
const inviteQrEl = document.getElementById("invite-qr");
const inviteUrlEl = document.getElementById("invite-url");

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
let createAvatarData = null; // { type: 'emoji'|'image', value } or null

// Overlay state
let overlayVisible = true;         // toggle local (membre)
let overlayEditMode = false;       // leader en train d'editer
let overlayDraft = null;           // { imageData, x, y, scale, opacity } pendant edition
let overlayConfirmed = null;       // dernier etat confirme (pour annulation)
let isCreator = false;
let localOverlayOpacity = null;    // opacite locale du membre (null = utiliser celle du serveur)

// Powers state
let goldPixels = 0;
let diamondPixels = 0;
let activePower = null;  // null | "bomb" | "colorReplace"
let bombPreview = null;  // { x, y } position du carre 5x5
let colorReplacePreview = null; // { x, y }
let colorReplaceTarget = null;  // couleur cible selectionnee
let colorReplaceStep = "target"; // "target" | "new" | "position"
let rafaleEndsAt = 0;
let teamAccelEndsAt = 0;
let powersMenuOpen = false;

// Zoom/pan state
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let MIN_ZOOM = 1;          // zoom minimum reel (avec bordure blanche)
let CANVAS_FILL_ZOOM = 1;  // zoom ou le canvas touche les bords de l'ecran (reference "1x")
const MAX_ZOOM = 20;

// Bordure blanche autour du canvas (en CSS pixels, fixe quel que soit le zoom)
const CANVAS_PAD_H = 100;        // gauche, droite, haut
const CANVAS_PAD_BOTTOM = 200;   // bas (pour acceder aux pixels sous la sheet)

// =============================================================================
// LOCAL STORAGE — AUTO-RECONNEXION
// =============================================================================

const savedId = localStorage.getItem("pixelwar_playerId");
if (savedId) {
  reconnectInput.value = savedId;
  // Activer le style rempli sur le bouton reconnect
  btnReconnect.classList.remove("btn-outlined");
  btnReconnect.classList.add("btn-black");
}

// =============================================================================
// BOUTON RECONNECT : devient primary quand 5 chars
// =============================================================================

reconnectInput.addEventListener("input", () => {
  const val = reconnectInput.value.trim();
  if (val.length === 5) {
    btnReconnect.classList.remove("btn-outlined");
    btnReconnect.classList.add("btn-black");
  } else {
    btnReconnect.classList.remove("btn-black");
    btnReconnect.classList.add("btn-outlined");
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

function showGameError(msg) {
  showToast(msg);
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
  initFillZoom();
  // Afficher la modale d'onboarding à la première connexion
  modalOnboarding.classList.remove("hidden");
});

let onboardingStep = 1;

function showOnboardingStep(step) {
  onboardingStep = step;
  onboardingStepEls.forEach((el, i) => el.classList.toggle("hidden", i + 1 !== step));
  onboardingDotEls.forEach((el, i) => el.classList.toggle("active", i + 1 === step));
  btnOnboardingPrev.classList.toggle("onboarding-hidden", step === 1);
  btnOnboardingNext.textContent = step === 3 ? "C'est parti !" : "Suivant →";
}

btnOnboardingNext.addEventListener("click", () => {
  if (onboardingStep < 3) {
    showOnboardingStep(onboardingStep + 1);
  } else {
    modalOnboarding.classList.add("hidden");
    showOnboardingStep(1);
  }
});

btnOnboardingPrev.addEventListener("click", () => {
  if (onboardingStep > 1) showOnboardingStep(onboardingStep - 1);
});

btnOnboardingSkip.addEventListener("click", () => {
  modalOnboarding.classList.add("hidden");
  showOnboardingStep(1);
});

// Copie universelle (fonctionne sans HTTPS)
function copyText(text, onSuccess) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess);
  } else {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    onSuccess();
  }
}

btnCopyId.addEventListener("click", () => {
  const id = revealId.textContent.trim();
  if (id && id !== "-----") {
    copyText(id, () => {
      btnCopyId.textContent = "Copie !";
      setTimeout(() => { btnCopyId.textContent = "Copier l'ID"; }, 1500);
    });
  }
});

// Bouton profil — copier l'ID
btnCopyDisplayId.addEventListener("click", () => {
  const id = displayId.textContent.trim();
  if (!id || id === "—") return;
  copyText(id, () => {
    const orig = displayId.textContent;
    displayId.textContent = "✓";
    setTimeout(() => { displayId.textContent = orig; }, 1000);
  });
});

// =============================================================================
// AVATAR D'EQUIPE
// =============================================================================

const TEAM_EMOJIS = [
  "🔥","⚡","🌊","🍀","🦁","🐺","🦊","🦅","🐉","🌙",
  "⭐","💎","🏆","🎯","🚀","⚔️","🛡️","🎨","🎭","🎪",
  "🌈","❄️","🌋","🎸","🎮","🏴","🦄","🐸","😈","💀",
  "🧨","🔮","🌸","🐲","👑","⚡","🍕","🤖","👾","🎃",
];

function buildEmojiPicker() {
  emojiPickerGrid.innerHTML = "";
  TEAM_EMOJIS.forEach((em) => {
    const btn = document.createElement("button");
    btn.className = "emoji-option";
    btn.type = "button";
    btn.textContent = em;
    btn.addEventListener("click", () => {
      createAvatarData = { type: "emoji", value: em };
      emojiPickerGrid.querySelectorAll(".emoji-option").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      emojiPickerGrid.classList.add("hidden");
      updateAvatarPreview();
    });
    emojiPickerGrid.appendChild(btn);
  });
}

function updateAvatarPreview() {
  applyAvatarToEl(createAvatarPreview, createAvatarData, selectedTeamColor);
}

function applyAvatarToEl(el, avatar, teamColor) {
  const color = teamColor || "#3690EA";
  el.style.backgroundImage = "";
  el.style.backgroundSize = "";
  el.style.backgroundPosition = "";
  el.textContent = "";
  if (!avatar) {
    el.style.backgroundColor = color;
  } else if (avatar.type === "emoji") {
    el.style.backgroundColor = color + "33";
    el.textContent = avatar.value;
  } else if (avatar.type === "image") {
    el.style.backgroundColor = color;
    el.style.backgroundImage = `url(${avatar.value})`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  }
}

function makeAvatarEl(team, size) {
  const el = document.createElement("div");
  el.className = "team-avatar";
  el.style.width = size + "px";
  el.style.height = size + "px";
  el.style.fontSize = Math.round(size * 0.55) + "px";
  applyAvatarToEl(el, team.avatar || null, team.color);
  return el;
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
      updateConfirmButton();
      if (activePower === "bomb") updatePowerOverlay();
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
        imageData.data[idx]     = 255;
        imageData.data[idx + 1] = 255;
        imageData.data[idx + 2] = 255;
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

let zoomInitialized = false;

// A appeler la premiere fois que l'ecran de jeu est affiche
function initFillZoom() {
  if (!zoomInitialized) {
    zoomInitialized = true;
    updateViewport();          // calcule CANVAS_FILL_ZOOM avec les vraies dimensions
    zoomLevel = CANVAS_FILL_ZOOM;
  }
  updateViewport();
}

function updateViewport() {
  const containerRect = canvasContainer.getBoundingClientRect();
  const cw = containerRect.width;
  const ch = containerRect.height;
  // Ecran cache → dimensions nulles, on ne calcule rien
  if (!cw || !ch) return;

  // Hauteur de la sheet (tenant compte de son translateY actuel si collapsed)
  const sheetMatrix = new DOMMatrix(getComputedStyle(bottomSheet).transform);
  const sheetTranslateY = sheetMatrix.m42 || 0;
  const sheetVisibleH = Math.max(0, bottomSheet.offsetHeight - sheetTranslateY);

  // Padding bas dynamique : assez grand pour que le bas du canvas remonte
  // au-dessus de la sheet quand on pan au maximum.
  // +8 : marge CSS bottom de la sheet ; +16 : clearance visuelle au-dessus de la sheet
  const SHEET_CLEARANCE = 24;
  const padBottom = Math.max(CANVAS_PAD_BOTTOM, sheetVisibleH + SHEET_CLEARANCE + 40);

  // Zoom ou le canvas touche exactement les bords (reference "1x" affiche)
  CANVAS_FILL_ZOOM = Math.min(cw / canvasSize.width, ch / canvasSize.height);

  // Zoom minimum reel : canvas + bordure tient dans le container
  const minZoomX = (cw - CANVAS_PAD_H * 2)          / canvasSize.width;
  const minZoomY = (ch - CANVAS_PAD_H - padBottom)   / canvasSize.height;
  MIN_ZOOM = Math.max(0.1, Math.min(minZoomX, minZoomY));
  if (zoomLevel < MIN_ZOOM) zoomLevel = MIN_ZOOM;

  const scaledW = canvasSize.width  * zoomLevel;
  const scaledH = canvasSize.height * zoomLevel;

  // Taille totale du monde (canvas + bordures blanches)
  const worldW = scaledW + CANVAS_PAD_H * 2;
  const worldH = scaledH + CANVAS_PAD_H + padBottom;

  canvasViewport.style.width  = worldW + "px";
  canvasViewport.style.height = worldH + "px";

  // Positionner le canvas dans le monde (offset = bordure)
  canvasEl.style.left   = CANVAS_PAD_H + "px";
  canvasEl.style.top    = CANVAS_PAD_H + "px";
  canvasEl.style.width  = scaledW + "px";
  canvasEl.style.height = scaledH + "px";

  // maxPanY : le bas du canvas doit apparaitre AVANT le bord de la sheet
  // (8px = marge CSS bottom de la sheet, 16px = clearance visuelle)
  const visibleH = ch - sheetVisibleH - SHEET_CLEARANCE;
  const overflowX = worldW - cw;
  const overflowY = CANVAS_PAD_H + scaledH - visibleH;
  if (overflowX <= 0) { panX = overflowX / 2; }
  else { panX = Math.max(0, Math.min(panX, overflowX)); }
  if (overflowY <= 0) { panY = overflowY / 2; }
  else { panY = Math.max(0, Math.min(panY, overflowY)); }

  canvasViewport.style.transform = `translate(${-panX}px, ${-panY}px)`;

  // Affichage : 1x = canvas bord a bord, valeurs decimales en dessous
  const ratio = zoomLevel / CANVAS_FILL_ZOOM;
  const displayZoom = ratio >= 1
    ? Math.round(ratio) + "x"
    : (Math.round(ratio * 10) / 10) + "x";
  zoomLevelEl.textContent = displayZoom;

  updatePixelCursor();
  refreshOverlayTransform();
  if (activePower) updatePowerOverlay();
}

function getZoomFocus() {
  const containerRect = canvasContainer.getBoundingClientRect();
  if (selectedPixel) {
    return {
      focusX: CANVAS_PAD_H + (selectedPixel.x + 0.5) * zoomLevel,
      focusY: CANVAS_PAD_H + (selectedPixel.y + 0.5) * zoomLevel,
      anchorX: containerRect.width / 2,
      anchorY: containerRect.height / 2,
    };
  }
  return {
    focusX: panX + containerRect.width / 2,
    focusY: panY + containerRect.height / 2,
    anchorX: containerRect.width / 2,
    anchorY: containerRect.height / 2,
  };
}

btnZoomIn.addEventListener("click", () => {
  const { focusX, focusY, anchorX, anchorY } = getZoomFocus();
  const oldZoom = zoomLevel;
  zoomLevel = Math.min(MAX_ZOOM, zoomLevel * 1.5);
  panX = CANVAS_PAD_H + (focusX - CANVAS_PAD_H) * (zoomLevel / oldZoom) - anchorX;
  panY = CANVAS_PAD_H + (focusY - CANVAS_PAD_H) * (zoomLevel / oldZoom) - anchorY;
  updateViewport();
});

btnZoomOut.addEventListener("click", () => {
  const { focusX, focusY, anchorX, anchorY } = getZoomFocus();
  const oldZoom = zoomLevel;
  zoomLevel = Math.max(MIN_ZOOM, zoomLevel / 1.5);
  panX = CANVAS_PAD_H + (focusX - CANVAS_PAD_H) * (zoomLevel / oldZoom) - anchorX;
  panY = CANVAS_PAD_H + (focusY - CANVAS_PAD_H) * (zoomLevel / oldZoom) - anchorY;
  updateViewport();
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
    isPanning = false;
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

    // Point milieu entre les deux doigts
    const rect = canvasContainer.getBoundingClientRect();
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomLevel * scale));
    if (newZoom !== zoomLevel) {
      // World position under the pinch midpoint
      const focusX = panX + midX;
      const focusY = panY + midY;
      const oldZoom = zoomLevel;
      zoomLevel = newZoom;
      // Keep the canvas pixel under the pinch midpoint fixed on screen.
      // Canvas is offset by CANVAS_PAD_H inside the world, so we must
      // scale around that offset rather than world origin.
      panX = CANVAS_PAD_H + (focusX - CANVAS_PAD_H) * (zoomLevel / oldZoom) - midX;
      panY = CANVAS_PAD_H + (focusY - CANVAS_PAD_H) * (zoomLevel / oldZoom) - midY;
      updateViewport();
    }
    lastPinchDist = dist; // toujours mis a jour
  }
}, { passive: true });

// Wheel zoom (desktop)
canvasContainer.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvasContainer.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const focusX = panX + mx;
  const focusY = panY + my;
  const oldZoom = zoomLevel;
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * factor));
  panX = CANVAS_PAD_H + (focusX - CANVAS_PAD_H) * (zoomLevel / oldZoom) - mx;
  panY = CANVAS_PAD_H + (focusY - CANVAS_PAD_H) * (zoomLevel / oldZoom) - my;
  updateViewport();
}, { passive: false });

// =============================================================================
// SELECTION D'UN PIXEL (clic → selectionner, puis couleur, puis confirmer)
// =============================================================================

function handlePixelClick(e) {
  const rect = canvasContainer.getBoundingClientRect();
  const clickX = e.clientX - rect.left + panX;
  const clickY = e.clientY - rect.top + panY;

  // Soustraire la bordure blanche pour obtenir les coordonnees canvas
  const pixelX = Math.floor((clickX - CANVAS_PAD_H) / zoomLevel);
  const pixelY = Math.floor((clickY - CANVAS_PAD_H) / zoomLevel);

  if (pixelX < 0 || pixelX >= canvasSize.width || pixelY < 0 || pixelY >= canvasSize.height) return;

  // Bombe : positionner le carre 5x5
  if (activePower === "bomb") {
    // Centrer le 5x5 sur le clic
    bombPreview = { x: pixelX - 2, y: pixelY - 2 };
    selectedPixel = { x: pixelX, y: pixelY };
    coordsText.textContent = `(${pixelX}, ${pixelY})`;
    updatePowerOverlay();
    updateConfirmButton();
    return;
  }

  // Remplacement couleur : positionner le 10x10
  if (activePower === "colorReplace" && colorReplaceStep === "position") {
    colorReplacePreview = { x: pixelX - 5, y: pixelY - 5 };
    selectedPixel = { x: pixelX, y: pixelY };
    coordsText.textContent = `(${pixelX}, ${pixelY})`;
    updatePowerOverlay();
    updateConfirmButton();
    return;
  }

  // Normal
  selectedPixel = { x: pixelX, y: pixelY };
  coordsText.textContent = `(${pixelX}, ${pixelY})`;
  pixelPlacerText.classList.add("hidden");
  send("getPixelInfo", { x: pixelX, y: pixelY });
  updatePixelCursor();
  updateConfirmButton();
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
  pixelCursor.style.left = CANVAS_PAD_H + selectedPixel.x * zoomLevel + "px";
  pixelCursor.style.top  = CANVAS_PAD_H + selectedPixel.y * zoomLevel + "px";

  // Colorer le curseur avec la couleur selectionnee
  if (selectedColor) {
    pixelCursor.style.background = selectedColor + "66";
  } else {
    pixelCursor.style.background = "transparent";
  }
}

const CONFIRM_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px"><rect x="3" y="3" width="18" height="18" rx="2" transform="rotate(45 12 12)"/></svg>';

function updateConfirmButton() {
  // Bombe
  if (activePower === "bomb") {
    if (bombPreview && selectedColor) {
      btnConfirmPixel.disabled = false;
      btnConfirmPixel.textContent = "Bombarder";
      btnConfirmPixel.style.background = "#e94560";
      btnConfirmPixel.style.color = "#fff";
    } else if (selectedColor) {
      btnConfirmPixel.disabled = true;
      btnConfirmPixel.textContent = "Choisir position";
    } else {
      btnConfirmPixel.disabled = true;
      btnConfirmPixel.textContent = "Choisir couleur";
    }
    return;
  }

  // Remplacement couleur
  if (activePower === "colorReplace") {
    if (colorReplaceStep === "target") {
      btnConfirmPixel.disabled = !selectedColor;
      btnConfirmPixel.textContent = selectedColor ? "Valider couleur cible" : "Choisir couleur cible";
      btnConfirmPixel.style.background = selectedColor ? "#6366f1" : "";
      btnConfirmPixel.style.color = selectedColor ? "#fff" : "";
    } else if (colorReplaceStep === "new") {
      btnConfirmPixel.disabled = !selectedColor;
      btnConfirmPixel.textContent = selectedColor ? "Valider nouvelle couleur" : "Choisir nouvelle couleur";
      btnConfirmPixel.style.background = selectedColor ? "#6366f1" : "";
      btnConfirmPixel.style.color = selectedColor ? "#fff" : "";
    } else if (colorReplaceStep === "position") {
      btnConfirmPixel.disabled = !colorReplacePreview;
      btnConfirmPixel.textContent = colorReplacePreview ? "Remplacer" : "Choisir position";
      btnConfirmPixel.style.background = colorReplacePreview ? "#6366f1" : "";
      btnConfirmPixel.style.color = colorReplacePreview ? "#fff" : "";
    }
    return;
  }

  // Normal
  btnConfirmPixel.style.background = "";
  btnConfirmPixel.style.color = "";
  if (selectedPixel && selectedColor) {
    btnConfirmPixel.disabled = false;
    btnConfirmPixel.innerHTML = CONFIRM_ICON + "Poser ici";
    btnConfirmPixel.style.background = "#000";
    btnConfirmPixel.style.color = "#fff";
  } else if (selectedPixel) {
    btnConfirmPixel.disabled = true;
    btnConfirmPixel.innerHTML = CONFIRM_ICON + "Choisis une couleur";
  } else {
    btnConfirmPixel.disabled = true;
    btnConfirmPixel.innerHTML = CONFIRM_ICON + "Poser";
  }
}

btnConfirmPixel.addEventListener("click", () => {
  if (!playerId) return;

  // Bombe : confirmer
  if (activePower === "bomb") {
    if (!bombPreview || !selectedColor) return;
    send("useBomb", { x: bombPreview.x, y: bombPreview.y, color: selectedColor });
    cancelActivePower();
    return;
  }

  // Remplacement couleur : flow multi-etapes
  if (activePower === "colorReplace") {
    if (colorReplaceStep === "target" && selectedColor) {
      colorReplaceTarget = selectedColor;
      colorReplaceStep = "new";
      selectedColor = null;
      paletteEl.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
      showToast("Choisissez la nouvelle couleur");
      updateConfirmButton();
      return;
    }
    if (colorReplaceStep === "new" && selectedColor) {
      colorReplaceStep = "position";
      showToast("Choisissez la position de la zone 10x10");
      updateConfirmButton();
      return;
    }
    if (colorReplaceStep === "position" && colorReplacePreview) {
      send("useColorReplace", {
        x: colorReplacePreview.x, y: colorReplacePreview.y,
        targetColor: colorReplaceTarget, newColor: selectedColor,
      });
      cancelActivePower();
      return;
    }
    return;
  }

  // Normal
  if (!selectedPixel || !selectedColor) return;
  send("placePixel", { x: selectedPixel.x, y: selectedPixel.y, color: selectedColor });
});

// =============================================================================
// COOLDOWN
// =============================================================================

let cooldownInterval = null;

function startCooldown(endTime, duration) {
  cooldownEnd = endTime;
  cooldownDuration = duration;
  sheetTimerBar.classList.remove("ready");

  // Reset la selection apres un placement reussi (sauf si pouvoir actif)
  if (!activePower) {
    selectedPixel = null;
    pixelCursor.classList.add("hidden");
    updateConfirmButton();
  }

  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    const remaining = cooldownEnd - Date.now();
    if (remaining <= 0) {
      clearInterval(cooldownInterval);
      sheetTimerFill.style.width = "100%";
      sheetTimerBar.classList.add("ready");
      sheetTimerText.textContent = "Pret !";
      return;
    }
    sheetTimerFill.style.width = `${(1 - remaining / cooldownDuration) * 100}%`;
    const secs = Math.ceil(remaining / 1000);
    sheetTimerText.textContent = `${secs}s`;
  }, 200);
}

// =============================================================================
// TOAST NOTIFICATIONS
// =============================================================================

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

// =============================================================================
// POUVOIRS — LOGIQUE
// =============================================================================

function updateGoldDisplay() {
  displayGold.textContent = goldPixels + " \u2726";
  powersGoldCount.textContent = goldPixels;
}

function updateDiamondDisplay() {
  powersDiamondCount.textContent = diamondPixels;
}

function updatePowersButton() {
  const canBomb = goldPixels >= 20;
  const canRafale = goldPixels >= 40 && rafaleEndsAt <= Date.now();
  const canTeamAccel = isCreator && diamondPixels >= 100 && teamAccelEndsAt <= Date.now();
  const canColorReplace = isCreator && diamondPixels >= 150;
  const any = canBomb || canRafale || canTeamAccel || canColorReplace;
  btnPowers.classList.toggle("available", any);
}

function updatePowerItems() {
  const items = powersMenu.querySelectorAll(".power-item");
  items.forEach((btn) => {
    const power = btn.dataset.power;
    let canUse = false;
    if (power === "bomb") canUse = goldPixels >= 20;
    if (power === "rafale") canUse = goldPixels >= 40 && rafaleEndsAt <= Date.now();
    if (power === "teamAccel") canUse = isCreator && diamondPixels >= 100 && teamAccelEndsAt <= Date.now();
    if (power === "colorReplace") canUse = isCreator && diamondPixels >= 150;
    btn.disabled = !canUse;
  });
}

function openPowersMenu() {
  powersMenuOpen = true;
  // Afficher section equipe si chef
  if (isCreator && myTeamId) {
    powersTeamSection.classList.remove("hidden");
    powersDiamondWrap.classList.remove("hidden");
  } else {
    powersTeamSection.classList.add("hidden");
    powersDiamondWrap.classList.add("hidden");
  }
  updateGoldDisplay();
  updateDiamondDisplay();
  updatePowerItems();
  // Masquer palette et CTA, afficher menu pouvoirs
  document.getElementById("palette-label").classList.add("hidden");
  paletteEl.classList.add("hidden");
  document.querySelector(".confirm-row").classList.add("hidden");
  powersMenu.classList.remove("hidden");
}

function closePowersMenu() {
  powersMenuOpen = false;
  powersMenu.classList.add("hidden");
  document.getElementById("palette-label").classList.remove("hidden");
  paletteEl.classList.remove("hidden");
  document.querySelector(".confirm-row").classList.remove("hidden");
}

btnPowers.addEventListener("click", () => {
  if (powersMenuOpen) closePowersMenu();
  else openPowersMenu();
});
btnPowersClose.addEventListener("click", closePowersMenu);

// --- Activation des pouvoirs ---
powersMenu.querySelectorAll(".power-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const power = btn.dataset.power;
    if (power === "rafale") {
      send("useRafale", {});
      closePowersMenu();
      return;
    }
    if (power === "teamAccel") {
      send("useTeamAccel", {});
      closePowersMenu();
      return;
    }
    if (power === "bomb") {
      activePower = "bomb";
      bombPreview = null;
      closePowersMenu();
      btnConfirmPixel.textContent = "Bombarder";
      btnConfirmPixel.disabled = true;
      showToast("Bombe activee — choisissez couleur puis position");
      return;
    }
    if (power === "colorReplace") {
      activePower = "colorReplace";
      colorReplaceStep = "target";
      colorReplaceTarget = null;
      colorReplacePreview = null;
      closePowersMenu();
      btnConfirmPixel.textContent = "Choisir couleur cible";
      btnConfirmPixel.disabled = true;
      selectedColor = null;
      // Deselect palette
      paletteEl.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
      showToast("Remplacement — choisissez la couleur a remplacer");
      return;
    }
  });
});

// --- Annulation pouvoir actif ---
function cancelActivePower() {
  activePower = null;
  bombPreview = null;
  colorReplacePreview = null;
  colorReplaceTarget = null;
  removePowerOverlay();
  btnConfirmPixel.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px"><rect x="3" y="3" width="18" height="18" rx="2" transform="rotate(45 12 12)"/></svg>Poser';
  updateConfirmButton();
}

// --- Power overlay sur le canvas ---
function updatePowerOverlay() {
  removePowerOverlay();
  if (activePower === "bomb" && bombPreview && selectedColor) {
    drawPowerRect(bombPreview.x, bombPreview.y, 5, selectedColor, 0.5);
  }
  if (activePower === "colorReplace" && colorReplacePreview) {
    const col = colorReplaceTarget || "#fff";
    drawPowerRect(colorReplacePreview.x, colorReplacePreview.y, 10, col, 0.3);
  }
}

function drawPowerRect(px, py, size, color, alpha) {
  let overlay = document.getElementById("power-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "power-overlay";
    overlay.style.position = "absolute";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "3";
    overlay.style.border = "2px solid #fff";
    overlay.style.boxSizing = "border-box";
    overlay.style.mixBlendMode = "multiply";
    canvasViewport.appendChild(overlay);
  }
  overlay.style.left = (CANVAS_PAD_H + px * zoomLevel) + "px";
  overlay.style.top  = (CANVAS_PAD_H + py * zoomLevel) + "px";
  overlay.style.width  = (size * zoomLevel) + "px";
  overlay.style.height = (size * zoomLevel) + "px";
  overlay.style.background = color;
  overlay.style.opacity = alpha;
}

function removePowerOverlay() {
  const el = document.getElementById("power-overlay");
  if (el) el.remove();
}

// --- Buff timers ---
let buffInterval = null;

function startBuffTimer(endsAt, label) {
  sheetBuffBar.classList.remove("hidden");
  if (buffInterval) clearInterval(buffInterval);
  const duration = endsAt - Date.now();
  buffInterval = setInterval(() => {
    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      clearInterval(buffInterval);
      buffInterval = null;
      sheetBuffBar.classList.add("hidden");
      sheetBuffFill.style.width = "0%";
      sheetBuffText.textContent = "";
      return;
    }
    sheetBuffFill.style.width = `${(remaining / duration) * 100}%`;
    const secs = Math.ceil(remaining / 1000);
    sheetBuffText.textContent = `${label || "Buff"} ${secs}s`;
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
    updateAvatarPreview();
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
  send("createTeam", { name, color: selectedTeamColor, avatar: createAvatarData });
  createTeamForm.classList.add("hidden");
  btnToggleCreate.textContent = "+ Creer une equipe";
  teamNameInput.value = "";
  createAvatarData = null;
  updateAvatarPreview();
  emojiPickerGrid.classList.add("hidden");
});

btnAvatarEmoji.addEventListener("click", () => {
  if (emojiPickerGrid.classList.contains("hidden")) {
    buildEmojiPicker();
    emojiPickerGrid.classList.remove("hidden");
  } else {
    emojiPickerGrid.classList.add("hidden");
  }
});

btnAvatarImage.addEventListener("click", () => {
  avatarFileInput.value = "";
  avatarFileInput.click();
});

btnAvatarReset.addEventListener("click", () => {
  createAvatarData = null;
  emojiPickerGrid.classList.add("hidden");
  updateAvatarPreview();
});

avatarFileInput.addEventListener("change", () => {
  const file = avatarFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    openCropModal(e.target.result, "avatar");
  };
  reader.readAsDataURL(file);
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
    const dot = makeAvatarEl(team, 32);
    const infoEl = document.createElement("div");
    infoEl.className = "team-item-info";
    infoEl.innerHTML = `
      <div class="team-item-name">${team.name}${isMine ? ' <span class="member-role">Mon equipe</span>' : ""}</div>
      <div class="team-item-stats">${team.memberCount} membre${team.memberCount > 1 ? "s" : ""} · ${team.pixelCount || 0} px · ${team.diamondPixels || 0} ◆</div>
    `;
    const arrow = document.createElement("span");
    arrow.style.cssText = "font-size:0.8rem; opacity:0.4;";
    arrow.textContent = "›";
    item.appendChild(dot);
    item.appendChild(infoEl);
    item.appendChild(arrow);
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

  detailTeamDot.innerHTML = "";
  const av = makeAvatarEl(team, 40);
  detailTeamDot.appendChild(av);
  detailTeamDot.style.background = "transparent";
  detailTeamDot.style.width = "40px";
  detailTeamDot.style.height = "40px";
  detailTeamName.textContent = team.name;
  detailTeamStats.textContent = `${team.memberCount} membre${team.memberCount > 1 ? "s" : ""} · ${team.pixelCount || 0} px · ${team.diamondPixels || 0} ◆`;

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
      const goldTag = `<span class="member-gold">${member.goldPixels || 0} ✦</span>`;
      el.innerHTML = `
        <div class="member-status ${member.active ? "active" : "inactive"}"></div>
        <span class="member-name">${member.pseudo}${member.id === playerId ? " (moi)" : ""}</span>
        ${roleTag}
        ${goldTag}
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

  // Section template — visible uniquement pour le leader de cette equipe
  const isLeaderOfThis = isMine && amCreator;
  overlaySection.classList.toggle("hidden", !isLeaderOfThis);
  if (isLeaderOfThis) {
    const hasOverlay = !!team.overlay;
    overlayPreviewRow.classList.toggle("hidden", !hasOverlay);
    btnOverlayAdd.textContent = hasOverlay ? "Remplacer le template" : "+ Ajouter un template";
    if (hasOverlay) overlayThumbnail.src = team.overlay.imageData;
  }

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

btnDetailInvite.addEventListener("click", () => {
  if (!detailTeamId || !allTeams[detailTeamId]) return;
  openInviteModal(detailTeamId);
});

btnInviteClose.addEventListener("click", closeInviteModal);
modalInvite.addEventListener("click", (e) => {
  if (e.target === modalInvite) closeInviteModal();
});

let inviteQrInstance = null;

function openInviteModal(teamId) {
  const team = allTeams[teamId];
  if (!team) return;
  const url = `${location.origin}/controller?team=${teamId}`;
  modalInviteTeamName.textContent = team.name;
  inviteUrlEl.textContent = url;
  // Clear previous QR
  inviteQrEl.innerHTML = "";
  inviteQrInstance = new QRCode(inviteQrEl, {
    text: url,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
  modalInvite.classList.remove("hidden");
}

function closeInviteModal() {
  modalInvite.classList.add("hidden");
  inviteQrEl.innerHTML = "";
  inviteQrInstance = null;
}

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

    bannerDot.innerHTML = "";
    bannerDot.appendChild(makeAvatarEl(team, 36));
    bannerDot.style.background = "transparent";
    bannerName.textContent = team.name;
    // Fond teinté avec la couleur de l'equipe via CSS custom properties
    myTeamBanner.style.setProperty("--team-color-bg", team.color + "22");
    myTeamBanner.style.setProperty("--team-color-border", team.color + "66");
    myTeamBanner.style.setProperty("--team-color-text", team.color);
    myTeamBanner.style.cursor = "pointer";

    displayTeamText.textContent = team.name;
    displayTeamDot.style.background = team.color;
    displayTeamDot.classList.remove("hidden");
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

    displayTeamText.textContent = "Solo";
    displayTeamDot.classList.add("hidden");
    displayTeam.style.background = "#00000010";
    displayTeam.style.color = "#888";
  }

  updatePowersButton();

  // Controles overlay : visibles si on est dans une equipe avec un overlay
  const teamOverlay = myTeamId && allTeams[myTeamId] ? allTeams[myTeamId].overlay : null;
  memberOverlayControls.classList.toggle("hidden", !teamOverlay);
  if (teamOverlay && localOverlayOpacity === null) {
    memberOpacitySlider.value = Math.round((teamOverlay.opacity || 0.5) * 100);
  }

  // Rafraichir l'overlay affiche
  if (!overlayEditMode) renderOverlay(teamOverlay);

  // Rafraichir le detail si ouvert et visible (ne pas le rouvrir si on est en mode edition overlay)
  if (detailTeamId && allTeams[detailTeamId] && !tabTeamDetail.classList.contains("hidden")) {
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
    updateViewport(); // no-op si l'ecran est encore cache

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
    profilePseudo.textContent = data.pseudo;
    displayId.textContent = data.playerId;
    const initPts = data.totalPixels || 0;
    displayPoints.textContent = initPts + " px";
    displayPointsProfile.textContent = displayPoints.textContent;

    if (data.teamId) myTeamId = data.teamId;
    updateTeamUI();

    if (data.palette) buildPalette(data.palette);

    // Resources
    goldPixels = data.goldPixels || 0;
    diamondPixels = data.diamondPixels || 0;
    updateGoldDisplay();
    updateDiamondDisplay();
    updatePowersButton();

    // Cooldown pret
    sheetTimerBar.classList.add("ready");
    sheetTimerText.textContent = "Pret !";
    sheetTimerFill.style.width = "100%";

    // Si c'est un nouveau joueur (pas une reconnexion), montrer l'ecran ID
    if (!screenGame.classList.contains("hidden") || screenIdReveal.classList.contains("hidden") === false) {
      // Deja en jeu ou deja sur l'ecran reveal → juste passer au jeu
      screenJoin.classList.add("hidden");
      screenIdReveal.classList.add("hidden");
      screenGame.classList.remove("hidden");
      initFillZoom();
    } else if (reconnectInput.value.trim().toUpperCase() === data.playerId) {
      // C'est une reconnexion → direct au jeu
      screenJoin.classList.add("hidden");
      screenGame.classList.remove("hidden");
      initFillZoom();
    } else {
      // Nouveau joueur → montrer l'ID (le zoom sera init au clic sur "Continuer")
      revealId.textContent = data.playerId;
      // Lien SMS avec l'ID pre-rempli
      const smsBody = encodeURIComponent(`Mon ID Pixel War : ${data.playerId}`);
      btnSmsId.href = `sms:?body=${smsBody}`;
      screenJoin.classList.add("hidden");
      screenIdReveal.classList.remove("hidden");
    }

    // Auto-join team depuis URL ?team=XXX (lien d'invitation)
    const urlTeamId = new URLSearchParams(location.search).get("team");
    if (urlTeamId && !data.teamId) {
      send("joinTeam", { teamId: urlTeamId });
    }
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
    if (data.totalPixels !== undefined) {
      const pts = data.totalPixels;
      displayPoints.textContent = pts + " px";
      displayPointsProfile.textContent = displayPoints.textContent;
    }
    if (data.goldPixels !== undefined) {
      goldPixels = data.goldPixels;
      updateGoldDisplay();
      updatePowersButton();
    }
    if (data.diamondPixels !== undefined) {
      diamondPixels = data.diamondPixels;
      updateDiamondDisplay();
      updatePowersButton();
    }
  }

  // --- Pixel update (d'un autre joueur) ---
  if (type === "pixelUpdate") {
    updatePixel(data.x, data.y, data.color);
  }

  // --- Power used (confirmation serveur) ---
  if (type === "powerUsed") {
    if (data.goldPixels !== undefined) { goldPixels = data.goldPixels; updateGoldDisplay(); }
    if (data.diamondPixels !== undefined) { diamondPixels = data.diamondPixels; updateDiamondDisplay(); }
    updatePowersButton();
    if (data.power === "bomb") showToast("Bombe utilisee !");
    if (data.power === "colorReplace") showToast("Remplacement effectue !");
  }

  // --- Rafale activee ---
  if (type === "powerUsed" && data.power === "rafale") {
    rafaleEndsAt = data.endsAt;
    goldPixels = data.goldPixels;
    updateGoldDisplay();
    updatePowersButton();
    startBuffTimer(data.endsAt, "Rafale");
    showToast("Rafale activée — 30 secondes !");
  }

  // --- Buff started (team accel, recu par tous les membres) ---
  if (type === "buffStarted") {
    if (data.buff === "teamAccel") {
      teamAccelEndsAt = data.endsAt;
      if (data.diamondPixels !== undefined) { diamondPixels = data.diamondPixels; updateDiamondDisplay(); }
      updatePowersButton();
      startBuffTimer(data.endsAt, "Accélération");
      showToast("Accélération d'équipe — 2 minutes !");
    }
  }

  // --- Buff ended ---
  if (type === "buffEnded") {
    if (data.buff === "rafale") {
      rafaleEndsAt = 0;
      showToast("Rafale terminee");
      updatePowersButton();
    }
    if (data.buff === "teamAccel") {
      teamAccelEndsAt = 0;
      showToast("Acceleration d'equipe terminee");
      updatePowersButton();
    }
  }

  // --- Cooldown update (apres fin de buff ou mode test) ---
  if (type === "cooldownUpdate") {
    cooldownDuration = data.cooldown;
    // Reset le timer pour montrer le nouveau cooldown
    sheetTimerBar.classList.add("ready");
    sheetTimerText.textContent = "Pret !";
    sheetTimerFill.style.width = "100%";
    if (data.adminChange) {
      showToast(`⏱ Cooldown changé : ${Math.round(data.cooldown / 1000)}s`);
    }
  }

  // --- Cooldown error ---
  if (type === "cooldownError") {
    showGameError(data.message);
  }

  // --- Leaderboard (points are now tracked locally via totalPixels) ---
  if (type === "leaderboard") {
    // Leaderboard data is still used by game/ display, nothing to do here
  }

  // --- Pixel info (qui a pose ce pixel) ---
  if (type === "pixelInfo") {
    if (selectedPixel && data.x === selectedPixel.x && data.y === selectedPixel.y) {
      if (data.placedBy) {
        const { pseudo, teamName, teamColor } = data.placedBy;
        let html = `par <strong>${pseudo}</strong>`;
        if (teamName) {
          html += ` <span class="placer-team-dot" style="background:${teamColor}"></span> ${teamName}`;
        }
        pixelPlacerText.innerHTML = html;
        pixelPlacerText.classList.remove("hidden");
      } else {
        pixelPlacerText.classList.add("hidden");
      }
    }
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
    if (overlayEditMode) exitOverlayEditMode();
    renderOverlay(null);
    updateTeamUI();
  }

  // --- Kicked ---
  if (type === "kicked") {
    myTeamId = null;
    if (overlayEditMode) exitOverlayEditMode();
    renderOverlay(null);
    updateTeamUI();
    showGameError(`Vous avez ete exclu de l'equipe "${data.teamName}"`);
  }

  // --- Teams update ---
  if (type === "teamsUpdate") {
    allTeams = data;
    renderTeamsList(data);
    updateTeamUI();
    // Mettre a jour les diamants de mon equipe
    if (myTeamId && data[myTeamId]) {
      diamondPixels = data[myTeamId].diamondPixels || 0;
      updateDiamondDisplay();
      updatePowersButton();
    }
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
// OVERLAY — RENDU
// =============================================================================

function renderOverlay(data) {
  // L'original n'est jamais visible en dehors du mode edition
  overlayImg.classList.add("hidden");

  if (!data || !data.imageData) {
    overlayGuide.classList.add("hidden");
    overlayGuide.width = 0; // reset pour forcer le recalcul au prochain template
    return;
  }

  // Calculer le guide si le template a change (membres / reconnexion)
  if (overlayImg.dataset.guideSrc !== data.imageData) {
    overlayImg.dataset.guideSrc = data.imageData;
    computeGuide(data); // async — affiche le guide une fois calcule
    return;             // computeGuide gerera l'affichage dans son callback
  }

  // Guide deja calcule : afficher ou cacher selon le toggle membre
  if (overlayVisible && overlayGuide.width > 0) {
    overlayGuide.classList.remove("hidden");
    applyGuideTransform(data);
  } else {
    overlayGuide.classList.add("hidden");
  }
}

function applyOverlayTransform(data) {
  const pixelSize = zoomLevel; // pixels CSS par pixel canvas
  const canvasW = canvasSize.width;

  // La taille naturelle de l'image est calculee au chargement
  // scale 1 = l'image fait la largeur du canvas
  const imgNaturalW = overlayImg.naturalWidth || 1;
  const targetW = canvasW * data.scale * pixelSize;
  const ratio = targetW / imgNaturalW;

  const tx = CANVAS_PAD_H + data.x * pixelSize;
  const ty = CANVAS_PAD_H + data.y * pixelSize;

  overlayImg.style.transform = `translate(${tx}px, ${ty}px) scale(${ratio})`;
  // Opacite : locale (membre) si definie, sinon celle du serveur (leader)
  const opacity = (localOverlayOpacity !== null && !overlayEditMode)
    ? localOverlayOpacity
    : data.opacity;
  overlayImg.style.opacity = opacity;
}

// Recalculer la transform quand le zoom change (appelé depuis updateViewport)
function refreshOverlayTransform() {
  if (overlayEditMode) {
    if (overlayDraft) applyOverlayTransform(overlayDraft);
  } else {
    const src = myTeamId && allTeams[myTeamId] ? allTeams[myTeamId].overlay : null;
    if (src && overlayVisible && overlayGuide.width > 0) applyGuideTransform(src);
  }
}

// =============================================================================
// GUIDE DE COULEURS — quantisation palette sur le template
// =============================================================================

function applyGuideTransform(data) {
  const pixelSize   = zoomLevel;
  const imgNaturalW = overlayGuide.width || 1;
  const targetW     = canvasSize.width * data.scale * pixelSize;
  const ratio       = targetW / imgNaturalW;
  const tx          = CANVAS_PAD_H + data.x * pixelSize;
  const ty          = CANVAS_PAD_H + data.y * pixelSize;
  overlayGuide.style.transform = `translate(${tx}px, ${ty}px) scale(${ratio})`;
  overlayGuide.style.opacity   = localOverlayOpacity !== null ? localOverlayOpacity : 0.75;
}

function computeGuide(data) {
  overlayGuide.classList.add("hidden");
  if (!data || !data.imageData || palette.length === 0) return;

  const img = new Image();
  img.onload = () => {
    // Taille cible en pixels canvas : chaque pixel du guide = 1 pixel du canvas
    const guideW = Math.max(1, Math.round(canvasSize.width  * data.scale));
    const guideH = Math.max(1, Math.round(img.naturalHeight / img.naturalWidth * guideW));

    // Downsampler l'image a la resolution canvas (nearest-neighbor)
    const tmp = document.createElement("canvas");
    tmp.width  = guideW;
    tmp.height = guideH;
    const tCtx = tmp.getContext("2d");
    tCtx.imageSmoothingEnabled = false;
    tCtx.drawImage(img, 0, 0, guideW, guideH);
    const imgData = tCtx.getImageData(0, 0, guideW, guideH);
    const d = imgData.data;

    // Precompute palette as RGB triples
    const palRGB = palette.map(hex => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ]);

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; } // transparent → skip
      const r = d[i], g = d[i + 1], b = d[i + 2];
      let bestDist = Infinity, bestIdx = 0;
      for (let j = 0; j < palRGB.length; j++) {
        const dr = r - palRGB[j][0], dg = g - palRGB[j][1], db = b - palRGB[j][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) { bestDist = dist; bestIdx = j; }
      }
      d[i]     = palRGB[bestIdx][0];
      d[i + 1] = palRGB[bestIdx][1];
      d[i + 2] = palRGB[bestIdx][2];
      d[i + 3] = 255;
    }

    overlayGuide.width  = guideW;
    overlayGuide.height = guideH;
    overlayGuide.getContext("2d").putImageData(imgData, 0, 0);

    if (overlayVisible) {
      overlayGuide.classList.remove("hidden");
      applyGuideTransform(data);
    }
  };
  img.src = data.imageData;
}


// =============================================================================
// OVERLAY — TOGGLE VISIBILITE (membre, local)
// =============================================================================

btnToggleOverlay.addEventListener("click", () => {
  overlayVisible = !overlayVisible;
  btnToggleOverlay.style.opacity = overlayVisible ? "1" : "0.4";
  memberOpacitySlider.style.opacity = overlayVisible ? "1" : "0.4";
  if (overlayVisible && overlayGuide.width > 0) {
    const current = myTeamId && allTeams[myTeamId] ? allTeams[myTeamId].overlay : null;
    if (current) {
      overlayGuide.classList.remove("hidden");
      applyGuideTransform(current);
    }
  } else {
    overlayGuide.classList.add("hidden");
  }
});

// Opacite locale du guide (pour les membres)
memberOpacitySlider.addEventListener("input", () => {
  localOverlayOpacity = memberOpacitySlider.value / 100;
  const current = myTeamId && allTeams[myTeamId] ? allTeams[myTeamId].overlay : null;
  if (current && overlayGuide.width > 0) applyGuideTransform(current);
});

// =============================================================================
// OVERLAY — IMPORT IMAGE (leader)
// =============================================================================

btnOverlayAdd.addEventListener("click", () => {
  overlayFileInput.value = "";
  overlayFileInput.click();
});

overlayFileInput.addEventListener("change", () => {
  const file = overlayFileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    openCropModal(e.target.result);
  };
  reader.readAsDataURL(file);
});

// =============================================================================
// OVERLAY — MODE EDITION (leader)
// =============================================================================

function enterOverlayEditMode() {
  overlayEditMode = true;
  overlayVisible = true;

  // Basculer sur l'onglet canvas (et oublier le detail d'equipe ouvert)
  detailTeamId = null;
  tabs.forEach(t => t.classList.remove("active"));
  document.querySelector('.tab[data-tab="canvas"]').classList.add("active");
  tabTeam.classList.add("hidden");
  tabTeamDetail.classList.add("hidden");
  tabCanvas.classList.remove("hidden");

  canvasContainer.classList.add("overlay-edit-mode");
  overlayEditBar.classList.remove("hidden");
  overlayOpacitySlider.value = Math.round((overlayDraft.opacity || 0.5) * 100);

  // Pendant l'edition on affiche l'original pour pouvoir le positionner
  overlayGuide.classList.add("hidden");
  overlayImg.src = overlayDraft.imageData;
  overlayImg.classList.remove("hidden");
  applyOverlayTransform(overlayDraft);
}

function exitOverlayEditMode() {
  overlayEditMode = false;
  overlayImg.classList.add("hidden"); // l'original disparait apres edition
  canvasContainer.classList.remove("overlay-edit-mode");
  overlayEditBar.classList.add("hidden");
  overlayDraft = null;
}

// Slider opacite
overlayOpacitySlider.addEventListener("input", () => {
  if (!overlayDraft) return;
  overlayDraft.opacity = overlayOpacitySlider.value / 100;
  applyOverlayTransform(overlayDraft);
});

// Scale
btnOverlayScaleDown.addEventListener("click", () => {
  if (!overlayDraft) return;
  overlayDraft.scale = Math.max(0.1, +(overlayDraft.scale - 0.1).toFixed(2));
  applyOverlayTransform(overlayDraft);
});

btnOverlayScaleUp.addEventListener("click", () => {
  if (!overlayDraft) return;
  overlayDraft.scale = Math.min(10, +(overlayDraft.scale + 0.1).toFixed(2));
  applyOverlayTransform(overlayDraft);
});

// Confirmer
btnOverlayConfirm.addEventListener("click", () => {
  if (!overlayDraft) return;
  const finalOverlay = { ...overlayDraft };
  send("setOverlay", { overlay: finalOverlay });
  exitOverlayEditMode();
  // Calcule le guide pixelise avec la taille/position finale
  overlayImg.dataset.guideSrc = finalOverlay.imageData; // marquer comme traite
  computeGuide(finalOverlay);
});

// Annuler
btnOverlayCancel.addEventListener("click", () => {
  exitOverlayEditMode();
  renderOverlay(overlayConfirmed);
});

// Supprimer
btnOverlayDelete.addEventListener("click", () => {
  send("setOverlay", { overlay: null });
  overlayDraft = null;
  overlayConfirmed = null;
  renderOverlay(null);
  // Rafraichir le detail
  if (detailTeamId) showTeamDetail(detailTeamId);
});

// =============================================================================
// CROP MODAL
// =============================================================================

let cropMode = "overlay"; // "overlay" | "avatar"
let cropSourceImg = null; // Image object chargée
let cropImgOffsetX = 0;   // position de l'image dans .crop-area
let cropImgOffsetY = 0;
let cropImgRenderedW = 0;
let cropImgRenderedH = 0;

// box en coordonnées image naturelle
let cropBoxNX = 0;
let cropBoxNY = 0;
let cropBoxNW = 0;
let cropBoxNH = 0;

function openCropModal(dataUrl, mode) {
  cropMode = mode || "overlay";
  cropSourceImg = new Image();
  cropSourceImg.onload = () => {
    cropImg.src = dataUrl;
    modalCrop.classList.remove("hidden");
    cropBox.classList.toggle("avatar-mode", cropMode === "avatar");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rect = cropImg.getBoundingClientRect();
        const areaRect = cropImg.parentElement.getBoundingClientRect();
        cropImgOffsetX = rect.left - areaRect.left;
        cropImgOffsetY = rect.top - areaRect.top;
        cropImgRenderedW = rect.width;
        cropImgRenderedH = rect.height;

        // Boite initiale : 80% centree
        const margin = 0.1;
        cropBoxNX = Math.round(cropSourceImg.naturalWidth * margin);
        cropBoxNY = Math.round(cropSourceImg.naturalHeight * margin);
        let nw = Math.round(cropSourceImg.naturalWidth * (1 - 2 * margin));
        let nh = Math.round(cropSourceImg.naturalHeight * (1 - 2 * margin));
        // Avatar : forcer carré centré
        if (cropMode === "avatar") {
          const s = Math.min(nw, nh);
          cropBoxNX = Math.round((cropSourceImg.naturalWidth - s) / 2);
          cropBoxNY = Math.round((cropSourceImg.naturalHeight - s) / 2);
          nw = s; nh = s;
        }
        cropBoxNW = nw;
        cropBoxNH = nh;
        updateCropBoxDOM();
      });
    });
  };
  cropSourceImg.src = dataUrl;
}

// Conversion coordonnées naturelles → CSS (relative à .crop-area)
function natToCss(nx, ny, nw, nh) {
  const scaleX = cropImgRenderedW / cropSourceImg.naturalWidth;
  const scaleY = cropImgRenderedH / cropSourceImg.naturalHeight;
  return {
    left: cropImgOffsetX + nx * scaleX,
    top:  cropImgOffsetY + ny * scaleY,
    width: nw * scaleX,
    height: nh * scaleY,
  };
}

function updateCropBoxDOM() {
  if (!cropSourceImg) return;
  const { left, top, width, height } = natToCss(cropBoxNX, cropBoxNY, cropBoxNW, cropBoxNH);
  cropBox.style.left   = left + "px";
  cropBox.style.top    = top  + "px";
  cropBox.style.width  = width + "px";
  cropBox.style.height = height + "px";
}

// --- Drag de la boite (déplacer) ---
let cropDragActive = false;
let cropDragStartX = 0;
let cropDragStartY = 0;
let cropDragStartNX = 0;
let cropDragStartNY = 0;

cropBox.addEventListener("pointerdown", (e) => {
  if (e.target !== cropBox) return; // ignorer les handles
  e.preventDefault();
  e.stopPropagation();
  cropBox.setPointerCapture(e.pointerId);
  cropDragActive = true;
  cropDragStartX = e.clientX;
  cropDragStartY = e.clientY;
  cropDragStartNX = cropBoxNX;
  cropDragStartNY = cropBoxNY;
});

cropBox.addEventListener("pointermove", (e) => {
  if (!cropDragActive) return;
  e.preventDefault();
  const scaleX = cropSourceImg.naturalWidth / cropImgRenderedW;
  const scaleY = cropSourceImg.naturalHeight / cropImgRenderedH;
  const dx = (e.clientX - cropDragStartX) * scaleX;
  const dy = (e.clientY - cropDragStartY) * scaleY;

  cropBoxNX = Math.max(0, Math.min(cropSourceImg.naturalWidth  - cropBoxNW, Math.round(cropDragStartNX + dx)));
  cropBoxNY = Math.max(0, Math.min(cropSourceImg.naturalHeight - cropBoxNH, Math.round(cropDragStartNY + dy)));
  updateCropBoxDOM();
});

cropBox.addEventListener("pointerup",   () => { cropDragActive = false; });
cropBox.addEventListener("pointercancel", () => { cropDragActive = false; });

// --- Drag des handles (redimensionner) ---
let handleDragActive = false;
let handleCorner = null;
let handleStartX = 0;
let handleStartY = 0;
let handleStartBox = null;

document.querySelectorAll(".crop-handle").forEach((handle) => {
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    handleDragActive = true;
    handleCorner = handle.dataset.corner;
    handleStartX = e.clientX;
    handleStartY = e.clientY;
    handleStartBox = { x: cropBoxNX, y: cropBoxNY, w: cropBoxNW, h: cropBoxNH };
  });

  handle.addEventListener("pointermove", (e) => {
    if (!handleDragActive) return;
    e.preventDefault();
    const scaleX = cropSourceImg.naturalWidth  / cropImgRenderedW;
    const scaleY = cropSourceImg.naturalHeight / cropImgRenderedH;
    const dx = (e.clientX - handleStartX) * scaleX;
    const dy = (e.clientY - handleStartY) * scaleY;
    const MIN = 20; // taille min en pixels naturels

    let { x, y, w, h } = handleStartBox;

    if (handleCorner === "tl") {
      const newX = Math.min(x + w - MIN, x + dx);
      const newY = Math.min(y + h - MIN, y + dy);
      w = w - (newX - x);
      h = h - (newY - y);
      x = newX; y = newY;
    } else if (handleCorner === "tr") {
      const newW = Math.max(MIN, w + dx);
      const newY = Math.min(y + h - MIN, y + dy);
      h = h - (newY - y);
      w = newW; y = newY;
    } else if (handleCorner === "bl") {
      const newX = Math.min(x + w - MIN, x + dx);
      const newH = Math.max(MIN, h + dy);
      w = w - (newX - x);
      x = newX; h = newH;
    } else if (handleCorner === "br") {
      w = Math.max(MIN, w + dx);
      h = Math.max(MIN, h + dy);
    }

    // Avatar : forcer carré (prendre le côté le plus petit)
    if (cropMode === "avatar") {
      const s = Math.min(w, h);
      if (handleCorner === "tl") { x += w - s; y += h - s; }
      else if (handleCorner === "tr") { y += h - s; }
      else if (handleCorner === "bl") { x += w - s; }
      w = s; h = s;
    }

    // Clamp dans les limites de l'image
    x = Math.max(0, x);
    y = Math.max(0, y);
    w = Math.min(cropSourceImg.naturalWidth  - x, w);
    h = Math.min(cropSourceImg.naturalHeight - y, h);

    cropBoxNX = Math.round(x);
    cropBoxNY = Math.round(y);
    cropBoxNW = Math.round(w);
    cropBoxNH = Math.round(h);
    updateCropBoxDOM();
  });

  handle.addEventListener("pointerup",     () => { handleDragActive = false; });
  handle.addEventListener("pointercancel", () => { handleDragActive = false; });
});

// --- Confirmer le crop ---
btnCropConfirm.addEventListener("click", () => {
  if (!cropSourceImg) return;

  if (cropMode === "avatar") {
    // Avatar : 64×64 avec clip circulaire
    const SIZE = 64;
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = SIZE; tmpCanvas.height = SIZE;
    const c = tmpCanvas.getContext("2d");
    c.beginPath(); c.arc(SIZE/2, SIZE/2, SIZE/2, 0, Math.PI*2); c.clip();
    c.drawImage(cropSourceImg, cropBoxNX, cropBoxNY, cropBoxNW, cropBoxNH, 0, 0, SIZE, SIZE);
    const dataUrl = tmpCanvas.toDataURL("image/webp", 0.85);
    modalCrop.classList.add("hidden");
    cropBox.classList.remove("avatar-mode");
    cropSourceImg = null;
    createAvatarData = { type: "image", value: dataUrl };
    emojiPickerGrid.classList.add("hidden");
    updateAvatarPreview();
    return;
  }

  // Overlay : comportement existant
  const MAX = 800;
  let w = cropBoxNW, h = cropBoxNH;
  if (w > MAX || h > MAX) {
    const r = Math.min(MAX / w, MAX / h);
    w = Math.round(w * r); h = Math.round(h * r);
  }
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = w; tmpCanvas.height = h;
  tmpCanvas.getContext("2d").drawImage(cropSourceImg, cropBoxNX, cropBoxNY, cropBoxNW, cropBoxNH, 0, 0, w, h);
  const compressed = tmpCanvas.toDataURL("image/jpeg", 0.8);

  modalCrop.classList.add("hidden");
  cropSourceImg = null;

  const existing = myTeamId && allTeams[myTeamId] ? allTeams[myTeamId].overlay : null;
  overlayDraft = {
    imageData: compressed,
    x: existing ? existing.x : 0,
    y: existing ? existing.y : 0,
    scale: existing ? existing.scale : 0.25,
    opacity: existing ? existing.opacity : 0.5,
  };
  overlayConfirmed = existing;
  enterOverlayEditMode();
});

// --- Annuler le crop ---
btnCropCancel.addEventListener("click", () => {
  modalCrop.classList.add("hidden");
  cropBox.classList.remove("avatar-mode");
  cropSourceImg = null;
  cropMode = "overlay";
});

// =============================================================================
// OVERLAY — DRAG EN MODE EDITION (1 doigt deplace l'overlay)
// =============================================================================

let overlayDragActive = false;
let overlayDragStartX = 0;
let overlayDragStartY = 0;
let overlayDragStartOX = 0;
let overlayDragStartOY = 0;

canvasContainer.addEventListener("pointerdown", (e) => {
  if (!overlayEditMode || e.isPrimary === false) return;
  // Si un seul pointeur (pas pinch), on drag l'overlay
  if (e.pointerType === "touch" && e.isPrimary) {
    overlayDragActive = true;
    overlayDragStartX = e.clientX;
    overlayDragStartY = e.clientY;
    overlayDragStartOX = overlayDraft.x;
    overlayDragStartOY = overlayDraft.y;
    e.stopImmediatePropagation(); // empeche le pan canvas
  }
}, true); // capture phase pour passer avant le pan

canvasContainer.addEventListener("pointermove", (e) => {
  if (!overlayDragActive || !overlayEditMode) return;
  const dx = (e.clientX - overlayDragStartX) / zoomLevel;
  const dy = (e.clientY - overlayDragStartY) / zoomLevel;
  // Snap sur la grille pixel
  overlayDraft.x = Math.round(overlayDragStartOX + dx);
  overlayDraft.y = Math.round(overlayDragStartOY + dy);
  applyOverlayTransform(overlayDraft);
}, true);

canvasContainer.addEventListener("pointerup", () => {
  overlayDragActive = false;
}, true);

// =============================================================================
// BOTTOM SHEET — DRAG (poignee)
// =============================================================================

let sheetDragActive = false;
let sheetDragStartY = 0;
let sheetDragStartTranslate = 0;
let sheetCollapsed = false;

function getSheetMaxTranslate() {
  // Garder visible : poignee + ligne de zoom (canvas-controls)
  const controls = bottomSheet.querySelector(".canvas-controls");
  if (controls) {
    const visibleH = controls.offsetTop + controls.offsetHeight + 10;
    return Math.max(0, bottomSheet.offsetHeight - visibleH);
  }
  return Math.max(0, bottomSheet.offsetHeight - 60);
}

function snapSheet(targetY, animate = true) {
  bottomSheet.style.transition = animate ? "transform 0.32s cubic-bezier(0.32,0.72,0,1)" : "none";
  bottomSheet.style.transform = `translateY(${targetY}px)`;
  sheetCollapsed = targetY > 0;
  // Recalculate pan limits after sheet animation completes
  if (animate) {
    setTimeout(updateViewport, 340);
  } else {
    updateViewport();
  }
}

// Attacher le drag sur la zone de la poignee (les 40px du haut de la sheet)
bottomSheet.addEventListener("pointerdown", (e) => {
  // Ne pas capturer le drag si on clique sur un bouton interactif
  if (e.target.closest(".ctrl-btn, button, input")) return;
  const sheetRect = bottomSheet.getBoundingClientRect();
  const controls = bottomSheet.querySelector(".canvas-controls");
  const grabZone = controls
    ? controls.getBoundingClientRect().bottom - sheetRect.top + 4
    : 64;
  if (e.clientY - sheetRect.top > grabZone) return; // seulement depuis le haut (handle + zoom row)
  e.preventDefault();
  bottomSheet.setPointerCapture(e.pointerId);
  sheetDragActive = true;
  sheetDragStartY = e.clientY;
  // Lire le translateY actuel
  const matrix = new DOMMatrix(getComputedStyle(bottomSheet).transform);
  sheetDragStartTranslate = matrix.m42 || 0;
  bottomSheet.style.transition = "none";
});

bottomSheet.addEventListener("pointermove", (e) => {
  if (!sheetDragActive) return;
  const dy = e.clientY - sheetDragStartY;
  const newY = Math.max(0, Math.min(getSheetMaxTranslate(), sheetDragStartTranslate + dy));
  bottomSheet.style.transform = `translateY(${newY}px)`;
});

bottomSheet.addEventListener("pointerup", (e) => {
  if (!sheetDragActive) return;
  sheetDragActive = false;
  const dy = e.clientY - sheetDragStartY;
  const maxY = getSheetMaxTranslate();
  if (sheetCollapsed) {
    snapSheet(dy < -50 ? 0 : maxY);
  } else {
    snapSheet(dy > 60 ? maxY : 0);
  }
});

bottomSheet.addEventListener("pointercancel", () => {
  if (sheetDragActive) {
    sheetDragActive = false;
    snapSheet(sheetCollapsed ? getSheetMaxTranslate() : 0);
  }
});

// =============================================================================
// INIT VIEWPORT AU CHARGEMENT
// =============================================================================

window.addEventListener("load", () => {
  updateConfirmButton();
});