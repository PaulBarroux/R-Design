// =============================================================================
// ECRAN DE JEU — script.js (affiche sur le projecteur / TV)
// =============================================================================
//
// Ce fichier gere l'affichage du jeu sur l'ecran partage.
// Il ne fait qu'AFFICHER : aucune logique de jeu ici, tout vient du serveur.
//
// Il fait 4 choses :
//   1. Se connecter au serveur via WebSocket
//   2. Afficher le canvas (grille de pixels)
//   3. Afficher le leaderboard (individuel et equipes, en alternance)
//   4. Generer le QR code pour rejoindre
//
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
const canvasWrapper = document.getElementById("canvas-wrapper");
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
let showTeamLeaderboard = false; // Alterne entre individuel et equipes

// =============================================================================
// CANVAS — RENDU
// =============================================================================
// Le canvas est un element <canvas> HTML avec image-rendering: pixelated.
// On dessine chaque pixel a l'echelle 1:1 puis le CSS l'agrandit.

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
        // Pixel vide : damier sombre subtil
        const isLight = (x + y) % 2 === 0;
        imageData.data[idx] = isLight ? 22 : 18;
        imageData.data[idx + 1] = isLight ? 22 : 18;
        imageData.data[idx + 2] = isLight ? 36 : 30;
        imageData.data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Mettre a jour un seul pixel (plus rapide que tout redessiner)
function updatePixel(x, y, color) {
  if (canvasData) {
    canvasData[y][x] = color;
  }
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

// =============================================================================
// CANVAS — TAILLE RESPONSIVE
// =============================================================================
// On veut que chaque pixel soit carre et que le canvas remplisse au max l'ecran.
// Le canvas interne fait 200x200 pixels, et le CSS le grossit avec pixelated.

function fitCanvas() {
  const maxW = window.innerWidth - 320; // Laisser de la place pour le leaderboard + QR
  const maxH = window.innerHeight - 40;

  // Calculer la taille d'un pixel a l'ecran
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
          </div>
        `;
      } else {
        return `
          <div class="lb-entry">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-name">${entry.pseudo}</span>
            <span class="lb-count">${entry.count} px</span>
          </div>
        `;
      }
    })
    .join("");
}

// Alterner entre leaderboard individuel et equipes toutes les 8 secondes
setInterval(() => {
  // Ne changer que s'il y a des equipes
  if (leaderboardData.teams.length > 0) {
    showTeamLeaderboard = !showTeamLeaderboard;
    displayCurrentLeaderboard();
  }
}, 8000);

// =============================================================================
// RECEPTION DES MESSAGES DU SERVEUR
// =============================================================================

ws.addEventListener("message", (event) => {
  const { type, data } = JSON.parse(event.data);

  // --- Etat initial ---
  if (type === "init") {
    canvasSize = data.canvasSize;
    fitCanvas();
    renderCanvas(data.canvas);
    renderLeaderboard(data.leaderboard);
    playerCountEl.textContent = `${data.playerCount} joueur${data.playerCount > 1 ? "s" : ""}`;

    if (data.playerCount > 0) {
      waitingEl.classList.add("hidden");
    }
  }

  // --- Un pixel a ete place ---
  if (type === "pixelUpdate") {
    updatePixel(data.x, data.y, data.color);

    // Cacher l'ecran d'attente des le premier pixel
    waitingEl.classList.add("hidden");
  }

  // --- Mise a jour du leaderboard ---
  if (type === "leaderboard") {
    renderLeaderboard(data);
  }

  // --- Nombre de joueurs ---
  if (type === "playerCount") {
    playerCountEl.textContent = `${data} joueur${data > 1 ? "s" : ""}`;
    if (data > 0) {
      waitingEl.classList.add("hidden");
    }
  }

  // --- Etat complet (rare, sur reconnexion) ---
  if (type === "state") {
    canvasSize = data.canvasSize;
    fitCanvas();
    renderCanvas(data.canvas);
    renderLeaderboard(data.leaderboard);
    playerCountEl.textContent = `${data.playerCount} joueur${data.playerCount > 1 ? "s" : ""}`;
  }
});

// Reconnexion WebSocket
ws.addEventListener("close", () => {
  console.log("Connexion perdue. Tentative de reconnexion...");
  setTimeout(() => location.reload(), 3000);
});