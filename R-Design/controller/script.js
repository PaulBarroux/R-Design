// =============================================================================
// CONTROLLER — script.js (telephone du joueur)
// =============================================================================
//
// Ce fichier gere la page affichee sur le telephone de chaque joueur.
// Il fait 3 choses :
//   1. Se connecter au serveur via WebSocket
//   2. Envoyer les actions du joueur (rejoindre, se deplacer)
//   3. Afficher les infos recues du serveur (scores, timer)
//
// =============================================================================

// --- Connexion WebSocket ---
// On se connecte au meme serveur qui nous a servi la page HTML.
// "location.host" contient l'adresse IP et le port (ex: "192.168.1.42:3000").
// Le prefixe "ws://" indique qu'on utilise le protocole WebSocket.
const ws = new WebSocket(`ws://${location.host}`);

// Fonction utilitaire pour envoyer un message au serveur.
// Tous nos messages suivent le format : { type: "...", data: ... }
function send(type, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

// =============================================================================
// REFERENCES AUX ELEMENTS HTML (DOM)
// =============================================================================
// On recupere les elements HTML dont on a besoin pour les manipuler en JS.

const screenJoin = document.getElementById("screen-join"); // Ecran de connexion
const screenController = document.getElementById("screen-controller"); // Ecran manette
const pseudoInput = document.getElementById("pseudo"); // Champ pseudo
const btnJoin = document.getElementById("btn-join"); // Bouton "Rejoindre"
const teamButtons = document.querySelectorAll(".team-btn"); // Boutons d'equipe
const playerPseudo = document.getElementById("player-pseudo"); // Affichage du pseudo
const playerTeam = document.getElementById("player-team"); // Affichage de l'equipe
const arrows = document.querySelectorAll(".arrow"); // Boutons fleches du D-pad
const ctrlScoreRouge = document.getElementById("ctrl-score-rouge"); // Score rouge
const ctrlScoreBleu = document.getElementById("ctrl-score-bleu"); // Score bleu
const ctrlTimer = document.getElementById("ctrl-timer"); // Timer

// Equipe selectionnee (rouge par defaut)
let selectedTeam = "rouge";

// =============================================================================
// SELECTION DE L'EQUIPE
// =============================================================================
// Quand on clique sur un bouton d'equipe, on :
//   1. Retire la classe "selected" de tous les boutons
//   2. Ajoute "selected" au bouton clique
//   3. Met a jour la variable selectedTeam

teamButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    teamButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTeam = btn.dataset.team; // Lit l'attribut data-team="rouge" ou "bleu"
  });
});

// =============================================================================
// REJOINDRE LA PARTIE
// =============================================================================
// Quand on clique sur "Rejoindre", on envoie un message "join" au serveur
// avec le pseudo et l'equipe choisie.

btnJoin.addEventListener("click", () => {
  const pseudo = pseudoInput.value.trim();

  // Validation : le pseudo ne peut pas etre vide
  if (!pseudo) {
    pseudoInput.style.borderColor = "#e94560"; // Bordure rouge pour signaler l'erreur
    pseudoInput.focus();
    return;
  }

  // Envoyer le message au serveur : { type: "join", data: { pseudo, team } }
  send("join", { pseudo, team: selectedTeam });
});

// =============================================================================
// FORMATER LE TEMPS
// =============================================================================
// Convertit des millisecondes en "M:SS" (ex: 125000 → "2:05")

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000)); // Convertir ms en secondes
  const min = Math.floor(totalSec / 60); // Minutes
  const sec = totalSec % 60; // Secondes restantes
  return `${min}:${String(sec).padStart(2, "0")}`; // padStart ajoute un "0" devant si < 10
}

// =============================================================================
// RECEPTION DES MESSAGES DU SERVEUR
// =============================================================================
// Le serveur nous envoie des messages JSON. On les parse et on reagit
// en fonction du type de message.

ws.addEventListener("message", (event) => {
  const { type, data } = JSON.parse(event.data);

  // --- Message "joined" : le serveur confirme qu'on a rejoint ---
  // On bascule de l'ecran de connexion vers l'ecran manette
  if (type === "joined") {
    screenJoin.classList.add("hidden"); // Cacher le formulaire
    screenController.classList.remove("hidden"); // Afficher la manette

    // Afficher le pseudo et l'equipe sur l'ecran manette
    playerPseudo.textContent = data.pseudo;
    playerTeam.textContent = data.team;
    playerTeam.className = "badge " + data.team; // Ajoute la couleur de l'equipe
  }

  // --- Message "state" : mise a jour de l'etat du jeu ---
  // Recu toutes les secondes + a chaque mouvement d'un joueur.
  // On met a jour les scores et le timer sur le telephone.
  if (type === "state") {
    ctrlScoreRouge.textContent = data.scores.rouge;
    ctrlScoreBleu.textContent = data.scores.bleu;
    ctrlTimer.textContent = formatTime(data.timeLeft || 0);
  }
});

// =============================================================================
// D-PAD : GESTION DU DEPLACEMENT
// =============================================================================
// Chaque bouton fleche envoie un message "move" au serveur quand on appuie.
// Si on MAINTIENT le doigt appuye, on envoie le message en boucle (toutes les 80ms)
// pour un deplacement continu.
//
// On gere a la fois :
//   - Les events "touch" (pour les telephones)
//   - Les events "mouse" (pour tester sur un PC)

arrows.forEach((btn) => {
  const dir = btn.dataset.dir; // "up", "down", "left" ou "right"

  let interval = null; // Reference au setInterval (pour pouvoir l'arreter)

  // Quand le doigt touche le bouton (debut du deplacement)
  const startMove = (e) => {
    e.preventDefault(); // Empecher le comportement par defaut du navigateur
    send("move", dir); // Envoyer le premier mouvement immediatement
    // Puis envoyer en continu tant que le doigt est appuye
    interval = setInterval(() => send("move", dir), 80);
    btn.classList.add("pressed"); // Ajouter le style "appuye"
  };

  // Quand le doigt quitte le bouton (fin du deplacement)
  const stopMove = (e) => {
    e.preventDefault();
    clearInterval(interval); // Arreter l'envoi continu
    interval = null;
    btn.classList.remove("pressed"); // Retirer le style "appuye"
  };

  // --- Events tactiles (telephones) ---
  btn.addEventListener("touchstart", startMove, { passive: false });
  btn.addEventListener("touchend", stopMove, { passive: false });
  btn.addEventListener("touchcancel", stopMove, { passive: false });

  // --- Events souris (pour tester sur PC) ---
  btn.addEventListener("mousedown", startMove);
  btn.addEventListener("mouseup", stopMove);
  btn.addEventListener("mouseleave", stopMove); // Si la souris quitte le bouton
});
