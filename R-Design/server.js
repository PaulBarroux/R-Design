// =============================================================================
// SERVEUR DE JEU — server.js
// =============================================================================
//
// Ce fichier est le "cerveau" du jeu. Il fait 3 choses :
//   1. Servir les pages web (controller + ecran de jeu) via Express
//   2. Gerer les connexions WebSocket (communication temps reel)
//   3. Stocker et mettre a jour l'etat du jeu (joueurs, fruits, scores, timer)
//
// Le serveur est AUTORITAIRE : c'est lui qui decide de la position des joueurs,
// des scores, etc. Les clients (telephones, ecran) ne font qu'afficher ce que
// le serveur leur envoie.
//
// =============================================================================

// --- Imports ---
// Express : framework web pour servir les fichiers HTML/CSS/JS
const express = require("express");
// createServer : cree un serveur HTTP a partir d'Express
const { createServer } = require("http");
// WebSocketServer : gere les connexions WebSocket (communication temps reel)
const { WebSocketServer } = require("ws");
// path : utilitaire pour construire des chemins de fichiers
const path = require("path");
// os : pour recuperer l'adresse IP locale de la machine
const os = require("os");

// --- Initialisation du serveur ---
const app = express(); // Application Express
const http = createServer(app); // Serveur HTTP qui enveloppe Express
const wss = new WebSocketServer({ server: http }); // Serveur WebSocket attache au serveur HTTP

const PORT = 3000;

// =============================================================================
// FICHIERS STATIQUES
// =============================================================================
// Express sert les dossiers "controller" et "game" comme des sites web statiques.
// Quand un telephone accede a http://IP:3000/controller, il recoit les fichiers
// du dossier "controller/" (index.html, style.css, script.js).
// Meme chose pour l'ecran de jeu avec /game.

app.use("/controller", express.static(path.join(__dirname, "controller")));
app.use("/game", express.static(path.join(__dirname, "game")));

// Si quelqu'un accede a la racine "/", on le redirige vers le controller
app.get("/", (req, res) => {
  res.redirect("/controller");
});

// =============================================================================
// CONFIGURATION DU JEU
// =============================================================================
// Toutes les constantes sont ici pour etre faciles a modifier.
// Changez ces valeurs pour ajuster le gameplay !

const ARENA = { width: 1200, height: 800 }; // Taille de l'arene en pixels
const SPEED = 5; // Vitesse de deplacement des joueurs (pixels par mouvement)
const GAME_DURATION = 5 * 60 * 1000; // Duree d'une partie : 5 minutes (en ms)
const RESTART_DELAY = 30 * 1000; // Delai avant relance : 30 secondes (en ms)
const FRUIT_COUNT = 5; // Nombre de fruits presents en meme temps sur la map
const PICKUP_DISTANCE = 30; // Distance (en pixels) pour ramasser un fruit

// =============================================================================
// ETAT DU JEU
// =============================================================================
// Ces variables contiennent TOUT l'etat du jeu a un instant T.
// C'est le serveur qui modifie ces variables, puis les envoie aux clients.

let players = {}; // Objet contenant tous les joueurs { id: { id, pseudo, team, x, y } }
let fruits = {}; // Objet contenant tous les fruits { id: { id, emoji, x, y } }
let scores = { rouge: 0, bleu: 0 }; // Score de chaque equipe

// Phase de jeu :
//   "waiting" = en attente du premier joueur
//   "playing" = partie en cours
//   "ended"   = partie terminee, en attente de relance
let gamePhase = "waiting";

let gameEndTime = 0; // Timestamp (ms) de fin de partie
let restartTime = 0; // Timestamp (ms) de relance
let nextId = 1; // Compteur pour generer des IDs uniques de joueurs
let nextFruitId = 1; // Compteur pour generer des IDs uniques de fruits
let gameInterval = null; // Reference au setInterval du tick de jeu
let restartTimeout = null; // Reference au setTimeout de relance

// =============================================================================
// GESTION DES FRUITS
// =============================================================================

// Liste des emojis de fruits possibles
const FRUIT_TYPES = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🍒", "🥝", "🍌", "🍐"];

// Retourne un emoji de fruit au hasard
function randomFruitType() {
  return FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
}

// Cree un nouveau fruit a une position aleatoire dans l'arene
function spawnFruit() {
  const id = String(nextFruitId++);
  fruits[id] = {
    id,
    emoji: randomFruitType(),
    // Position aleatoire avec une marge de 40px par rapport aux bords
    x: Math.floor(Math.random() * (ARENA.width - 80)) + 40,
    y: Math.floor(Math.random() * (ARENA.height - 80)) + 40,
  };
  return id;
}

// S'assure qu'il y a toujours FRUIT_COUNT fruits sur la map
// Si des fruits ont ete ramasces, en cree de nouveaux pour compenser
function fillFruits() {
  while (Object.keys(fruits).length < FRUIT_COUNT) {
    spawnFruit();
  }
}

// =============================================================================
// COLLISION JOUEUR / FRUIT
// =============================================================================
// Verifie si un joueur est assez proche d'un fruit pour le ramasser.
// On utilise la distance euclidienne (theoreme de Pythagore) :
//   distance = racine( (x2-x1)² + (y2-y1)² )

function checkPickup(player) {
  for (const [id, fruit] of Object.entries(fruits)) {
    const dx = player.x - fruit.x; // Distance horizontale
    const dy = player.y - fruit.y; // Distance verticale
    const distance = Math.sqrt(dx * dx + dy * dy); // Distance reelle

    if (distance < PICKUP_DISTANCE) {
      // Le joueur est assez proche : il ramasse le fruit !
      scores[player.team]++; // +1 point pour son equipe
      console.log(`${player.pseudo} a ramasse un fruit ! (${player.team}: ${scores[player.team]})`);
      delete fruits[id]; // Supprime le fruit ramasse
      fillFruits(); // S'assure qu'il y a toujours assez de fruits
      return true; // Un fruit a ete ramasse
    }
  }
  return false; // Aucun fruit ramasse
}

// =============================================================================
// GESTION DE LA PARTIE (START / END / RESTART)
// =============================================================================

// Demarre une nouvelle partie
function startGame() {
  // Remettre les scores a zero
  scores = { rouge: 0, bleu: 0 };

  // Regenerer tous les fruits
  fruits = {};
  fillFruits();

  // Passer en phase de jeu
  gamePhase = "playing";
  gameEndTime = Date.now() + GAME_DURATION; // Calcule quand la partie se termine

  // Repositionner tous les joueurs deja connectes a des positions aleatoires
  for (const player of Object.values(players)) {
    player.x = Math.floor(Math.random() * (ARENA.width - 100)) + 50;
    player.y = Math.floor(Math.random() * (ARENA.height - 100)) + 50;
  }

  console.log("--- Partie lancee ! ---");
  broadcastState(); // Envoyer l'etat initial a tout le monde

  // TICK DE JEU : toutes les secondes, on :
  //   - Verifie si la partie est terminee
  //   - S'assure qu'il y a assez de fruits
  //   - Envoie l'etat du jeu a tous les clients (pour mettre a jour le timer)
  gameInterval = setInterval(() => {
    if (Date.now() >= gameEndTime) {
      endGame(); // Le temps est ecoule !
    } else {
      fillFruits(); // S'assurer qu'il y a toujours des fruits
      broadcastState(); // Envoyer l'etat (met a jour le timer cote client)
    }
  }, 1000); // 1000ms = 1 seconde
}

// Termine la partie en cours
function endGame() {
  // Arreter le tick de jeu
  clearInterval(gameInterval);
  gameInterval = null;

  // Passer en phase "terminee"
  gamePhase = "ended";
  restartTime = Date.now() + RESTART_DELAY;

  // Determiner le gagnant
  const winner =
    scores.rouge > scores.bleu
      ? "rouge"
      : scores.bleu > scores.rouge
        ? "bleu"
        : "egalite";

  console.log(`--- Partie terminee ! Rouge: ${scores.rouge} | Bleu: ${scores.bleu} | Gagnant: ${winner} ---`);

  // Envoyer l'ecran de fin a tous les clients
  broadcast("gameOver", {
    scores,
    winner,
    restartIn: RESTART_DELAY, // Temps avant relance (en ms)
  });

  // Programmer la relance automatique apres RESTART_DELAY
  restartTimeout = setTimeout(() => {
    startGame();
  }, RESTART_DELAY);
}

// =============================================================================
// ENVOI DE MESSAGES WEBSOCKET
// =============================================================================
//
// Le protocole est simple : tous les messages sont du JSON avec cette structure :
//   { type: "nomDuMessage", data: { ... } }
//
// Par exemple : { type: "move", data: "up" }
//              { type: "state", data: { players, fruits, scores, ... } }

// Envoie un message a UN SEUL client
function send(ws, type, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

// Envoie un message a TOUS les clients connectes (broadcast)
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(msg);
    }
  });
}

// Envoie l'etat complet du jeu a tous les clients
// C'est cette fonction qui est appelee a chaque changement dans le jeu
function broadcastState() {
  broadcast("state", {
    players, // Tous les joueurs avec leurs positions
    fruits, // Tous les fruits avec leurs positions
    scores, // Scores des deux equipes
    arena: ARENA, // Dimensions de l'arene
    phase: gamePhase, // Phase actuelle (waiting/playing/ended)
    // Temps restant en ms (0 si la partie n'est pas en cours)
    timeLeft: gamePhase === "playing" ? Math.max(0, gameEndTime - Date.now()) : 0,
  });
}

// =============================================================================
// GESTION DES CONNEXIONS WEBSOCKET
// =============================================================================
// Chaque fois qu'un client (telephone ou ecran) se connecte, ce code s'execute.
// Le serveur ecoute les messages du client et reagit en consequence.

wss.on("connection", (ws) => {
  // Attribuer un ID unique a ce client
  const id = String(nextId++);
  ws._playerId = id;
  console.log(`Connexion: ${id}`);

  // --- Reception des messages du client ---
  ws.on("message", (raw) => {
    // Parser le message JSON
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // Message invalide, on l'ignore
    }

    const { type, data } = msg;

    // ----- MESSAGE "join" : un joueur veut rejoindre la partie -----
    if (type === "join") {
      // Creer le joueur avec une position aleatoire
      players[id] = {
        id,
        pseudo: data.pseudo || "Anonyme",
        team: data.team || "rouge",
        x: Math.floor(Math.random() * (ARENA.width - 100)) + 50,
        y: Math.floor(Math.random() * (ARENA.height - 100)) + 50,
      };

      console.log(`${players[id].pseudo} (${players[id].team}) a rejoint la partie`);

      // Confirmer au joueur qu'il a bien rejoint (pour changer d'ecran sur son tel)
      send(ws, "joined", players[id]);

      // Si c'est le premier joueur et qu'on attend, lancer la partie
      if (gamePhase === "waiting" && Object.keys(players).length >= 1) {
        startGame();
      } else {
        // Sinon, juste informer tout le monde du nouvel etat
        broadcastState();
      }
    }

    // ----- MESSAGE "move" : un joueur veut se deplacer -----
    // On ne traite les mouvements que pendant la phase de jeu
    if (type === "move" && gamePhase === "playing") {
      const player = players[id];
      if (!player) return; // Joueur inconnu

      // Deplacer le joueur dans la direction demandee
      // Math.max/Math.min empeche de sortir de l'arene
      switch (data) {
        case "up":
          player.y = Math.max(0, player.y - SPEED);
          break;
        case "down":
          player.y = Math.min(ARENA.height, player.y + SPEED);
          break;
        case "left":
          player.x = Math.max(0, player.x - SPEED);
          break;
        case "right":
          player.x = Math.min(ARENA.width, player.x + SPEED);
          break;
      }

      // Verifier si le joueur ramasse un fruit apres son deplacement
      checkPickup(player);

      // Envoyer le nouvel etat a tout le monde
      broadcastState();
    }
  });

  // --- Deconnexion d'un client ---
  ws.on("close", () => {
    if (players[id]) {
      console.log(`${players[id].pseudo} a quitte la partie`);
      delete players[id]; // Retirer le joueur de l'etat du jeu
      broadcastState(); // Informer tout le monde
    }
  });
});

// =============================================================================
// DEMARRAGE DU SERVEUR
// =============================================================================

http.listen(PORT, () => {
  // Trouver l'adresse IP locale de la machine sur le reseau WiFi
  // C'est cette IP que les joueurs utiliseront pour se connecter
  const nets = os.networkInterfaces();
  let localIP = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // On cherche une adresse IPv4 qui n'est pas "localhost" (127.0.0.1)
      if (net.family === "IPv4" && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }

  console.log("");
  console.log("===========================================");
  console.log("  SERVEUR DEMARRE !");
  console.log("===========================================");
  console.log("");
  console.log(`  Ecran de jeu : http://${localIP}:${PORT}/game`);
  console.log(`  Controller   : http://${localIP}:${PORT}/controller`);
  console.log("");
  console.log("  (Partagez le lien controller aux joueurs)");
  console.log("===========================================");
  console.log("");
});
