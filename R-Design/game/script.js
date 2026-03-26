// =============================================================================
// ECRAN DE JEU — script.js
// =============================================================================

const ws = new WebSocket(`ws://${location.host}`);

// =============================================================================
// QR CODE
// =============================================================================

(function generateQRCode() {
  const url = `http://${location.host}/controller`;
  const qr = qrcode(0, "L");
  qr.addData(url);
  qr.make();
  document.getElementById("qr-code").innerHTML = qr.createImgTag(6, 0);
})();

// =============================================================================
// DOM
// =============================================================================

const canvasEl        = document.getElementById("pixel-canvas");
const ctx             = canvasEl.getContext("2d");
const lbContent       = document.getElementById("leaderboard-content");
const waitingEl       = document.getElementById("waiting");
const tabJoueurs      = document.getElementById("tab-joueurs");
const tabEquipes      = document.getElementById("tab-equipes");

// =============================================================================
// ETAT
// =============================================================================

let canvasSize        = { width: 200, height: 200 };
let canvasData        = null;
let leaderboardData   = { individual: [], teams: [] };
let teamsData         = {};          // { teamId: { name, color, overlay, memberCount, ... } }
let showTeams         = false;
let autoSwitchTimer   = null;

// =============================================================================
// CANVAS — RENDU
// =============================================================================

function renderCanvas(data) {
  if (!data) return;
  canvasData = data;
  canvasEl.width  = canvasSize.width;
  canvasEl.height = canvasSize.height;

  const imageData = ctx.createImageData(canvasSize.width, canvasSize.height);
  for (let y = 0; y < canvasSize.height; y++) {
    for (let x = 0; x < canvasSize.width; x++) {
      const idx   = (y * canvasSize.width + x) * 4;
      const color = data[y][x];
      if (color) {
        imageData.data[idx]     = parseInt(color.slice(1, 3), 16);
        imageData.data[idx + 1] = parseInt(color.slice(3, 5), 16);
        imageData.data[idx + 2] = parseInt(color.slice(5, 7), 16);
        imageData.data[idx + 3] = 255;
      } else {
        imageData.data[idx] = imageData.data[idx+1] = imageData.data[idx+2] = 255;
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
// CANVAS — TAILLE RESPONSIVE
// =============================================================================

function fitCanvas() {
  const rightPanelW = 380 + 20 + 20 + 20; // width + gap + padding
  const maxW = window.innerWidth  - rightPanelW;
  const maxH = window.innerHeight - 40;
  const pixelSize = Math.max(1, Math.floor(Math.min(maxW / canvasSize.width, maxH / canvasSize.height)));
  canvasEl.style.width  = pixelSize * canvasSize.width  + "px";
  canvasEl.style.height = pixelSize * canvasSize.height + "px";
  }

fitCanvas();
window.addEventListener("resize", fitCanvas);


// =============================================================================
// LEADERBOARD — ICONES SVG
// =============================================================================

const CROWN_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
  <path d="M3 17l2-8 4 4 3-6 3 6 4-4 2 8H3z" fill="#E52222" stroke="#E52222" stroke-width="1" stroke-linejoin="round"/>
  <rect x="3" y="17" width="18" height="2.5" rx="1" fill="#E52222"/>
</svg>`;

const CROWN_SMALL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
  <path d="M3 17l2-8 4 4 3-6 3 6 4-4 2 8H3z" fill="#E52222" stroke="#E52222" stroke-width="1" stroke-linejoin="round"/>
  <rect x="3" y="17" width="18" height="2.5" rx="1" fill="#E52222"/>
</svg>`;

const PERSON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;

// =============================================================================
// LEADERBOARD — AVATAR D'EQUIPE
// =============================================================================

function makeAvatarHtml(team, size) {
  const sz = size || 32;
  const avatar = team.avatar;
  let style = `width:${sz}px;height:${sz}px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:${Math.round(sz*0.55)}px;overflow:hidden;flex-shrink:0;`;
  if (!avatar) {
    style += `background:${team.color};`;
    return `<div style="${style}"></div>`;
  } else if (avatar.type === "emoji") {
    style += `background:${team.color}33;`;
    return `<div style="${style}">${escHtml(avatar.value)}</div>`;
  } else if (avatar.type === "image") {
    style += `background:${team.color};background-image:url(${escHtml(avatar.value)});background-size:cover;background-position:center;`;
    return `<div style="${style}"></div>`;
  }
  return `<div style="${style}background:${team.color};"></div>`;
}

// =============================================================================
// LEADERBOARD — RENDU JOUEURS
// =============================================================================

function renderPlayers(list) {
  if (list.length === 0) {
    lbContent.innerHTML = '<p style="text-align:center;opacity:0.4;font-size:0.8rem;padding:20px">Aucun pixel placé</p>';
    return;
  }

  const top3   = list.slice(0, 3);
  const rest   = list.slice(3);

  let html = `<div class="lb-headers"><span>#</span><span>Joueur</span><span>Points</span></div>`;

  top3.forEach((e, i) => {
    const teamName = (e.teamId && teamsData[e.teamId]) ? teamsData[e.teamId].name : "";
    const badge    = i === 0 ? CROWN_SVG : CROWN_SMALL;
    html += `
      <div class="lb-entry top3">
        <div class="lb-rank-badge">${badge}</div>
        <div class="lb-info">
          <span class="lb-name">${escHtml(e.pseudo)}</span>
          ${teamName ? `<span class="lb-team-sub">${escHtml(teamName)}</span>` : ""}
        </div>
        <span class="lb-pts">${e.count} px</span>
      </div>`;
  });

  if (rest.length > 0) {
    html += `<div class="lb-separator"></div>`;
    rest.forEach((e, i) => {
      const teamName = (e.teamId && teamsData[e.teamId]) ? teamsData[e.teamId].name : "";
      html += `
        <div class="lb-entry">
          <span class="lb-rank-num">${i + 4}</span>
          <div class="lb-info">
            <span class="lb-name">${escHtml(e.pseudo)}</span>
            ${teamName ? `<span class="lb-team-sub">${escHtml(teamName)}</span>` : ""}
          </div>
          <span class="lb-pts">${e.count} px</span>
        </div>`;
    });
  }

  lbContent.innerHTML = html;
}

// =============================================================================
// LEADERBOARD — RENDU EQUIPES
// =============================================================================

function renderTeams(list) {
  if (list.length === 0) {
    lbContent.innerHTML = '<p style="text-align:center;opacity:0.4;font-size:0.8rem;padding:20px">Aucune équipe</p>';
    return;
  }

  const top3 = list.slice(0, 3);
  const rest = list.slice(3);

  // Podium : ordre 2-1-3
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumRanks = top3[1] ? [2, 1, 3] : [1];

  let podiumHtml = `<div class="lb-podium">`;
  podiumOrder.forEach((team, idx) => {
    const rank = podiumRanks[idx];
    const isFirst = rank === 1;
    podiumHtml += `
      <div class="podium-item rank-${rank}">
        ${isFirst ? `<div class="podium-crown">👑</div>` : ""}
        <div class="podium-avatar">
          ${makeAvatarHtml(team, 40)}
          <div class="podium-badge">${rank}</div>
        </div>
        <span class="podium-name">${escHtml(team.name)}</span>
        <span class="podium-pts">🏆 ${team.count} px</span>
        <span class="podium-members">${team.memberCount} membre${team.memberCount > 1 ? "s" : ""}</span>
      </div>`;
  });
  podiumHtml += `</div>`;

  let html = podiumHtml + `<div class="lb-separator"></div>`;

  if (rest.length > 0) {
    html += `<div class="lb-headers"><span>#</span><span>Équipe</span><span>Points</span></div>`;
    rest.forEach((team, i) => {
      html += `
        <div class="lb-entry">
          <span class="lb-rank-num">${i + 4}</span>
          <div class="lb-info-team">
            <div class="lb-team-icon">${makeAvatarHtml(team, 24)}</div>
            <div class="lb-info">
              <span class="lb-name">${escHtml(team.name)}</span>
              <span class="lb-team-sub">${team.memberCount} membre${team.memberCount > 1 ? "s" : ""}</span>
            </div>
          </div>
          <span class="lb-pts">${team.count} px</span>
        </div>`;
    });
  }

  lbContent.innerHTML = html;
}

// =============================================================================
// LEADERBOARD — DISPATCH
// =============================================================================

function displayCurrentLeaderboard() {
  if (showTeams) {
    renderTeams(leaderboardData.teams);
  } else {
    renderPlayers(leaderboardData.individual);
  }
}

function setTab(teams) {
  showTeams = teams;
  tabJoueurs.classList.toggle("active", !teams);
  tabEquipes.classList.toggle("active",  teams);
  displayCurrentLeaderboard();
}

// Clic manuel → suspend l'auto-switch 20s
tabJoueurs.addEventListener("click", () => {
  clearTimeout(autoSwitchTimer);
  setTab(false);
  scheduleAutoSwitch(20000);
});
tabEquipes.addEventListener("click", () => {
  clearTimeout(autoSwitchTimer);
  setTab(true);
  scheduleAutoSwitch(20000);
});

function scheduleAutoSwitch(delay = 5000) {
  autoSwitchTimer = setTimeout(() => {
    setTab(!showTeams);
    scheduleAutoSwitch();
  }, delay);
}

scheduleAutoSwitch();

// =============================================================================
// UTILS
// =============================================================================

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// =============================================================================
// MESSAGES WEBSOCKET
// =============================================================================

ws.addEventListener("message", (event) => {
  const { type, data } = JSON.parse(event.data);

  if (type === "init") {
    canvasSize  = data.canvasSize;
    teamsData   = data.teams || {};
    fitCanvas();
    renderCanvas(data.canvas);
    if (data.leaderboard) {
      leaderboardData = data.leaderboard;
      displayCurrentLeaderboard();
    }
    if (data.playerCount > 0) waitingEl.classList.add("hidden");
      }

  if (type === "pixelUpdate") {
    updatePixel(data.x, data.y, data.color);
    waitingEl.classList.add("hidden");
  }

  if (type === "leaderboard") {
    leaderboardData = data;
    displayCurrentLeaderboard();
  }

  if (type === "teamsUpdate") {
    teamsData = data;
      }

  if (type === "playerCount") {
    if (data > 0) waitingEl.classList.add("hidden");
  }

  if (type === "state") {
    canvasSize = data.canvasSize;
    teamsData  = data.teams || {};
    fitCanvas();
    renderCanvas(data.canvas);
    if (data.leaderboard) {
      leaderboardData = data.leaderboard;
      displayCurrentLeaderboard();
    }
      }
});

ws.addEventListener("close", () => {
  setTimeout(() => location.reload(), 3000);
});
