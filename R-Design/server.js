// =============================================================================
// SERVEUR PIXEL WAR — server.js
// =============================================================================
//
// Ce fichier est le "cerveau" du jeu Pixel War. Il fait 4 choses :
//   1. Servir les pages web (controller + ecran de jeu) via Express
//   2. Gerer les connexions WebSocket (communication temps reel)
//   3. Stocker et mettre a jour l'etat du jeu (canvas, joueurs, equipes)
//   4. Gerer le systeme d'equipes (creation, adhesion, kick, overlays)
//
// =============================================================================

const express = require("express");
const { createServer } = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");
const os = require("os");

const app = express();
const http = createServer(app);
const wss = new WebSocketServer({ server: http });

const PORT = 3000;

// =============================================================================
// FICHIERS STATIQUES
// =============================================================================

app.use("/controller", express.static(path.join(__dirname, "controller")));
app.use("/game", express.static(path.join(__dirname, "game")));

app.get("/", (req, res) => {
  res.redirect("/controller");
});

// =============================================================================
// CONFIGURATION DU JEU
// =============================================================================

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 200;
const DEFAULT_COOLDOWN = 30 * 1000;
const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 min sans action = inactif

const COLOR_PALETTE = [
  "#FF4500", "#FF0000", "#BE0039", "#FF6D00", "#FFA800",
  "#FFD635", "#00A368", "#00CC78", "#7EED56", "#009EAA",
  "#3690EA", "#2450A4", "#493AC1", "#811E9F", "#FF3881",
  "#FFFFFF", "#D4D7D9", "#898D90", "#515252", "#000000",
];

// =============================================================================
// ETAT DU JEU
// =============================================================================

// Canvas en damier par defaut (alternance blanc / gris clair)
const canvas = [];
for (let y = 0; y < CANVAS_HEIGHT; y++) {
  canvas[y] = [];
  for (let x = 0; x < CANVAS_WIDTH; x++) {
    canvas[y][x] = (x + y) % 2 === 0 ? "#FFFFFF" : "#D4D7D9";
  }
}

const players = {};
const teams = {};
let nextTeamId = 1;
const pixelHistory = [];

// =============================================================================
// GENERATION D'ID UNIQUE (5 caracteres)
// =============================================================================

function generatePlayerId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id;
  do {
    id = "";
    for (let i = 0; i < 5; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (players[id]);
  return id;
}

// =============================================================================
// COOLDOWN DYNAMIQUE
// =============================================================================

function getCurrentCooldown() {
  const activePlayers = Object.values(players).filter((p) => p.active).length;
  if (activePlayers > 100) return 10 * 1000;
  if (activePlayers > 50) return 15 * 1000;
  if (activePlayers > 20) return 20 * 1000;
  return DEFAULT_COOLDOWN;
}

// =============================================================================
// STATUT ACTIF / INACTIF
// =============================================================================

function updatePlayerActivity(playerId) {
  if (players[playerId]) {
    players[playerId].lastActivity = Date.now();
    if (!players[playerId].active) {
      players[playerId].active = true;
      broadcastPlayerList();
    }
  }
}

function checkInactivePlayers() {
  const now = Date.now();
  let changed = false;
  for (const player of Object.values(players)) {
    const wasActive = player.active;
    player.active = (now - player.lastActivity) < INACTIVE_THRESHOLD;
    if (wasActive !== player.active) changed = true;
  }
  if (changed) broadcastPlayerList();
}

setInterval(checkInactivePlayers, 30000);

// =============================================================================
// LEADERBOARD
// =============================================================================

function getLeaderboard() {
  const currentPixelOwner = {};
  for (const entry of pixelHistory) {
    currentPixelOwner[`${entry.x},${entry.y}`] = entry.playerId;
  }

  const playerPixelCount = {};
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
    .slice(0, 15);

  const teamPixelCount = {};
  for (const [playerId, count] of Object.entries(playerPixelCount)) {
    const player = players[playerId];
    if (player && player.teamId && teams[player.teamId]) {
      teamPixelCount[player.teamId] = (teamPixelCount[player.teamId] || 0) + count;
    }
  }

  const teamBoard = Object.entries(teamPixelCount)
    .map(([teamId, count]) => ({
      teamId,
      name: teams[teamId] ? teams[teamId].name : "???",
      color: teams[teamId] ? teams[teamId].color : "#888",
      memberCount: teams[teamId] ? teams[teamId].members.length : 0,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { individual: individualBoard, teams: teamBoard };
}

function getTeamPixelCount(teamId) {
  const currentPixelOwner = {};
  for (const entry of pixelHistory) {
    currentPixelOwner[`${entry.x},${entry.y}`] = entry.playerId;
  }
  let count = 0;
  for (const owner of Object.values(currentPixelOwner)) {
    if (players[owner] && players[owner].teamId === teamId) count++;
  }
  return count;
}

// =============================================================================
// WEBSOCKET — ENVOI
// =============================================================================

function send(ws, type, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach((c) => {
    if (c.readyState === c.OPEN) c.send(msg);
  });
}

function broadcastPixelUpdate(x, y, color, playerId) {
  broadcast("pixelUpdate", { x, y, color, playerId });
}

function broadcastLeaderboard() {
  broadcast("leaderboard", getLeaderboard());
}

function broadcastPlayerList() {
  broadcast("playerCount", getActivePlayerCount());
}

function getActivePlayerCount() {
  return Object.values(players).filter((p) => p.active).length;
}

// =============================================================================
// DONNEES PUBLIQUES DES EQUIPES
// =============================================================================

function getTeamsPublicData() {
  const result = {};
  for (const [id, team] of Object.entries(teams)) {
    result[id] = {
      id: team.id,
      name: team.name,
      color: team.color,
      memberCount: team.members.length,
      creatorId: team.creatorId,
      overlay: team.overlay || null,
      pixelCount: getTeamPixelCount(id),
      members: team.members.map((pid) => ({
        id: pid,
        pseudo: players[pid] ? players[pid].pseudo : "???",
        active: players[pid] ? players[pid].active : false,
        isCreator: pid === team.creatorId,
      })),
    };
  }
  return result;
}

// =============================================================================
// UTILITAIRE : RETIRER UN JOUEUR D'UNE EQUIPE
// =============================================================================

function removePlayerFromTeam(playerId, teamId) {
  const team = teams[teamId];
  if (!team) return;
  team.members = team.members.filter((id) => id !== playerId);
  if (team.members.length === 0) {
    console.log(`Equipe "${team.name}" supprimee (vide)`);
    delete teams[teamId];
  } else if (team.creatorId === playerId) {
    team.creatorId = team.members[0];
    console.log(`Nouveau createur de "${team.name}": ${players[team.members[0]]?.pseudo}`);
  }
}

// =============================================================================
// GESTION DES CONNEXIONS WEBSOCKET
// =============================================================================

wss.on("connection", (ws) => {
  console.log("Nouvelle connexion WebSocket");

  send(ws, "init", {
    canvas,
    canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    leaderboard: getLeaderboard(),
    teams: getTeamsPublicData(),
    playerCount: getActivePlayerCount(),
    palette: COLOR_PALETTE,
  });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, data } = msg;

    // === JOIN ===
    if (type === "join") {
      const pseudo = (data.pseudo || "Anonyme").trim().substring(0, 16);
      const playerId = generatePlayerId();

      players[playerId] = {
        id: playerId, pseudo, teamId: null,
        lastPlacement: 0, totalPixels: 0,
        connectedAt: Date.now(), lastActivity: Date.now(), active: true,
      };
      ws._playerId = playerId;
      console.log(`${pseudo} a rejoint (ID: ${playerId})`);

      send(ws, "joined", {
        playerId, pseudo, teamId: null,
        cooldown: getCurrentCooldown(),
        palette: COLOR_PALETTE,
        canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      });
      broadcastPlayerList();
    }

    // === RECONNECT ===
    if (type === "reconnect") {
      const playerId = (data.playerId || "").trim().toUpperCase();
      if (players[playerId]) {
        ws._playerId = playerId;
        players[playerId].active = true;
        players[playerId].lastActivity = Date.now();
        console.log(`${players[playerId].pseudo} s'est reconnecte (ID: ${playerId})`);

        send(ws, "joined", {
          playerId, pseudo: players[playerId].pseudo,
          teamId: players[playerId].teamId,
          cooldown: getCurrentCooldown(),
          palette: COLOR_PALETTE,
          canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        });
        broadcastPlayerList();
      } else {
        send(ws, "joinError", {
          message: "Cet identifiant n'existe pas. Verifiez votre code ou creez un nouveau compte.",
        });
      }
    }

    // === PLACE PIXEL ===
    if (type === "placePixel") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) {
        send(ws, "gameError", { message: "Vous devez d'abord rejoindre la partie." });
        return;
      }
      const player = players[playerId];
      const { x, y, color } = data;

      if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) {
        send(ws, "gameError", { message: "Coordonnees hors du canvas." });
        return;
      }
      if (!COLOR_PALETTE.includes(color)) {
        send(ws, "gameError", { message: "Couleur invalide." });
        return;
      }

      const cooldown = getCurrentCooldown();
      const timeSinceLast = Date.now() - player.lastPlacement;
      if (timeSinceLast < cooldown) {
        const remaining = Math.ceil((cooldown - timeSinceLast) / 1000);
        send(ws, "cooldownError", { message: `Attendez encore ${remaining}s`, remaining: cooldown - timeSinceLast });
        return;
      }

      canvas[y][x] = color;
      player.lastPlacement = Date.now();
      player.totalPixels++;
      updatePlayerActivity(playerId);
      pixelHistory.push({ playerId, x, y, color, timestamp: Date.now() });

      console.log(`${player.pseudo} a pose un pixel en (${x},${y}) couleur ${color}`);
      send(ws, "pixelPlaced", { x, y, color, cooldown, nextPlacement: Date.now() + cooldown });
      broadcastPixelUpdate(x, y, color, playerId);
      broadcastLeaderboard();
    }

    // === CREATE TEAM ===
    if (type === "createTeam") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) {
        send(ws, "gameError", { message: "Vous devez d'abord rejoindre la partie." });
        return;
      }
      const player = players[playerId];
      const name = (data.name || "").trim().substring(0, 24);
      const color = data.color || "#3690EA";

      if (!name) { send(ws, "gameError", { message: "Le nom de l'equipe est requis." }); return; }

      const nameExists = Object.values(teams).some((t) => t.name.toLowerCase() === name.toLowerCase());
      if (nameExists) { send(ws, "gameError", { message: "Ce nom d'equipe est deja pris." }); return; }

      if (player.teamId && teams[player.teamId]) removePlayerFromTeam(playerId, player.teamId);

      const teamId = String(nextTeamId++);
      teams[teamId] = {
        id: teamId, name, color, creatorId: playerId,
        members: [playerId], overlay: null, createdAt: Date.now(),
      };
      player.teamId = teamId;
      updatePlayerActivity(playerId);
      console.log(`${player.pseudo} a cree l'equipe "${name}" (ID: ${teamId})`);

      send(ws, "teamJoined", { teamId, team: getTeamsPublicData()[teamId] });
      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // === JOIN TEAM ===
    if (type === "joinTeam") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) {
        send(ws, "gameError", { message: "Vous devez d'abord rejoindre la partie." });
        return;
      }
      const player = players[playerId];
      const teamId = String(data.teamId);
      if (!teams[teamId]) { send(ws, "gameError", { message: "Equipe introuvable." }); return; }

      if (player.teamId && teams[player.teamId]) removePlayerFromTeam(playerId, player.teamId);

      teams[teamId].members.push(playerId);
      player.teamId = teamId;
      updatePlayerActivity(playerId);
      console.log(`${player.pseudo} a rejoint l'equipe "${teams[teamId].name}"`);

      send(ws, "teamJoined", { teamId, team: getTeamsPublicData()[teamId] });
      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // === LEAVE TEAM ===
    if (type === "leaveTeam") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;
      const player = players[playerId];
      if (!player.teamId || !teams[player.teamId]) return;

      const teamName = teams[player.teamId].name;
      removePlayerFromTeam(playerId, player.teamId);
      player.teamId = null;
      console.log(`${player.pseudo} a quitte l'equipe "${teamName}"`);

      send(ws, "teamLeft", {});
      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // === KICK MEMBER (createur uniquement) ===
    if (type === "kickMember") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;
      const player = players[playerId];
      if (!player.teamId || !teams[player.teamId]) return;

      const team = teams[player.teamId];
      if (team.creatorId !== playerId) {
        send(ws, "gameError", { message: "Seul le chef d'equipe peut exclure des membres." });
        return;
      }

      const targetId = data.targetId;
      if (!targetId || targetId === playerId) return;
      if (!team.members.includes(targetId)) return;

      team.members = team.members.filter((id) => id !== targetId);
      if (players[targetId]) players[targetId].teamId = null;

      console.log(`${player.pseudo} a exclu ${players[targetId]?.pseudo || targetId} de "${team.name}"`);

      // Notifier le joueur kick
      wss.clients.forEach((client) => {
        if (client._playerId === targetId) {
          send(client, "kicked", { teamName: team.name });
        }
      });

      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // === SET OVERLAY (createur uniquement) ===
    if (type === "setOverlay") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;
      const player = players[playerId];
      if (!player.teamId || !teams[player.teamId]) return;
      const team = teams[player.teamId];
      if (team.creatorId !== playerId) {
        send(ws, "gameError", { message: "Seul le chef peut definir l'overlay." });
        return;
      }

      if (data.overlay === null) { team.overlay = null; }
      else if (Array.isArray(data.overlay) && data.overlay.length === CANVAS_HEIGHT) { team.overlay = data.overlay; }
      else { send(ws, "gameError", { message: "Format d'overlay invalide." }); return; }

      broadcast("teamsUpdate", getTeamsPublicData());
    }

    // === GET PIXEL INFO ===
    if (type === "getPixelInfo") {
      const { x, y } = data;
      if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return;
      let lastPlacer = null;
      for (let i = pixelHistory.length - 1; i >= 0; i--) {
        if (pixelHistory[i].x === x && pixelHistory[i].y === y) { lastPlacer = pixelHistory[i]; break; }
      }
      send(ws, "pixelInfo", {
        x, y, color: canvas[y][x],
        placedBy: lastPlacer ? {
          playerId: lastPlacer.playerId,
          pseudo: players[lastPlacer.playerId]?.pseudo || "???",
          timestamp: lastPlacer.timestamp,
        } : null,
      });
    }

    // === SEARCH TEAMS ===
    if (type === "searchTeams") {
      const query = (data.query || "").trim().toLowerCase();
      let results = Object.values(getTeamsPublicData());
      if (query) results = results.filter((t) => t.name.toLowerCase().includes(query));
      results.sort((a, b) => b.pixelCount - a.pixelCount);
      send(ws, "searchResults", { teams: results });
    }
  });

  ws.on("close", () => {
    const playerId = ws._playerId;
    if (playerId && players[playerId]) {
      console.log(`${players[playerId].pseudo} deconnecte (ID conserve: ${playerId})`);
    }
  });
});

// =============================================================================
// TICK PERIODIQUE — leaderboard toutes les 10s
// =============================================================================

setInterval(() => { broadcastLeaderboard(); }, 10000);

// =============================================================================
// DEMARRAGE
// =============================================================================

http.listen(PORT, () => {
  const nets = os.networkInterfaces();
  let localIP = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) { localIP = net.address; break; }
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
  console.log(`  Canvas : ${CANVAS_WIDTH}x${CANVAS_HEIGHT} pixels (blanc)`);
  console.log(`  Cooldown : ${DEFAULT_COOLDOWN / 1000}s (dynamique)`);
  console.log(`  Palette : ${COLOR_PALETTE.length} couleurs`);
  console.log("");
  console.log("  (Partagez le lien controller aux joueurs)");
  console.log("===========================================");
  console.log("");
});