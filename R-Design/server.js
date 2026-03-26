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
const crypto = require("crypto");

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
// ADMIN
// =============================================================================

const ADMIN_PASSWORD = "AZE12";
const ADMIN_COOLDOWN = 100; // ms entre chaque pixel admin
const ADMIN_TOKEN = crypto.randomBytes(16).toString("hex");
const adminConnections = new Set();

// =============================================================================
// FICHIERS STATIQUES
// =============================================================================

app.use("/controller", express.static(path.join(__dirname, "controller")));
app.use("/game", express.static(path.join(__dirname, "game")));
app.use("/admin", express.static(path.join(__dirname, "admin")));

app.use(express.json());

app.post("/admin/auth", (req, res) => {
  if (req.body && req.body.password === ADMIN_PASSWORD) {
    res.json({ ok: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ ok: false, message: "Mot de passe incorrect." });
  }
});

app.get("/", (req, res) => {
  res.redirect("/controller");
});

// =============================================================================
// CONFIGURATION DU JEU
// =============================================================================

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 200;
const DEFAULT_COOLDOWN = 20 * 1000;
const INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 min sans action = inactif

// =============================================================================
// POUVOIRS — CONFIGURATION
// =============================================================================

const POWER_BOMB_COST        = 20;   // pixels dores
const POWER_BOMB_SIZE        = 5;    // 5x5
const POWER_RAFALE_COST      = 40;   // pixels dores
const POWER_RAFALE_DURATION  = 30000; // 30s
const POWER_RAFALE_COOLDOWN  = 1000; // 1s entre chaque pixel
const POWER_TEAM_ACCEL_COST     = 100;  // pixels diamant
const POWER_TEAM_ACCEL_DURATION = 120000; // 2 min
const POWER_TEAM_ACCEL_COOLDOWN = 5000;  // 5s entre chaque pixel
const POWER_COLOR_REPLACE_COST  = 150;  // pixels diamant
const POWER_COLOR_REPLACE_SIZE  = 10;   // 10x10

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

// Buffs actifs (timers serveur)
// rafaleBuffs[playerId] = { endsAt, timer }
const rafaleBuffs = {};
// teamAccelBuffs[teamId] = { endsAt, timer }
const teamAccelBuffs = {};

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

function getBaseCooldown() {
  const activePlayers = Object.values(players).filter((p) => p.active).length;
  if (activePlayers > 100) return 10 * 1000;
  if (activePlayers > 50) return 15 * 1000;
  if (activePlayers > 20) return 20 * 1000;
  return DEFAULT_COOLDOWN;
}

// Cooldown effectif pour un joueur (tient compte des buffs et mode test)
function getPlayerCooldown(playerId) {
  const player = players[playerId];
  // Joueur test : 0.1s
  if (player && player.testPlayer) return ADMIN_COOLDOWN;
  // Rafale individuelle prioritaire (1s)
  if (rafaleBuffs[playerId] && rafaleBuffs[playerId].endsAt > Date.now()) {
    return POWER_RAFALE_COOLDOWN;
  }
  // Acceleration d'equipe (5s)
  if (player && player.teamId && teamAccelBuffs[player.teamId] && teamAccelBuffs[player.teamId].endsAt > Date.now()) {
    return POWER_TEAM_ACCEL_COOLDOWN;
  }
  return getBaseCooldown();
}

// Compat : renomme pour les messages
function getCurrentCooldown() { return getBaseCooldown(); }

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
  // Points = totalPixels (compteur incremental, ne baisse jamais)
  const individualBoard = Object.values(players)
    .filter((p) => p.totalPixels > 0)
    .map((p) => ({
      playerId: p.id,
      pseudo: p.pseudo,
      teamId: p.teamId,
      count: p.totalPixels,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const teamPixelCount = {};
  for (const p of Object.values(players)) {
    if (p.teamId && teams[p.teamId] && p.totalPixels > 0) {
      teamPixelCount[p.teamId] = (teamPixelCount[p.teamId] || 0) + p.totalPixels;
    }
  }

  const teamBoard = Object.entries(teamPixelCount)
    .map(([teamId, count]) => ({
      teamId,
      name: teams[teamId] ? teams[teamId].name : "???",
      color: teams[teamId] ? teams[teamId].color : "#888",
      memberCount: teams[teamId] ? teams[teamId].members.length : 0,
      avatar: teams[teamId] ? (teams[teamId].avatar || null) : null,
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
      diamondPixels: team.diamondPixels || 0,
      avatar: team.avatar || null,
      accelEndsAt: teamAccelBuffs[id] && teamAccelBuffs[id].endsAt > Date.now() ? teamAccelBuffs[id].endsAt : null,
      members: team.members.map((pid) => ({
        id: pid,
        pseudo: players[pid] ? players[pid].pseudo : "???",
        active: players[pid] ? players[pid].active : false,
        isCreator: pid === team.creatorId,
        goldPixels: players[pid] ? players[pid].goldPixels || 0 : 0,
      })),
    };
  }
  return result;
}

// =============================================================================
// DONNEES JOUEURS (pour admin)
// =============================================================================

function getPlayersPublicData() {
  return Object.values(players).map((p) => ({
    id: p.id,
    pseudo: p.pseudo,
    teamId: p.teamId,
    active: p.active,
    blocked: p.blocked || false,
    testPlayer: p.testPlayer || false,
  }));
}

function broadcastToAdmins(type, data) {
  const msg = JSON.stringify({ type, data });
  adminConnections.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
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

function validateAvatar(a) {
  if (!a || typeof a !== "object") return null;
  if (a.type === "emoji" && typeof a.value === "string" && a.value.length <= 8) {
    return { type: "emoji", value: a.value };
  }
  if (a.type === "image" && typeof a.value === "string"
      && a.value.startsWith("data:image/") && a.value.length < 100000) {
    return { type: "image", value: a.value };
  }
  return null;
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
    players: getPlayersPublicData(),
  });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, data } = msg;

    // === ADMIN AUTH ===
    if (type === "adminAuth") {
      if (data.token === ADMIN_TOKEN) {
        ws._isAdmin = true;
        adminConnections.add(ws);
        log.info("Admin connecte");
        send(ws, "adminAuthOk", {});
      } else {
        send(ws, "error", { message: "Token admin invalide." });
      }
      return;
    }

    // === ADMIN TOGGLE BLOCK ===
    if (type === "adminToggleBlock") {
      if (!ws._isAdmin) return;
      const targetId = data.playerId;
      if (!targetId || !players[targetId]) return;
      players[targetId].blocked = !players[targetId].blocked;
      const state = players[targetId].blocked ? "bloque" : "debloque";
      log.info(`[ADMIN] ${players[targetId].pseudo} ${state}`);
      if (players[targetId].blocked) {
        wss.clients.forEach((client) => {
          if (client._playerId === targetId) {
            send(client, "gameError", { message: "Vous avez ete bloque par l'administrateur." });
          }
        });
      }
      broadcastToAdmins("playersUpdate", getPlayersPublicData());
      return;
    }

    // === ADMIN TOGGLE TEST PLAYER ===
    if (type === "adminToggleTest") {
      if (!ws._isAdmin) return;
      const targetId = data.playerId;
      if (!targetId || !players[targetId]) return;
      players[targetId].testPlayer = !players[targetId].testPlayer;
      const state = players[targetId].testPlayer ? "test" : "normal";
      log.info(`[ADMIN] ${players[targetId].pseudo} → ${state}`);
      // Notifier le joueur de son nouveau cooldown
      wss.clients.forEach((client) => {
        if (client._playerId === targetId) {
          send(client, "cooldownUpdate", { cooldown: getPlayerCooldown(targetId) });
        }
      });
      broadcastToAdmins("playersUpdate", getPlayersPublicData());
      return;
    }

    // === ADMIN KICK ===
    if (type === "adminKick") {
      if (!ws._isAdmin) return;
      const targetId = data.playerId;
      const fromTeamId = String(data.teamId || "");
      if (!targetId || !players[targetId]) return;
      const player = players[targetId];
      const teamId = fromTeamId || player.teamId;
      if (!teamId || !teams[teamId]) return;
      if (!teams[teamId].members.includes(targetId)) return;
      const teamName = teams[teamId].name;
      removePlayerFromTeam(targetId, teamId);
      player.teamId = null;
      log.team(`[ADMIN] ${player.pseudo} exclu de "${teamName}"`);
      wss.clients.forEach((client) => {
        if (client._playerId === targetId) send(client, "kicked", { teamName });
      });
      broadcast("teamsUpdate", getTeamsPublicData());
      broadcastToAdmins("playersUpdate", getPlayersPublicData());
      return;
    }

    // === ADMIN DELETE OVERLAY ===
    if (type === "adminDeleteOverlay") {
      if (!ws._isAdmin) return;
      const teamId = String(data.teamId);
      if (!teams[teamId]) return;
      teams[teamId].overlay = null;
      log.team(`[ADMIN] Overlay de "${teams[teamId].name}" supprime`);
      broadcast("teamsUpdate", getTeamsPublicData());
      return;
    }

    // === ADMIN SET OVERLAY ===
    if (type === "adminSetOverlay") {
      if (!ws._isAdmin) return;
      const teamId = String(data.teamId);
      if (!teams[teamId]) return;
      if (data.overlay === null) {
        teams[teamId].overlay = null;
      } else {
        const { imageData, x, y, scale, opacity } = data.overlay;
        if (typeof imageData !== "string" || !imageData.startsWith("data:image/")) return;
        if (imageData.length > 700000) {
          send(ws, "error", { message: "Image trop grande (max ~500 Ko)." });
          return;
        }
        teams[teamId].overlay = {
          imageData,
          x: typeof x === "number" ? x : 0,
          y: typeof y === "number" ? y : 0,
          scale: typeof scale === "number" ? Math.max(0.1, Math.min(10, scale)) : 1,
          opacity: typeof opacity === "number" ? Math.max(0, Math.min(1, opacity)) : 0.5,
        };
        log.team(`[ADMIN] Overlay de "${teams[teamId].name}" mis a jour`);
      }
      broadcast("teamsUpdate", getTeamsPublicData());
      return;
    }

    // === ADMIN BOMB (5x5, anonyme, sans points) ===
    if (type === "adminBomb") {
      if (!ws._isAdmin) return;
      const { x, y, color } = data;
      if (!COLOR_PALETTE.includes(color)) return;
      const adminBombTs = Date.now();
      for (let dy = 0; dy < 5; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          const px = x + dx, py = y + dy;
          if (px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT) {
            canvas[py][px] = color;
            pixelHistory.push({ playerId: null, x: px, y: py, color, timestamp: adminBombTs });
            broadcastPixelUpdate(px, py, color, null);
          }
        }
      }
      log.pixel(`[ADMIN BOMBE] (${x},${y}) ${color}`);
      return;
    }

    // === ADMIN PLACE PIXEL (anonyme, sans points) ===
    if (type === "adminPlacePixel") {
      if (!ws._isAdmin) return;
      const { x, y, color } = data;
      if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return;
      if (!COLOR_PALETTE.includes(color)) return;
      const now = Date.now();
      if (now - (ws._adminLastPlacement || 0) < ADMIN_COOLDOWN) return;
      ws._adminLastPlacement = now;
      canvas[y][x] = color;
      // Pas de push dans pixelHistory → pas de points, pas d'attribution
      log.pixel(`[ADMIN] (${x},${y}) ${color}`);
      // playerId = null → anonyme pour tous les clients
      broadcastPixelUpdate(x, y, color, null);
      return;
    }

    // === POWER: BOMB ===
    if (type === "useBomb") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;
      const player = players[playerId];
      const { x, y, color } = data;
      if (player.goldPixels < POWER_BOMB_COST) {
        send(ws, "gameError", { message: "Pas assez de pixels dores." }); return;
      }
      if (!COLOR_PALETTE.includes(color)) return;
      // Valider que le carre 5x5 est au moins partiellement dans le canvas
      if (x + POWER_BOMB_SIZE <= 0 || x >= CANVAS_WIDTH || y + POWER_BOMB_SIZE <= 0 || y >= CANVAS_HEIGHT) return;

      player.goldPixels -= POWER_BOMB_COST;
      const pixels = [];
      for (let dy = 0; dy < POWER_BOMB_SIZE; dy++) {
        for (let dx = 0; dx < POWER_BOMB_SIZE; dx++) {
          const px = x + dx, py = y + dy;
          if (px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT) {
            canvas[py][px] = color;
            pixels.push({ x: px, y: py });
          }
        }
      }
      log.pixel(`[BOMBE] ${player.pseudo} (${x},${y}) ${color} — ${pixels.length}px`);
      const bombTs = Date.now();
      for (const p of pixels) {
        pixelHistory.push({ playerId, x: p.x, y: p.y, color, timestamp: bombTs });
        broadcastPixelUpdate(p.x, p.y, color, playerId);
      }
      send(ws, "powerUsed", { power: "bomb", goldPixels: player.goldPixels });
      updatePlayerActivity(playerId);
      return;
    }

    // === POWER: RAFALE ===
    if (type === "useRafale") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;
      const player = players[playerId];
      if (player.goldPixels < POWER_RAFALE_COST) {
        send(ws, "gameError", { message: "Pas assez de pixels dores." }); return;
      }
      if (rafaleBuffs[playerId] && rafaleBuffs[playerId].endsAt > Date.now()) {
        send(ws, "gameError", { message: "Rafale deja active." }); return;
      }

      player.goldPixels -= POWER_RAFALE_COST;
      const endsAt = Date.now() + POWER_RAFALE_DURATION;
      const timer = setTimeout(() => {
        delete rafaleBuffs[playerId];
        // Notifier le joueur que la rafale est terminee
        wss.clients.forEach((c) => {
          if (c._playerId === playerId) {
            send(c, "buffEnded", { buff: "rafale" });
            send(c, "cooldownUpdate", { cooldown: getPlayerCooldown(playerId) });
          }
        });
        log.info(`[RAFALE] Fin pour ${player.pseudo}`);
      }, POWER_RAFALE_DURATION);
      rafaleBuffs[playerId] = { endsAt, timer };

      log.info(`[RAFALE] ${player.pseudo} — 30s`);
      // Reset le cooldown pour pouvoir poser immediatement
      player.lastPlacement = 0;
      send(ws, "powerUsed", {
        power: "rafale", goldPixels: player.goldPixels,
        endsAt, cooldown: POWER_RAFALE_COOLDOWN,
      });
      updatePlayerActivity(playerId);
      return;
    }

    // === POWER: TEAM ACCELERATION ===
    if (type === "useTeamAccel") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;
      const player = players[playerId];
      if (!player.teamId || !teams[player.teamId]) {
        send(ws, "gameError", { message: "Vous n'etes dans aucune equipe." }); return;
      }
      const team = teams[player.teamId];
      if (team.creatorId !== playerId) {
        send(ws, "gameError", { message: "Seul le chef d'equipe peut activer ce pouvoir." }); return;
      }
      if (team.diamondPixels < POWER_TEAM_ACCEL_COST) {
        send(ws, "gameError", { message: "Pas assez de pixels diamant." }); return;
      }
      if (teamAccelBuffs[player.teamId] && teamAccelBuffs[player.teamId].endsAt > Date.now()) {
        send(ws, "gameError", { message: "Acceleration deja active." }); return;
      }

      team.diamondPixels -= POWER_TEAM_ACCEL_COST;
      const teamId = player.teamId;
      const endsAt = Date.now() + POWER_TEAM_ACCEL_DURATION;
      const timer = setTimeout(() => {
        delete teamAccelBuffs[teamId];
        // Notifier tous les membres
        wss.clients.forEach((c) => {
          const pid = c._playerId;
          if (pid && players[pid] && players[pid].teamId === teamId) {
            send(c, "buffEnded", { buff: "teamAccel" });
            send(c, "cooldownUpdate", { cooldown: getPlayerCooldown(pid) });
          }
        });
        log.info(`[ACCEL] Fin pour equipe "${team.name}"`);
      }, POWER_TEAM_ACCEL_DURATION);
      teamAccelBuffs[teamId] = { endsAt, timer };

      log.info(`[ACCEL] ${player.pseudo} — equipe "${team.name}" — 2min`);
      // Notifier tous les membres de l'equipe
      wss.clients.forEach((c) => {
        const pid = c._playerId;
        if (pid && players[pid] && players[pid].teamId === teamId) {
          send(c, "buffStarted", {
            buff: "teamAccel", endsAt,
            cooldown: POWER_TEAM_ACCEL_COOLDOWN,
            diamondPixels: team.diamondPixels,
          });
        }
      });
      updatePlayerActivity(playerId);
      return;
    }

    // === POWER: COLOR REPLACE ===
    if (type === "useColorReplace") {
      const playerId = ws._playerId;
      if (!playerId || !players[playerId]) return;
      const player = players[playerId];
      if (!player.teamId || !teams[player.teamId]) {
        send(ws, "gameError", { message: "Vous n'etes dans aucune equipe." }); return;
      }
      const team = teams[player.teamId];
      if (team.creatorId !== playerId) {
        send(ws, "gameError", { message: "Seul le chef d'equipe peut activer ce pouvoir." }); return;
      }
      if (team.diamondPixels < POWER_COLOR_REPLACE_COST) {
        send(ws, "gameError", { message: "Pas assez de pixels diamant." }); return;
      }
      const { x, y, targetColor, newColor } = data;
      if (!COLOR_PALETTE.includes(targetColor) || !COLOR_PALETTE.includes(newColor)) return;
      if (x + POWER_COLOR_REPLACE_SIZE <= 0 || x >= CANVAS_WIDTH || y + POWER_COLOR_REPLACE_SIZE <= 0 || y >= CANVAS_HEIGHT) return;

      // Compter les pixels qui matchent avant de debiter
      const pixels = [];
      for (let dy = 0; dy < POWER_COLOR_REPLACE_SIZE; dy++) {
        for (let dx = 0; dx < POWER_COLOR_REPLACE_SIZE; dx++) {
          const px = x + dx, py = y + dy;
          if (px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT && canvas[py][px] === targetColor) {
            pixels.push({ x: px, y: py });
          }
        }
      }

      if (pixels.length === 0) {
        send(ws, "gameError", { message: "Aucun pixel de cette couleur dans la zone." }); return;
      }

      team.diamondPixels -= POWER_COLOR_REPLACE_COST;
      const replaceTs = Date.now();
      for (const p of pixels) {
        canvas[p.y][p.x] = newColor;
        pixelHistory.push({ playerId, x: p.x, y: p.y, color: newColor, timestamp: replaceTs });
      }
      log.pixel(`[REMPLACEMENT] ${player.pseudo} (${x},${y}) ${targetColor}→${newColor} — ${pixels.length}px`);
      for (const p of pixels) broadcastPixelUpdate(p.x, p.y, newColor, playerId);
      send(ws, "powerUsed", { power: "colorReplace", diamondPixels: team.diamondPixels });
      updatePlayerActivity(playerId);
      return;
    }

    // === JOIN ===
    if (type === "join") {
      const pseudo = (data.pseudo || "Anonyme").trim().substring(0, 16);
      const playerId = generatePlayerId();

      players[playerId] = {
        id: playerId, pseudo, teamId: null,
        lastPlacement: 0, totalPixels: 0,
        connectedAt: Date.now(), lastActivity: Date.now(), active: true,
        blocked: false, goldPixels: 0, testPlayer: false,
      };
      ws._playerId = playerId;
      log.connect(`${pseudo} a rejoint (ID: ${playerId})`);

      send(ws, "joined", {
        playerId, pseudo, teamId: null,
        cooldown: getCurrentCooldown(),
        palette: COLOR_PALETTE,
        canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        goldPixels: 0, diamondPixels: 0, totalPixels: 0,
      });
      broadcastPlayerList();
      broadcastToAdmins("playersUpdate", getPlayersPublicData());
    }

    // === RECONNECT ===
    if (type === "reconnect") {
      const playerId = (data.playerId || "").trim().toUpperCase();
      if (players[playerId]) {
        ws._playerId = playerId;
        players[playerId].active = true;
        players[playerId].lastActivity = Date.now();
        log.connect(`${players[playerId].pseudo} s'est reconnecte (ID: ${playerId})`);

        const rp = players[playerId];
        send(ws, "joined", {
          playerId, pseudo: rp.pseudo,
          teamId: rp.teamId,
          cooldown: getPlayerCooldown(playerId),
          palette: COLOR_PALETTE,
          canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
          goldPixels: rp.goldPixels || 0,
          totalPixels: rp.totalPixels || 0,
          diamondPixels: rp.teamId && teams[rp.teamId] ? teams[rp.teamId].diamondPixels : 0,
        });
        broadcastPlayerList();
        broadcastToAdmins("playersUpdate", getPlayersPublicData());
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

      if (player.blocked) {
        send(ws, "gameError", { message: "Vous etes bloque et ne pouvez pas poser de pixel." });
        return;
      }

      const cooldown = getPlayerCooldown(playerId);
      const timeSinceLast = Date.now() - player.lastPlacement;
      if (timeSinceLast < cooldown) {
        const remaining = Math.ceil((cooldown - timeSinceLast) / 1000);
        send(ws, "cooldownError", { message: `Attendez encore ${remaining}s`, remaining: cooldown - timeSinceLast });
        return;
      }

      const hasRafale = rafaleBuffs[playerId] && rafaleBuffs[playerId].endsAt > Date.now();

      canvas[y][x] = color;
      player.lastPlacement = Date.now();
      updatePlayerActivity(playerId);
      pixelHistory.push({ playerId, x, y, color, timestamp: Date.now() });

      if (!hasRafale) {
        // Points et ressources uniquement hors rafale
        player.totalPixels++;
        player.goldPixels++;
        if (player.teamId && teams[player.teamId]) {
          teams[player.teamId].diamondPixels++;
        }
      }

      log.pixel(`${player.pseudo}  (${x},${y})  ${color}${hasRafale ? " [RAFALE]" : ""}`);
      send(ws, "pixelPlaced", {
        x, y, color, cooldown,
        nextPlacement: Date.now() + cooldown,
        goldPixels: player.goldPixels,
        totalPixels: player.totalPixels,
        diamondPixels: player.teamId && teams[player.teamId] ? teams[player.teamId].diamondPixels : 0,
      });
      broadcastPixelUpdate(x, y, color, playerId);
      if (!hasRafale) broadcastLeaderboard();
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

      const avatar = validateAvatar(data.avatar);
      const teamId = String(nextTeamId++);
      teams[teamId] = {
        id: teamId, name, color, creatorId: playerId,
        members: [playerId], overlay: null, createdAt: Date.now(),
        diamondPixels: 0, avatar,
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

    // === ADMIN GET HISTORY (timelapse) ===
    if (type === "adminGetHistory") {
      if (!ws._isAdmin) return;
      send(ws, "historyData", {
        history: pixelHistory,
        canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      });
      return;
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
    if (ws._isAdmin) {
      adminConnections.delete(ws);
      log.info("Admin deconnecte");
    }
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
  console.log(`  ${C.magenta}Admin       ${r}  http://${localIP}:${PORT}/admin`);
  console.log("");
  console.log(`  ${d}Canvas   : ${CANVAS_WIDTH}×${CANVAS_HEIGHT} px${r}`);
  console.log(`  ${d}Cooldown : ${DEFAULT_COOLDOWN / 1000}s${r}`);
  console.log(`  ${d}Palette  : ${COLOR_PALETTE.length} couleurs${r}`);
  console.log("");
  console.log(`  ${y}Legende : [+] connexion  [-] deconnexion  [•] pixel  [T] equipe${r}`);
  console.log(`${b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${r}`);
  console.log("");
});