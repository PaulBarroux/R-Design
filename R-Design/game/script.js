// =============================================================================
// ECRAN DE JEU — script.js (affiche sur le projecteur / TV)
// =============================================================================

const ws = new WebSocket(`ws://${location.host}`);

// =============================================================================
// QR CODE
// =============================================================================

(function generateQRCode() {
  const controllerURL = `http://${location.host}/controller`;
  const qr = qrcode(0, "L");
  qr.addData(controllerURL);
  qr.make();
  document.getElementById("qr-code").innerHTML = qr.createImgTag(3, 0);
})();

// =============================================================================
// REFERENCES DOM
// =============================================================================

const canvasEl = document.getElementById("pixel-canvas");
const ctx = canvasEl.getContext("2d");
const leaderboardTitle = document.getElementById("leaderboard-title");
const leaderboardList = document.getElementById("leaderboard-list");
const playerCountEl = document.getElementById("player-count");
const waitingEl = document.getElementById("waiting");

// =============================================================================
// ETAT LOCAL
// =============================================================================

let canvasSize = { width: 200, height: 200 };
let canvasData = null;
let leaderboardData = { individual: [], teams: [] };
let showTeamLeaderboard = false;

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
      } else {
        imageData.data[idx] = 255;
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
// CANVAS — TAILLE RESPONSIVE (pixels carres)
// =============================================================================

function fitCanvas() {
  const maxW = window.innerWidth - 320;
  const maxH = window.innerHeight - 40;
  const pixelSize = Math.max(1, Math.floor(Math.min(maxW / canvasSize.width, maxH / canvasSize.height)));
  canvasEl.style.width = pixelSize * canvasSize.width + "px";
  canvasEl.style.height = pixelSize * canvasSize.height + "px";
}

fitCanvas();
window.addEventListener("resize", fitCanvas);

// =============================================================================
// LEADERBOARD
// =============================================================================

function renderLeaderboard(data) {
  if (!data) return;
  leaderboardData = data;
  displayCurrentLeaderboard();
}

function displayCurrentLeaderboard() {
  const list = showTeamLeaderboard ? leaderboardData.teams : leaderboardData.individual;
  leaderboardTitle.textContent = showTeamLeaderboard ? "🏆 Top Equipes" : "🏆 Top Joueurs";

  if (list.length === 0) {
    leaderboardList.innerHTML = '<div class="lb-entry"><span style="opacity:0.4; font-size:0.75rem;">Aucun pixel place</span></div>';
    return;
  }

  leaderboardList.innerHTML = list
    .map((entry, i) => {
      if (showTeamLeaderboard) {
        return `
          <div class="lb-entry">
            <span class="lb-rank">${i + 1}</span>
            <div class="lb-dot" style="background: ${entry.color}"></div>
            <span class="lb-name">${entry.name}</span>
            <span class="lb-count">${entry.count} px</span>
          </div>`;
      } else {
        return `
          <div class="lb-entry">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-name">${entry.pseudo}</span>
            <span class="lb-count">${entry.count} px</span>
          </div>`;
      }
    })
    .join("");
}

// Alterner individuel/equipe toutes les 8s
setInterval(() => {
  if (leaderboardData.teams.length > 0) {
    showTeamLeaderboard = !showTeamLeaderboard;
    displayCurrentLeaderboard();
  }
}, 8000);

// =============================================================================
// RECEPTION DES MESSAGES
// =============================================================================

ws.addEventListener("message", (event) => {
  const { type, data } = JSON.parse(event.data);

  if (type === "init") {
    canvasSize = data.canvasSize;
    fitCanvas();
    renderCanvas(data.canvas);
    renderLeaderboard(data.leaderboard);
    playerCountEl.textContent = `${data.playerCount} joueur${data.playerCount > 1 ? "s" : ""}`;
    if (data.playerCount > 0) waitingEl.classList.add("hidden");
  }

  if (type === "pixelUpdate") {
    updatePixel(data.x, data.y, data.color);
    waitingEl.classList.add("hidden");
  }

  if (type === "leaderboard") {
    renderLeaderboard(data);
  }

  if (type === "playerCount") {
    playerCountEl.textContent = `${data} joueur${data > 1 ? "s" : ""}`;
    if (data > 0) waitingEl.classList.add("hidden");
  }

  if (type === "state") {
    canvasSize = data.canvasSize;
    fitCanvas();
    renderCanvas(data.canvas);
    renderLeaderboard(data.leaderboard);
    playerCountEl.textContent = `${data.playerCount} joueur${data.playerCount > 1 ? "s" : ""}`;
  }
});

ws.addEventListener("close", () => {
  setTimeout(() => location.reload(), 3000);
});