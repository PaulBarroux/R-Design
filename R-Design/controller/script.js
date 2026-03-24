// =============================================================================
// CONTROLLER — script.js (telephone du joueur)
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

const screenJoin = document.getElementById("screen-join");
const screenGame = document.getElementById("screen-game");
const pseudoInput = document.getElementById("pseudo");
const btnJoin = document.getElementById("btn-join");
const reconnectInput = document.getElementById("reconnect-id");
const btnReconnect = document.getElementById("btn-reconnect");
const displayPseudo = document.getElementById("display-pseudo");
const displayId = document.getElementById("display-id");
const displayTeam = document.getElementById("display-team");
const canvasEl = document.getElementById("pixel-canvas");
const ctx = canvasEl.getContext("2d");
const paletteEl = document.getElementById("palette");
const cooldownBar = document.getElementById("cooldown-bar");
const cooldownFill = document.getElementById("cooldown-fill");
const cooldownText = document.getElementById("cooldown-text");
const coordsText = document.getElementById("coords-text");
const tooltipEl = document.getElementById("pixel-info-tooltip");

// Team elements
const noTeamEl = document.getElementById("no-team");
const inTeamEl = document.getElementById("in-team");
const teamNameInput = document.getElementById("team-name");
const teamColorPicker = document.getElementById("team-color-picker");
const btnCreateTeam = document.getElementById("btn-create-team");
const teamsListEl = document.getElementById("teams-list");
const myTeamName = document.getElementById("my-team-name");
const myTeamMembers = document.getElementById("my-team-members");
const myTeamColor = document.getElementById("my-team-color");
const btnLeaveTeam = document.getElementById("btn-leave-team");

// Tab elements
const tabs = document.querySelectorAll(".tab");
const canvasWrapper = document.getElementById("canvas-wrapper");
const teamTab = document.getElementById("team-tab");

// =============================================================================
// ETAT LOCAL
// =============================================================================

let playerId = null;
let selectedColor = null;
let cooldownEnd = 0;
let cooldownDuration = 30000;
let canvasData = null;
let canvasSize = { width: 200, height: 200 };
let palette = [];
let allTeams = {};
let myTeamId = null;
let selectedTeamColor = "#3690EA";

// =============================================================================
// TABS
// =============================================================================

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    if (target === "canvas-tab") {
      canvasWrapper.classList.remove("hidden");
      document.getElementById("palette").classList.remove("hidden");
      cooldownBar.classList.remove("hidden");
      teamTab.classList.add("hidden");
    } else {
      canvasWrapper.classList.add("hidden");
      document.getElementById("palette").classList.add("hidden");
      cooldownBar.classList.add("hidden");
      teamTab.classList.remove("hidden");
    }
  });
});

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

// Enter key support
pseudoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnJoin.click();
});
reconnectInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnReconnect.click();
});

// =============================================================================
// PALETTE DE COULEURS
// =============================================================================

function buildPalette(colors) {
  palette = colors;
  paletteEl.innerHTML = "";
  colors.forEach((color) => {
    const btn = document.createElement("div");
    btn.className = "palette-color";
    btn.style.background = color;
    // Bordure visible pour les couleurs claires
    if (["#FFFFFF", "#D4D7D9"].includes(color)) {
      btn.style.border = "2px solid #555";
    }
    btn.addEventListener("click", () => {
      document.querySelectorAll(".palette-color").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedColor = color;
    });
    paletteEl.appendChild(btn);
  });
  // Selectionner la premiere couleur par defaut
  if (colors.length > 0 && !selectedColor) {
    paletteEl.children[0].classList.add("selected");
    selectedColor = colors[0];
  }
}

// =============================================================================
// CANVAS — RENDU ET INTERACTION
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
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255;
      } else {
        // Pixel vide : fond sombre avec damier subtil
        const isLight = (x + y) % 2 === 0;
        imageData.data[idx] = isLight ? 30 : 26;
        imageData.data[idx + 1] = isLight ? 30 : 26;
        imageData.data[idx + 2] = isLight ? 48 : 42;
        imageData.data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Mettre a jour UN pixel sans tout redessiner
function updatePixel(x, y, color) {
  if (canvasData) {
    canvasData[y][x] = color;
  }
  // Dessiner directement le pixel
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const imageData = ctx.createImageData(1, 1);
  imageData.data[0] = r;
  imageData.data[1] = g;
  imageData.data[2] = b;
  imageData.data[3] = 255;
  ctx.putImageData(imageData, x, y);
}

// Convertir les coordonnees tactiles en coordonnees canvas
function getTouchCanvasCoords(e) {
  const rect = canvasEl.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const scaleX = canvasSize.width / rect.width;
  const scaleY = canvasSize.height / rect.height;
  return {
    x: Math.floor((touch.clientX - rect.left) * scaleX),
    y: Math.floor((touch.clientY - rect.top) * scaleY),
  };
}

// Clic/tap pour placer un pixel
canvasEl.addEventListener("click", (e) => {
  if (!selectedColor || !playerId) return;
  const { x, y } = getTouchCanvasCoords(e);
  if (x < 0 || x >= canvasSize.width || y < 0 || y >= canvasSize.height) return;

  send("placePixel", { x, y, color: selectedColor });
});

// Afficher les coordonnees au survol/touch
canvasEl.addEventListener("pointermove", (e) => {
  const { x, y } = getTouchCanvasCoords(e);
  if (x >= 0 && x < canvasSize.width && y >= 0 && y < canvasSize.height) {
    coordsText.textContent = `(${x}, ${y})`;
  }
});

// =============================================================================
// COOLDOWN
// =============================================================================

let cooldownInterval = null;

function startCooldown(endTime, duration) {
  cooldownEnd = endTime;
  cooldownDuration = duration;
  cooldownBar.classList.remove("ready");

  if (cooldownInterval) clearInterval(cooldownInterval);

  cooldownInterval = setInterval(() => {
    const now = Date.now();
    const remaining = cooldownEnd - now;

    if (remaining <= 0) {
      clearInterval(cooldownInterval);
      cooldownFill.style.width = "100%";
      cooldownBar.classList.add("ready");
      cooldownText.textContent = "Pret !";
      return;
    }

    const progress = 1 - remaining / cooldownDuration;
    cooldownFill.style.width = `${progress * 100}%`;
    cooldownText.textContent = `${Math.ceil(remaining / 1000)}s`;
  }, 200);
}

// =============================================================================
// EQUIPES — UI
// =============================================================================

// Couleurs pour la creation d'equipe
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

btnCreateTeam.addEventListener("click", () => {
  const name = teamNameInput.value.trim();
  if (!name) {
    teamNameInput.style.borderColor = "#e94560";
    return;
  }
  send("createTeam", { name, color: selectedTeamColor });
});

btnLeaveTeam.addEventListener("click", () => {
  send("leaveTeam", {});
});

function renderTeamsList(teamsData) {
  allTeams = teamsData;

  // Mettre a jour la liste des equipes a rejoindre
  const teamIds = Object.keys(teamsData);
  if (teamIds.length === 0) {
    teamsListEl.innerHTML = '<p class="muted">Aucune equipe pour l\'instant</p>';
  } else {
    teamsListEl.innerHTML = "";
    teamIds.forEach((id) => {
      const team = teamsData[id];
      const item = document.createElement("div");
      item.className = "team-item";
      item.innerHTML = `
        <div class="team-dot" style="background: ${team.color}"></div>
        <span style="flex: 1; font-weight: 600">${team.name}</span>
        <span class="muted">${team.memberCount} membre${team.memberCount > 1 ? "s" : ""}</span>
      `;
      item.addEventListener("click", () => {
        send("joinTeam", { teamId: id });
      });
      teamsListEl.appendChild(item);
    });
  }
}

function updateTeamUI() {
  if (myTeamId && allTeams[myTeamId]) {
    const team = allTeams[myTeamId];
    noTeamEl.classList.add("hidden");
    inTeamEl.classList.remove("hidden");
    myTeamName.textContent = team.name;
    myTeamMembers.textContent = `${team.memberCount} membre${team.memberCount > 1 ? "s" : ""}`;
    myTeamColor.style.background = team.color;
    displayTeam.textContent = team.name;
    displayTeam.style.background = team.color + "33";
    displayTeam.style.color = team.color;
  } else {
    noTeamEl.classList.remove("hidden");
    inTeamEl.classList.add("hidden");
    displayTeam.textContent = "Solo";
    displayTeam.style.background = "#ffffff15";
    displayTeam.style.color = "#aaa";
  }
}

// =============================================================================
// RECEPTION DES MESSAGES DU SERVEUR
// =============================================================================

ws.addEventListener("message", (event) => {
  const { type, data } = JSON.parse(event.data);

  // --- Etat initial (envoye a la connexion WebSocket) ---
  if (type === "init") {
    canvasSize = data.canvasSize;
    renderCanvas(data.canvas);
    buildPalette(data.palette);
    renderTeamsList(data.teams);
  }

  // --- Confirmation de join/reconnexion ---
  if (type === "joined") {
    playerId = data.playerId;
    cooldownDuration = data.cooldown;
    canvasSize = data.canvasSize;

    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");

    displayPseudo.textContent = data.pseudo;
    displayId.textContent = data.playerId;

    if (data.teamId) {
      myTeamId = data.teamId;
    }
    updateTeamUI();

    if (data.palette) buildPalette(data.palette);

    // Cooldown deja pret au join
    cooldownBar.classList.add("ready");
    cooldownText.textContent = "Pret !";
    cooldownFill.style.width = "100%";
  }

  // --- Pixel place avec succes ---
  if (type === "pixelPlaced") {
    updatePixel(data.x, data.y, data.color);
    startCooldown(data.nextPlacement, data.cooldown);
  }

  // --- Un autre joueur a place un pixel ---
  if (type === "pixelUpdate") {
    updatePixel(data.x, data.y, data.color);
  }

  // --- Erreur de cooldown ---
  if (type === "cooldownError") {
    cooldownText.textContent = data.message;
  }

  // --- Erreur generique ---
  if (type === "error") {
    alert(data.message);
  }

  // --- Mise a jour de l'etat complet ---
  if (type === "state") {
    renderCanvas(data.canvas);
    if (data.palette) buildPalette(data.palette);
    renderTeamsList(data.teams);
    updateTeamUI();
  }

  // --- Mise a jour du leaderboard (pas utilise cote controller pour l'instant) ---
  if (type === "leaderboard") {
    // Pourrait afficher un mini-leaderboard sur mobile plus tard
  }

  // --- Equipe rejointe ---
  if (type === "teamJoined") {
    myTeamId = data.teamId;
    updateTeamUI();
    teamNameInput.value = "";
  }

  // --- Equipe quittee ---
  if (type === "teamLeft") {
    myTeamId = null;
    updateTeamUI();
  }

  // --- Mise a jour des equipes ---
  if (type === "teamsUpdate") {
    renderTeamsList(data);
    updateTeamUI();
  }

  // --- Info pixel ---
  if (type === "pixelInfo") {
    if (data.placedBy) {
      tooltipEl.textContent = `(${data.x},${data.y}) par ${data.placedBy.pseudo}`;
      tooltipEl.classList.remove("hidden");
      setTimeout(() => tooltipEl.classList.add("hidden"), 3000);
    }
  }
});

// Reconnexion WebSocket
ws.addEventListener("close", () => {
  console.log("Connexion perdue. Rechargez la page pour vous reconnecter.");
});