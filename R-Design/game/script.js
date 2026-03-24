// =============================================================================
// ECRAN DE JEU — script.js (affiche sur le projecteur / TV)
// =============================================================================
//
// Ce fichier gere l'affichage du jeu sur l'ecran partage.
// Il ne fait qu'AFFICHER : aucune logique de jeu ici, tout vient du serveur.
//
// Il fait 3 choses :
//   1. Se connecter au serveur via WebSocket
//   2. Adapter la taille de l'arene a l'ecran (responsive)
//   3. Afficher les joueurs, fruits, scores, timer, et ecran de fin
//
// =============================================================================

// --- Connexion WebSocket ---
// Meme principe que le controller : on se connecte au serveur qui nous a servi la page
const ws = new WebSocket(`ws://${location.host}`);

// =============================================================================
// QR CODE
// =============================================================================
// Genere un QR code pointant vers la page controller.
// Utilise la librairie "qrcode-generator" chargee via CDN dans le HTML.
// L'URL est construite a partir de location.host (IP:port du serveur actuel).

(function generateQRCode() {
  const controllerURL = `http://${location.host}/controller`;
  // qrcode(typeNumber, errorCorrectionLevel) — type 0 = auto, "L" = correction minimale
  const qr = qrcode(0, "L");
  qr.addData(controllerURL);
  qr.make();
  // createImgTag(cellSize, margin) — genere une balise <img> avec le QR code
  document.getElementById("qr-code").innerHTML = qr.createImgTag(4, 0);
})();

// =============================================================================
// REFERENCES AUX ELEMENTS HTML
// =============================================================================

const arena = document.getElementById("arena");
const arenaWrapper = document.getElementById("arena-wrapper");
const waiting = document.getElementById("waiting");
const scoreRouge = document.getElementById("score-rouge");
const scoreBleu = document.getElementById("score-bleu");
const timerEl = document.getElementById("timer");
const screenGameover = document.getElementById("screen-gameover");
const gameoverTitle = document.getElementById("gameover-title");
const finalRouge = document.getElementById("final-rouge");
const finalBleu = document.getElementById("final-bleu");
const restartCountdown = document.getElementById("restart-countdown");

// =============================================================================
// RESPONSIVE : ADAPTER L'ARENE A L'ECRAN
// =============================================================================
// L'arene fait 1200x800 pixels en interne, mais l'ecran peut etre plus petit.
// On calcule un facteur de scale pour que l'arene tienne dans l'espace disponible.
// Tout le contenu de l'arene (joueurs, fruits) est automatiquement redimensionne
// grace au CSS transform: scale().

function fitArena() {
  const maxW = arenaWrapper.clientWidth - 32; // Largeur dispo (avec marge)
  const maxH = arenaWrapper.clientHeight - 32; // Hauteur dispo (avec marge)
  // On prend le plus petit ratio pour que l'arene tienne en largeur ET en hauteur
  // Le "1" empeche de zoomer au-dela de la taille native
  const scale = Math.min(maxW / 1200, maxH / 800, 1);
  arena.style.transform = `scale(${scale})`;
}

// Appeler au chargement et a chaque redimensionnement de la fenetre
fitArena();
window.addEventListener("resize", fitArena);

// =============================================================================
// GESTION DES ELEMENTS DOM DYNAMIQUES
// =============================================================================
// On garde en memoire les elements HTML crees pour chaque joueur et fruit.
// Cela permet de les mettre a jour ou les supprimer quand l'etat change.
// Cle = ID du joueur/fruit, Valeur = element HTML (<div>)

const playerElements = {};
const fruitElements = {};

// =============================================================================
// FORMATER LE TEMPS
// =============================================================================

let timeLeft = 0;

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

// =============================================================================
// RECEPTION DES MESSAGES DU SERVEUR
// =============================================================================

ws.addEventListener("message", (event) => {
  const { type, data } = JSON.parse(event.data);

  // =========================================================================
  // MESSAGE "state" : mise a jour complete de l'etat du jeu
  // =========================================================================
  // Recu toutes les secondes + a chaque action d'un joueur.
  // Contient : joueurs, fruits, scores, phase, temps restant.

  if (type === "state") {
    const { players, fruits, scores, phase } = data;
    timeLeft = data.timeLeft || 0;

    // --- Cacher l'ecran game over si la partie reprend ---
    if (phase === "playing") {
      screenGameover.classList.add("hidden");
    }

    // --- Message "En attente de joueurs..." ---
    const ids = Object.keys(players);
    waiting.style.display = ids.length === 0 && phase === "waiting" ? "flex" : "none";

    // --- Timer ---
    timerEl.textContent = formatTime(timeLeft);
    // Le timer devient rouge et clignote quand il reste moins de 30 secondes
    timerEl.classList.toggle("urgent", timeLeft < 30000 && timeLeft > 0);

    // --- Scores dans le HUD ---
    scoreRouge.textContent = scores.rouge;
    scoreBleu.textContent = scores.bleu;

    // -----------------------------------------------------------------
    // MISE A JOUR DES JOUEURS
    // -----------------------------------------------------------------
    // Pour chaque joueur dans l'etat du serveur :
    //   - S'il n'existe pas encore dans le DOM, on cree son element HTML
    //   - On met a jour sa position (left/top en CSS)

    ids.forEach((id) => {
      const p = players[id];

      // Creer l'element du joueur s'il n'existe pas encore
      if (!playerElements[id]) {
        const el = document.createElement("div");
        el.className = "player";
        // Le joueur est un cercle colore avec son pseudo en dessous
        el.innerHTML = `
          <div class="player-dot ${p.team}"></div>
          <span class="player-name">${p.pseudo}</span>
        `;
        arena.appendChild(el);
        playerElements[id] = el;
      }

      // Mettre a jour la position du joueur
      // Le -15 centre le cercle (30px de large / 2) sur la position x,y
      const el = playerElements[id];
      el.style.left = p.x - 15 + "px";
      el.style.top = p.y - 15 + "px";
    });

    // Supprimer les joueurs qui se sont deconnectes
    // (presents dans le DOM mais absents de l'etat du serveur)
    Object.keys(playerElements).forEach((id) => {
      if (!players[id]) {
        playerElements[id].remove(); // Retirer du DOM
        delete playerElements[id]; // Retirer de notre dictionnaire
      }
    });

    // -----------------------------------------------------------------
    // MISE A JOUR DES FRUITS
    // -----------------------------------------------------------------
    // Meme principe que les joueurs : creer/positionner/supprimer

    const fruitIds = Object.keys(fruits);

    fruitIds.forEach((id) => {
      const f = fruits[id];

      // Creer l'element du fruit s'il n'existe pas encore
      if (!fruitElements[id]) {
        const el = document.createElement("div");
        el.className = "fruit";
        el.textContent = f.emoji; // L'emoji du fruit (🍎, 🍊, etc.)
        arena.appendChild(el);
        fruitElements[id] = el;
      }

      // Positionner le fruit
      const el = fruitElements[id];
      el.style.left = f.x - 14 + "px";
      el.style.top = f.y - 14 + "px";
    });

    // Supprimer les fruits qui ont ete ramasces
    Object.keys(fruitElements).forEach((id) => {
      if (!fruits[id]) {
        fruitElements[id].remove();
        delete fruitElements[id];
      }
    });
  }

  // =========================================================================
  // MESSAGE "gameOver" : la partie est terminee
  // =========================================================================
  // Affiche l'ecran de fin avec les scores et un compte a rebours.

  if (type === "gameOver") {
    const { scores, winner, restartIn } = data;

    // Afficher l'overlay de fin
    screenGameover.classList.remove("hidden");

    // Afficher les scores finaux
    finalRouge.textContent = scores.rouge;
    finalBleu.textContent = scores.bleu;

    // Afficher le titre selon le gagnant
    if (winner === "egalite") {
      gameoverTitle.textContent = "Egalite !";
    } else {
      gameoverTitle.textContent =
        winner === "rouge" ? "Les Rouges gagnent !" : "Les Bleus gagnent !";
    }

    // Mettre en avant l'equipe gagnante (scale un peu plus grand)
    document.querySelectorAll(".gameover-team").forEach((el) => {
      el.classList.remove("winner");
      if (el.classList.contains(winner)) {
        el.classList.add("winner");
      }
    });

    // --- Compte a rebours avant la prochaine partie ---
    let remaining = Math.ceil(restartIn / 1000); // Convertir ms en secondes
    restartCountdown.textContent = remaining;
    const countdownInterval = setInterval(() => {
      remaining--;
      restartCountdown.textContent = Math.max(0, remaining);
      if (remaining <= 0) clearInterval(countdownInterval); // Arreter quand c'est fini
    }, 1000);
  }
});
