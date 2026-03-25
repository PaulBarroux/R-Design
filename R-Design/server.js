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

// =============================================================================
// LOGGING — horodatage + types differencies
// =============================================================================

const C = {
  reset:  "\x1b[0m",
  dim:    "\x1b[2m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  cyan:   "\x1b[36m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  blue:   "\x1b[34m",
  magenta:"\x1b[35m",
  gray:   "\x1b[90m",
};

function ts() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return C.gray + `[${h}:${m}:${s}]` + C.reset;
}

const log = {
  connect: (msg) => console.log(`${ts()} ${C.green}[+]${C.reset} ${msg}`),
  disconnect:(msg)=> console.log(`${ts()} ${C.gray}[-]${C.reset} ${msg}`),
  pixel:   (msg) => console.log(`${ts()} ${C.cyan}[•]${C.reset} ${msg}`),
  team:    (msg) => console.log(`${ts()} ${C.yellow}[T]${C.reset} ${msg}`),
  error:   (msg) => console.log(`${ts()} ${C.red}[!]${C.reset} ${msg}`),
  info:    (msg) => console.log(`${ts()} ${C.blue}[i]${C.reset} ${msg}`),
};

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
const DEFAULT_COOLDOWN = 1 * 1000;
const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 min sans action = inactif

const COLOR_PALETTE = [
  "#6D011A", "#BE003A", "#FF4500", "#FEA800", "#FED734", "#FFF8B8",
  "#01A268", "#00CC78", "#7FED56", "#02756F", "#019EAA", "#51E9F4",
  "#2450A5", "#3690EA", "#94B3FF", "#493AC1", "#6A5DFF", "#821F9F",
  "#B44BC0", "#DE117F", "#FF3981", "#FF99AA", "#6D482F", "#9D6925",
  "#FFB470", "#000000", "#515252", "#898D90", "#D5D7D9", "#FFFFFF",
];

// =============================================================================
// ETAT DU JEU
// =============================================================================

// Canvas blanc par defaut
const canvas = [];
for (let y = 0; y < CANVAS_HEIGHT; y++) {
  canvas[y] = Array(CANVAS_WIDTH).fill("#FFFFFF");
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
    log.team(`Equipe "${team.name}" supprimee (vide)`);
    delete teams[teamId];
  } else if (team.creatorId === playerId) {
    team.creatorId = team.members[0];
    log.team(`Nouveau createur de "${team.name}": ${players[team.members[0]]?.pseudo}`);
  }
}

// =============================================================================
// GESTION DES CONNEXIONS WEBSOCKET
// =============================================================================

wss.on("connection", (ws) => {
  log.connect("Nouvelle connexion WebSocket");

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
      log.connect(`${pseudo} a rejoint (ID: ${playerId})`);

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
        log.connect(`${players[playerId].pseudo} s'est reconnecte (ID: ${playerId})`);

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

      log.pixel(`${player.pseudo}  (${x},${y})  ${color}`);
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
      log.team(`${player.pseudo} a cree "${name}" (ID: ${teamId})`);

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
      log.team(`${player.pseudo} a rejoint "${teams[teamId].name}"`);

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
      log.team(`${player.pseudo} a quitte "${teamName}"`);

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

      log.team(`${player.pseudo} a exclu ${players[targetId]?.pseudo || targetId} de "${team.name}"`);

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

      if (data.overlay === null) {
        team.overlay = null;
      } else {
        const { imageData, x, y, scale, opacity } = data.overlay;
        if (typeof imageData !== "string" || !imageData.startsWith("data:image/")) {
          send(ws, "gameError", { message: "Format d'image invalide." });
          return;
        }
        if (imageData.length > 700000) {
          send(ws, "gameError", { message: "Image trop grande (max ~500 Ko)." });
          return;
        }
        team.overlay = {
          imageData,
          x: typeof x === "number" ? x : 0,
          y: typeof y === "number" ? y : 0,
          scale: typeof scale === "number" ? Math.max(0.1, Math.min(10, scale)) : 1,
          opacity: typeof opacity === "number" ? Math.max(0, Math.min(1, opacity)) : 0.5,
        };
      }

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
      let placedBy = null;
      if (lastPlacer) {
        const p = players[lastPlacer.playerId];
        const team = p && p.teamId && teams[p.teamId] ? teams[p.teamId] : null;
        placedBy = {
          playerId: lastPlacer.playerId,
          pseudo: p?.pseudo || "???",
          timestamp: lastPlacer.timestamp,
          teamName: team ? team.name : null,
          teamColor: team ? team.color : null,
        };
      }
      send(ws, "pixelInfo", { x, y, color: canvas[y][x], placedBy });
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
      log.disconnect(`${players[playerId].pseudo} deconnecte (ID: ${playerId})`);
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
  const b = C.bold, r = C.reset, g = C.green, c = C.cyan, y = C.yellow, d = C.dim;
  console.log("");
  console.log(`${b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${r}`);
  console.log(`${b}  r/design — SERVEUR DEMARRE !${r}`);
  console.log(`${b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${r}`);
  console.log("");
  console.log(`  ${g}Ecran de jeu${r}  http://${localIP}:${PORT}/game`);
  console.log(`  ${c}Controller  ${r}  http://${localIP}:${PORT}/controller`);
  console.log("");
  console.log(`  ${d}Canvas   : ${CANVAS_WIDTH}×${CANVAS_HEIGHT} px${r}`);
  console.log(`  ${d}Cooldown : ${DEFAULT_COOLDOWN / 1000}s${r}`);
  console.log(`  ${d}Palette  : ${COLOR_PALETTE.length} couleurs${r}`);
  console.log("");
  console.log(`  ${y}Legende : [+] connexion  [-] deconnexion  [•] pixel  [T] equipe${r}`);
  console.log(`${b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${r}`);
  console.log("");
});