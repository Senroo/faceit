const healthGrid = document.querySelector("#health-grid");
const trackedPlayers = document.querySelector("#tracked-players");
const recentMatches = document.querySelector("#recent-matches");
const runtime = document.querySelector("#runtime");
const flash = document.querySelector("#flash");

const settingsForm = document.querySelector("#settings-form");
const playerForm = document.querySelector("#player-form");
const checkNowButton = document.querySelector("#check-now");
const testNotificationButton = document.querySelector("#test-notification");

async function loadState() {
  const response = await fetch("/api/state");
  const state = await response.json();

  renderHealth(state.health);
  renderSettings(state.settings);
  renderPlayers(state.trackedPlayers);
  renderRuntime(state.runtime);
  renderMatches(state.recentMatches);
}

function renderHealth(health) {
  const items = [
    ["FACEIT API", health.faceitConfigured ? "configuree" : "manquante"],
    ["Discord token", health.discordConfigured ? "configure" : "manquant"],
    ["Discord bot", health.discordReady ? "connecte" : "hors ligne"]
  ];

  healthGrid.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="status-pill">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");
}

function renderSettings(settings) {
  settingsForm.discordChannelId.value = settings.discordChannelId ?? "";
  settingsForm.gameId.value = settings.gameId ?? "cs2";
  settingsForm.pollIntervalSeconds.value = settings.pollIntervalSeconds ?? 90;
}

function renderPlayers(players) {
  if (!players.length) {
    trackedPlayers.innerHTML = "<p class='hint'>Aucun joueur suivi pour le moment.</p>";
    return;
  }

  trackedPlayers.innerHTML = players
    .map(
      (player) => `
        <div class="player-row">
          <div class="player-top">
            <div>
              <strong>${escapeHtml(player.nickname)}</strong>
              <div class="hint">${escapeHtml(player.gameId ?? "cs2")} · lvl ${escapeHtml(String(player.skillLevel ?? "?"))} · elo ${escapeHtml(String(player.elo ?? "?"))}</div>
            </div>
            <button class="danger-button" data-remove="${escapeAttribute(player.nickname)}">Retirer</button>
          </div>
          <a href="${player.faceitUrl}" target="_blank" rel="noreferrer">Profil FACEIT</a>
        </div>
      `
    )
    .join("");
}

function renderRuntime(data) {
  const rows = [
    ["Dernier check", formatDate(data.lastSuccessfulPollAt)],
    ["Derniere tentative", formatDate(data.lastPollAt)],
    ["Derniere erreur", data.lastError ?? "Aucune"],
    ["Demarre le", formatDate(data.startedAt)]
  ];

  runtime.innerHTML = rows
    .map(
      ([label, value]) => `
        <div>
          <dt>${label}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `
    )
    .join("");
}

function renderMatches(matches) {
  if (!matches.length) {
    recentMatches.innerHTML = "<p class='hint'>Aucun match notifie pour le moment.</p>";
    return;
  }

  recentMatches.innerHTML = matches
    .map(
      (match) => `
        <article class="match-card">
          <div class="match-top">
            <div>
              <strong>${escapeHtml(match.trackedNickname)}</strong>
              <div class="hint">${escapeHtml(match.competitionName)}</div>
            </div>
            <span class="pill ${match.result === "Defaite" ? "loss" : ""}">
              ${escapeHtml(match.result)} · ${escapeHtml(match.score)}
            </span>
          </div>
          <div class="match-meta">
            ${escapeHtml(match.map)} · ${escapeHtml(match.gameMode)} · K/D ${escapeHtml(String(match.playerStats.kd))}
          </div>
          <a href="${match.faceitMatchUrl}" target="_blank" rel="noreferrer">Ouvrir le match FACEIT</a>
        </article>
      `
    )
    .join("");
}

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await fetchJson("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        discordChannelId: settingsForm.discordChannelId.value,
        gameId: settingsForm.gameId.value,
        pollIntervalSeconds: settingsForm.pollIntervalSeconds.value
      })
    });

    showFlash("Configuration enregistree.");
    await loadState();
  } catch (error) {
    showFlash(error.message, true);
  }
});

playerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await fetchJson("/api/players", {
      method: "POST",
      body: JSON.stringify({
        nickname: playerForm.nickname.value
      })
    });

    playerForm.reset();
    showFlash("Joueur ajoute au suivi.");
    await loadState();
  } catch (error) {
    showFlash(error.message, true);
  }
});

trackedPlayers.addEventListener("click", async (event) => {
  const nickname = event.target.getAttribute("data-remove");
  if (!nickname) {
    return;
  }

  try {
    await fetchJson(`/api/players/${encodeURIComponent(nickname)}`, {
      method: "DELETE"
    });

    showFlash("Joueur retire du suivi.");
    await loadState();
  } catch (error) {
    showFlash(error.message, true);
  }
});

checkNowButton.addEventListener("click", async () => {
  try {
    await fetchJson("/api/check-now", { method: "POST" });
    showFlash("Verification lancee.");
    await loadState();
  } catch (error) {
    showFlash(error.message, true);
  }
});

testNotificationButton.addEventListener("click", async () => {
  try {
    await fetchJson("/api/test-notification", { method: "POST" });
    showFlash("Notification de test envoyee.");
  } catch (error) {
    showFlash(error.message, true);
  }
});

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Erreur inconnue." }));
    throw new Error(payload.error || "Erreur inconnue.");
  }

  return response.json().catch(() => ({}));
}

function showFlash(message, isError = false) {
  flash.hidden = false;
  flash.textContent = message;
  flash.style.borderColor = isError ? "rgba(251, 113, 133, 0.55)" : "rgba(255,255,255,0.12)";
}

function formatDate(value) {
  if (!value) {
    return "Jamais";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

loadState().catch((error) => {
  showFlash(error.message, true);
});
