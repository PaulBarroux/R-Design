// =============================================================================
// SERVEUR PIXEL WAR — server.js
// =============================================================================
//
// Ce fichier est le "cerveau" du jeu Pixel War. Il fait 4 choses :
//   1. Servir les pages web (controller + ecran de jeu) via Express
//   2. Gerer les connexions WebSocket (communication temps reel)
//   3. Stocker et mettre a jour l'etat du jeu (canvas, joueurs, equipes)
//   4. Gerer le systeme d'equipes (creation, adhesion, overlays)
//
// Le serveur est AUTORITAIRE : c'est lui qui valide chaque placement de pixel,
// gere les cooldowns, et maintient l'etat du canvas.
//
// =============================================================================

// --- Imports ---
const express = require("express");
const { createServer } = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");
const os = require("os");

// --- Initialisation du serveur ---
const app = express();
const http = createServer(app);
const wss = new WebSocketServer({ server: http });

const PORT = 3000;

// =============================================================================
// FICHIERS STATIQUES
// =============================================================================

app.use("/controller", express.static(path.join(__dirname, "controller")));
app.use("/game", express.static(path.join(__dirname, "game")));

// Racine "/" redirige vers le controller (les telephones)
app.get("/", (req, res) => {
  res.redirect("/controller");
});

// =============================================================================
// CONFIGURATION DU JEU
// =============================================================================
// Toutes les constantes sont ici pour etre faciles a modifier.

const CANVAS_WIDTH = 200;   // Largeur du canvas en pixels
const CANVAS_HEIGHT = 200;  // Hauteur du canvas en pixels
const DEFAULT_COOLDOWN = 30 * 1000; // Cooldown par defaut : 30 secondes (en ms)

// Palette de couleurs disponibles pour les joueurs
// Inspiree de r/place — 16 couleurs bien distinctes
const COLOR_PALETTE = [
  "#FF4500", // Rouge-orange
  "#FF0000", // Rouge
  "#BE0039", // Cramoisi
  "#FF6D00", // Orange
  "#FFA800", // Orange clair
  "#FFD635", // Jaune
  "#00A368", // Vert
  "#00CC78", // Vert clair
  "#7EED56", // Vert lime
  "#009EAA", // Teal
  "#3690EA", // Bleu
  "#2450A4", // Bleu fonce
  "#493AC1", // Indigo
  "#811E9F", // Violet
  "#FF3881", // Rose
  "#FFFFFF", // Blanc
  "#D4D7D9", // Gris clair
  "#898D90", // Gris
  "#515252", // Gris fonce
  "#000000", // Noir
];

// =============================================================================
// ETAT DU JEU
// =============================================================================

// Le canvas : tableau 2D [y][x] ou chaque case est une couleur hex ou null
// null = pixel vide (non colore)
const canvas = [];
for (let y = 0; y < CANVAS_HEIGHT; y++) {
  canvas[y] = [];
  for (let x = 0; x < CANVAS_WIDTH; x++) {
    canvas[y][x] = null;
  }
}

// Joueurs connectes : cle = ID unique de 5 caracteres, valeur = objet joueur
// On utilise l'ID 5 chars comme cle pour permettre la reconnexion
const players = {};

// Equipes : cle = ID auto-increment, valeur = objet equipe
const teams = {};
let nextTeamId = 1;

// Historique des pixels places (pour le leaderboard)
// Chaque entree : { playerId, x, y, color, timestamp }
const pixelHistory = [];

// =============================================================================
// GENERATION D'ID UNIQUE (5 caracteres)
// =============================================================================
// Cet ID permet au joueur de se reconnecter plus tard.
// Format : 5 caracteres alphanumeriques (lettres majuscules + chiffres)

function generatePlayerId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sans 0/O/1/I pour eviter la confusion
  let id;
  do {
    id = "";
    for (let i = 0; i < 5; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (players[id]); // S'assurer que l'ID n'existe pas deja
  return id;
}

// =============================================================================
// CALCUL DU COOLDOWN DYNAMIQUE
// =============================================================================
// Le cooldown peut etre ajuste selon le nombre de joueurs connectes.
// Plus il y a de joueurs, plus le cooldown peut etre reduit.

function getCurrentCooldown() {
  const playerCount = Object.keys(players).length;
  if (playerCount > 100) return 10 * 1000;  // 10s si beaucoup de joueurs
  if (playerCount > 50) return 15 * 1000;   // 15s
  if (playerCount > 20) return 20 * 1000;   // 20s
  return DEFAULT_COOLDOWN;                    // 30s par defaut
}

// =============================================================================
// LEADERBOARD
// =============================================================================
// Calcule les classements individuels et par equipe.

function getLeaderboard() {
  // --- Classement individuel ---
  // Compter les pixels actuellement sur le canvas pour chaque joueur
  const playerPixelCount = {};

  // Compter les pixels actifs sur le canvas (pas l'historique, le canvas actuel)
  // On parcourt l'historique mais on ne compte que le dernier placement par pixel
  const currentPixelOwner = {}; // "x,y" -> playerId
  for (const entry of pixelHistory) {
    currentPixelOwner[`${entry.x},${entry.y}`] = entry.playerId;
  }

  // Compter combien de pixels chaque joueur possede actuellement
  for (const owner of Object.values(currentPixelOwner)) {
    playerPixelCount[owner] = (playerPixelCount[owner] || 0) + 1;
  }

  const individualBoard = Object.entries(playerPixelCount)
    .map(([playerId, count]) => ({
      playerId,
      pseudo: players[playerId] ? players[playerId].pseudo : "???",
      teamId: players[playerId] ? players[playerId].teamId : null,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15); // Top 15

  // --- Classement par equipe ---
  const teamPixelCount = {};
  for (const [playerId, count] of Object.entries(playerPixelCount)) {
    const player = players[playerId];
    if (player && player.teamId) {
      teamPixelCount[player.teamId] = (teamPixelCount[player.teamId] || 0) + count;
    }
  }

  const teamBoard = Object.entries(teamPixelCount)
    .map(([teamId, count]) => ({
      teamId,
      name: teams[teamId] ? teams[teamId].name : "???",
      color: teams[teamId] ? teams[teamId].color : "#888",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  return { individual: individualBoard, teams: teamBoard };
}

// =============================================================================
// ENVOI DE MESSAGES WEBSOCKET
// =============================================================================

// Envoie un message a UN SEUL client
function send(ws, type, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

// Envoie un message a TOUS les clients connectes
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(msg);
    }
  });
}

// Envoie l'etat complet du canvas + leaderboard a tous les clients
// Appele periodiquement et apres chaque placement de pixel
function broadcastState() {
  broadcast("state", {
    canvas,
    canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    leaderboard: getLeaderboard(),
    teams: getTeamsPublicData(),
    playerCount: Object.keys(players).length,
    palette: COLOR_PALETTE,
  });
}

// Envoie juste le pixel modifie (plus leger que l'etat complet)
// Utilise apres chaque placement pour une mise a jour rapide
function broadcastPixelUpdate(x, y, color, playerId) {
  broadcast("pixelUpdate", { x, y, color, playerId });
}

// Envoie le leaderboard mis a jour
function broadcastLeaderboard() {
  broadcast("leaderboard", getLeaderboard());
}

// =============================================================================
// DONNEES PUBLIQUES DES EQUIPES
// =============================================================================
// Retourne les infos des equipes sans les donnees sensibles

function getTeamsPublicData() {
  const result = {};
  for (const [id, team] of Object.entries(teams)) {
    result[id] = {
      id: team.id,
      name: team.name,
      color: team.color,
      memberCount: team.members.length,
      creatorId: team.creatorId,
      // Overlay : tableau 2D avec les pixels-guide (ou null si pas d'overlay)
      overlay: team.overlay || null,
    };
  }
  return result;
}

// =============================================================================
// GESTION DES CONNEXIONS WEBSOCKET
// =============================================================================

wss.on("connection", (ws) => {
  console.log("Nouvelle connexion WebSocket");

  // Envoyer l'etat initial au nouveau client
  send(ws, "init", {
    canvas,
    canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    leaderboard: getLeaderboard(),
    teams: getTeamsPublicData(),
    playerCount: Object.keys(players).length,
    palette: COLOR_PALETTE,
  });

  // --- Reception des messages du client ---
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return; // Message invalide
    }

    const { type, data } = msg;

    // =====================================================================
    // MESSAGE "join" : un nouveau joueur veut rejoindre
    // =====================================================================
    // data : { pseudo }
    // Reponse : { playerId, pseudo, cooldown }

    if (type === "join") {
      const pseudo = (data.pseudo || "Anonyme").trim().substring(0, 16);
      const playerId = generatePlayerId();

      players[playerId] = {
        id: playerId,
        pseudo,
        teamId: null,          // Pas d'equipe au depart
        lastPlacement: 0,      // Timestamp du dernier pixel pose
        totalPixels: 0,        // Nombre total de pixels poses (historique)
        connectedAt: Date.now(),
      };

      // Associer l'ID au WebSocket pour retrouver le joueur
      ws._playerId = playerId;

      console.log(`${pseudo} a rejoint (ID: ${playerId})`);

      send(ws, "joined", {
        playerId,
        pseudo,
        cooldown: getCurrentCooldown(),
        palette: COLOR_PALETTE,
        canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      });

      // Informer tout le monde du nouveau nombre de joueurs
      broadcast("playerCount", Object.keys(players).length);
    }

    // =====================================================================
    // MESSAGE "reconnect" : un joueur revient avec son ID
    // =====================================================================
    // data : { playerId }

    if (type === "reconnect") {
      const playerId = (data.playerId || "").trim().toUpperCase();

      if (players[playerId]) {
        ws._playerId = playerId;
        console.log(`${players[playerId].pseudo} s'est reconnecte (ID: ${playerId})`);

        send(ws, "joined", {
          playerId,
          pseudo: players[playerId].pseudo,
          teamId: players[playerId].teamId,
          cooldown: getCurrentCooldown(),
          palette: COLOR_PALETTE,
          canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        });
      } else {
        send(ws, "error", { message: "ID inconnu. Veuillez creer un nouveau compte." });
      }
    }

    // =====================================================================
    // MESSAGE "placePixel" : un joueur veut poser un pixel
    // =====================================================================
    // data : { x, y, color }

    if (type === "placePixel") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) {
        send(ws, "error", { message: "Vous devez d'abord rejoindre la partie." });
        return;
      }

      const player = players[playerId];
      const { x, y, color } = data;

      // --- Validation ---
      // Verifier que les coordonnees sont dans le canvas
      if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) {
        send(ws, "error", { message: "Coordonnees hors du canvas." });
        return;
      }

      // Verifier que la couleur est dans la palette
      if (!COLOR_PALETTE.includes(color)) {
        send(ws, "error", { message: "Couleur invalide." });
        return;
      }

      // Verifier le cooldown
      const cooldown = getCurrentCooldown();
      const timeSinceLast = Date.now() - player.lastPlacement;
      if (timeSinceLast < cooldown) {
        const remaining = Math.ceil((cooldown - timeSinceLast) / 1000);
        send(ws, "cooldownError", {
          message: `Attendez encore ${remaining}s`,
          remaining: cooldown - timeSinceLast,
        });
        return;
      }

      // --- Placement du pixel ---
      canvas[y][x] = color;
      player.lastPlacement = Date.now();
      player.totalPixels++;

      // Ajouter a l'historique
      pixelHistory.push({
        playerId,
        x,
        y,
        color,
        timestamp: Date.now(),
      });

      console.log(`${player.pseudo} a pose un pixel en (${x},${y}) couleur ${color}`);

      // Confirmer au joueur
      send(ws, "pixelPlaced", {
        x,
        y,
        color,
        cooldown,
        nextPlacement: Date.now() + cooldown,
      });

      // Informer tous les clients du nouveau pixel
      broadcastPixelUpdate(x, y, color, playerId);

      // Mettre a jour le leaderboard (pas a chaque pixel pour la perf)
      // On le fait toutes les 5 secondes via le tick, mais aussi ici pour l'instantaneite
      broadcastLeaderboard();
    }

    // =====================================================================
    // MESSAGE "createTeam" : un joueur cree une equipe
    // =====================================================================
    // data : { name, color }

    if (type === "createTeam") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) {
        send(ws, "error", { message: "Vous devez d'abord rejoindre la partie." });
        return;
      }

      const player = players[playerId];
      const name = (data.name || "").trim().substring(0, 24);
      const color = data.color || "#3690EA";

      if (!name) {
        send(ws, "error", { message: "Le nom de l'equipe est requis." });
        return;
      }

      // Verifier que le nom n'est pas deja pris
      const nameExists = Object.values(teams).some(
        (t) => t.name.toLowerCase() === name.toLowerCase()
      );
      if (nameExists) {
        send(ws, "error", { message: "Ce nom d'equipe est deja pris." });
        return;
      }

      // Quitter l'ancienne equipe si le joueur en avait une
      if (player.teamId && teams[player.teamId]) {
        const oldTeam = teams[player.teamId];
        oldTeam.members = oldTeam.members.filter((id) => id !== playerId);
        // Supprimer l'equipe si elle est vide
        if (oldTeam.members.length === 0) {
          delete teams[player.teamId];
        }
      }

      // Creer l'equipe
      const teamId = String(nextTeamId++);
      teams[teamId] = {
        id: teamId,
        name,
        color,
        creatorId: playerId,
        members: [playerId],
        overlay: null, // Pas d'overlay par defaut
        createdAt: Date.now(),
      };

      player.teamId = teamId;

      console.log(`${player.pseudo} a cree l'equipe "${name}" (ID: ${teamId})`);

      send(ws, "teamJoined", {
        teamId,
        team: getTeamsPublicData()[teamId],
      });

      // Informer tout le monde des equipes mises a jour
      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // =====================================================================
    // MESSAGE "joinTeam" : un joueur rejoint une equipe existante
    // =====================================================================
    // data : { teamId }

    if (type === "joinTeam") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) {
        send(ws, "error", { message: "Vous devez d'abord rejoindre la partie." });
        return;
      }

      const player = players[playerId];
      const teamId = String(data.teamId);

      if (!teams[teamId]) {
        send(ws, "error", { message: "Equipe introuvable." });
        return;
      }

      // Quitter l'ancienne equipe
      if (player.teamId && teams[player.teamId]) {
        const oldTeam = teams[player.teamId];
        oldTeam.members = oldTeam.members.filter((id) => id !== playerId);
        if (oldTeam.members.length === 0) {
          delete teams[player.teamId];
        }
      }

      // Rejoindre la nouvelle equipe
      teams[teamId].members.push(playerId);
      player.teamId = teamId;

      console.log(`${player.pseudo} a rejoint l'equipe "${teams[teamId].name}"`);

      send(ws, "teamJoined", {
        teamId,
        team: getTeamsPublicData()[teamId],
      });

      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // =====================================================================
    // MESSAGE "leaveTeam" : un joueur quitte son equipe
    // =====================================================================

    if (type === "leaveTeam") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;

      const player = players[playerId];
      if (!player.teamId || !teams[player.teamId]) return;

      const team = teams[player.teamId];
      team.members = team.members.filter((id) => id !== playerId);

      console.log(`${player.pseudo} a quitte l'equipe "${team.name}"`);

      // Si l'equipe est vide, la supprimer
      if (team.members.length === 0) {
        console.log(`Equipe "${team.name}" supprimee (vide)`);
        delete teams[player.teamId];
      }

      player.teamId = null;

      send(ws, "teamLeft", {});
      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // =====================================================================
    // MESSAGE "setOverlay" : le createur definit un overlay pour son equipe
    // =====================================================================
    // data : { overlay } — tableau 2D [y][x] de couleurs hex ou null
    // Seul le createur de l'equipe peut faire ca

    if (type === "setOverlay") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;

      const player = players[playerId];
      if (!player.teamId || !teams[player.teamId]) return;

      const team = teams[player.teamId];

      // Verifier que c'est le createur
      if (team.creatorId !== playerId) {
        send(ws, "error", { message: "Seul le createur de l'equipe peut definir l'overlay." });
        return;
      }

      // Valider l'overlay (doit etre un tableau 2D de la bonne taille)
      const overlay = data.overlay;
      if (overlay && Array.isArray(overlay) && overlay.length === CANVAS_HEIGHT) {
        team.overlay = overlay;
        console.log(`Overlay mis a jour pour l'equipe "${team.name}"`);
      } else if (overlay === null) {
        team.overlay = null;
        console.log(`Overlay supprime pour l'equipe "${team.name}"`);
      } else {
        send(ws, "error", { message: "Format d'overlay invalide." });
        return;
      }

      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // =====================================================================
    // MESSAGE "getPixelInfo" : demander des infos sur un pixel
    // =====================================================================
    // data : { x, y }

    if (type === "getPixelInfo") {
      const { x, y } = data;
      if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return;

      // Trouver le dernier joueur a avoir place ce pixel
      let lastPlacer = null;
      for (let i = pixelHistory.length - 1; i >= 0; i--) {
        if (pixelHistory[i].x === x && pixelHistory[i].y === y) {
          lastPlacer = pixelHistory[i];
          break;
        }
      }

      send(ws, "pixelInfo", {
        x,
        y,
        color: canvas[y][x],
        placedBy: lastPlacer
          ? {
              playerId: lastPlacer.playerId,
              pseudo: players[lastPlacer.playerId]
                ? players[lastPlacer.playerId].pseudo
                : "???",
              timestamp: lastPlacer.timestamp,
            }
          : null,
      });
    }
  });

  // --- Deconnexion d'un client ---
  // On ne supprime PAS le joueur : il peut se reconnecter avec son ID
  ws.on("close", () => {
    const playerId = ws._playerId;
    if (playerId && players[playerId]) {
      console.log(`${players[playerId].pseudo} s'est deconnecte (ID conserve: ${playerId})`);
    }
    // Note : on garde le joueur dans "players" pour permettre la reconnexion
    // Un systeme de nettoyage pourrait supprimer les joueurs inactifs apres X heures
  });
});

// =============================================================================
// TICK PERIODIQUE
// =============================================================================
// Envoie le leaderboard mis a jour toutes les 10 secondes

setInterval(() => {
  broadcastLeaderboard();
}, 10000);

// =============================================================================
// DEMARRAGE DU SERVEUR
// =============================================================================

http.listen(PORT, () => {
  const nets = os.networkInterfaces();
  let localIP = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }

  console.log("");
  console.log("===========================================");
  console.log("  🎨 PIXEL WAR — SERVEUR DEMARRE !");
  console.log("===========================================");
  console.log("");
  console.log(`  Ecran de jeu : http://${localIP}:${PORT}/game`);
  console.log(`  Controller   : http://${localIP}:${PORT}/controller`);
  console.log("");
  console.log(`  Canvas : ${CANVAS_WIDTH}x${CANVAS_HEIGHT} pixels`);
  console.log(`  Cooldown : ${DEFAULT_COOLDOWN / 1000}s (dynamique)`);
  console.log(`  Palette : ${COLOR_PALETTE.length} couleurs`);
  console.log("");
  console.log("  (Partagez le lien controller aux joueurs)");
  console.log("===========================================");
  console.log("");
});