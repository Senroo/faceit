const healthGrid = document.querySelector("#health-grid");
const storageGrid = document.querySelector("#storage-grid");
const globalKpis = document.querySelector("#global-kpis");
const playerDeck = document.querySelector("#player-deck");
const leaderboard = document.querySelector("#leaderboard");
const runtime = document.querySelector("#runtime");
const highlights = document.querySelector("#highlights");
const recentMatches = document.querySelector("#recent-matches");
const flash = document.querySelector("#flash");

const settingsForm = document.querySelector("#settings-form");
const playerForm = document.querySelector("#player-form");
const checkNowButton = document.querySelector("#check-now");
const testNotificationButton = document.querySelector("#test-notification");
const backupDownloadButton = document.querySelector("#backup-download");

let currentState = null;

async function loadState() {
  const response = await fetch("/api/state");
  const state = await response.json();
  currentState = state;

  renderHealth(state.health);
  renderStorage(state.analytics.storage);
  renderKpis(state.analytics.hero, state.analytics.totals);
  renderPlayers(state.analytics.playerCards);
  renderLeaderboard(state.analytics.leaderboard);
  renderRuntime(state.runtime);
  renderHighlights(state.analytics.highlights);
  renderMatches(state.analytics.recentMatches);
  renderSettings(state.settings);
}

function renderHealth(health) {
  const items = [
    ["FACEIT", health.faceitConfigured ? "Connected" : "Missing"],
    ["Discord", health.discordConfigured ? "Token ready" : "Missing"],
    ["Bot", health.discordReady ? "Online" : "Offline"]
  ];

  healthGrid.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="signal-pill">
          <span class="tiny">${label}</span>
          <strong>${value}</strong>
        </div>
      `
    )
    .join("");
}

function renderStorage(storage) {
  storageGrid.innerHTML = `
    <div class="storage-panel">
      <div class="tiny">Data path</div>
      <code>${escapeHtml(storage.dataDir ?? "unknown")}</code>
      <p class="hint">${escapeHtml(storage.persistentHint ?? "")}</p>
      <div class="tiny">Players saved: ${escapeHtml(String(storage.trackedPlayersCount ?? 0))}</div>
      <div class="tiny">Matches archived: ${escapeHtml(String(storage.matchHistoryCount ?? 0))}</div>
    </div>
  `;
}

function renderKpis(hero, totals) {
  const items = [
    ["Tracked players", hero.trackedPlayers, "Players currently under watch"],
    ["Tracked matches", hero.matchesTracked, `${totals.wins} wins - ${totals.losses} losses`],
    ["Global win rate", `${hero.winRate}%`, "Overall results since tracking started"],
    ["Average K/D", hero.averageKd, "Mean ratio across archived matches"],
    ["Average kills", hero.averageKills, `${hero.totalKills} kills total`]
  ];

  globalKpis.innerHTML = items
    .map(
      ([label, value, note]) => `
        <article class="kpi-card">
          <span class="label">${escapeHtml(String(label))}</span>
          <strong>${escapeHtml(String(value))}</strong>
          <small>${escapeHtml(String(note))}</small>
        </article>
      `
    )
    .join("");
}

function renderPlayers(players) {
  if (!players.length) {
    playerDeck.innerHTML = "<p class='hint'>Aucun joueur suivi pour le moment.</p>";
    return;
  }

  playerDeck.innerHTML = players
    .map(
      (player) => `
        <article class="player-card">
          <div class="player-header">
            <div>
              <h3>${escapeHtml(player.nickname)}</h3>
              <div class="player-meta">${escapeHtml(player.gameId ?? "cs2")} - lvl ${escapeHtml(String(player.skillLevel ?? "?"))} - elo ${escapeHtml(String(player.elo ?? "?"))}</div>
            </div>
            <span class="result-pill ${player.metrics.winRate >= 50 ? "win" : "loss"}">
              ${escapeHtml(String(player.metrics.winRate))}% WR
            </span>
          </div>

          <div class="metrics-row">
            <div class="metric-box">
              <span>Matches</span>
              <strong>${escapeHtml(String(player.metrics.matches))}</strong>
            </div>
            <div class="metric-box">
              <span>Avg K/D</span>
              <strong>${escapeHtml(String(player.metrics.averageKd))}</strong>
            </div>
            <div class="metric-box">
              <span>Avg Kills</span>
              <strong>${escapeHtml(String(player.metrics.averageKills))}</strong>
            </div>
          </div>

          <div class="metrics-row">
            <div class="metric-box">
              <span>Avg Deaths</span>
              <strong>${escapeHtml(String(player.metrics.averageDeaths))}</strong>
            </div>
            <div class="metric-box">
              <span>Avg HS%</span>
              <strong>${escapeHtml(String(player.metrics.averageHs))}</strong>
            </div>
            <div class="metric-box">
              <span>Streak</span>
              <strong>${escapeHtml(player.metrics.streak.label)}</strong>
            </div>
          </div>

          <div class="form-row">
            ${renderFormPills(player.metrics.recentForm)}
          </div>

          <div class="player-footer">
            <div class="tiny">
              ${player.lastMatch
                ? `Last match: ${escapeHtml(player.lastMatch.result)} on ${escapeHtml(player.lastMatch.map)}`
                : "No tracked match yet"}
            </div>
            <div class="player-actions">
              <a class="player-link" href="${player.faceitUrl}" target="_blank" rel="noreferrer">Open FACEIT</a>
              <button class="danger-button" data-remove="${escapeAttribute(player.nickname)}">Retirer</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderLeaderboard(entries) {
  if (!entries.length) {
    leaderboard.innerHTML = "<p class='hint'>Le leaderboard apparaitra apres quelques matchs archives.</p>";
    return;
  }

  leaderboard.innerHTML = entries
    .map(
      (entry, index) => `
        <article class="leader-row">
          <span class="leader-rank">#${index + 1}</span>
          <div class="leader-copy">
            <strong>${escapeHtml(entry.nickname)}</strong>
            <span class="tiny">${escapeHtml(String(entry.metrics.matches))} matchs - ${escapeHtml(String(entry.metrics.winRate))}% WR</span>
          </div>
          <div class="leader-score">
            <strong>${escapeHtml(String(entry.metrics.impactScore))}</strong>
            <span class="tiny">impact</span>
          </div>
        </article>
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
        <div class="meta-box">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `
    )
    .join("");
}

function renderHighlights(data) {
  const items = [
    ["Best K/D", data.bestKd],
    ["Best Win Rate", data.bestWinRate],
    ["Most Active", data.mostActive]
  ];

  highlights.innerHTML = items
    .map(([label, entry]) => {
      if (!entry) {
        return `
          <article class="highlight-card">
            <div class="tiny">${escapeHtml(label)}</div>
            <strong>No data yet</strong>
            <p class="hint">Track more matches to unlock this slot.</p>
          </article>
        `;
      }

      return `
        <article class="highlight-card">
          <div class="tiny">${escapeHtml(label)}</div>
          <strong>${escapeHtml(entry.nickname)}</strong>
          <p class="hint">
            ${escapeHtml(String(entry.metrics.matches))} matchs - ${escapeHtml(String(entry.metrics.averageKd))} K/D - ${escapeHtml(String(entry.metrics.winRate))}% WR
          </p>
        </article>
      `;
    })
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
          <div class="match-header">
            <div>
              <h3>${escapeHtml(match.trackedNickname)}</h3>
              <div class="player-meta">${escapeHtml(match.competitionName)}</div>
            </div>
            <span class="result-pill ${match.isWin ? "win" : "loss"}">
              ${escapeHtml(match.result)} - ${escapeHtml(match.score)}
            </span>
          </div>

          <div class="metric-line tiny">
            <span>${escapeHtml(match.map)}</span>
            <span>${escapeHtml(match.gameMode)}</span>
            <span>${escapeHtml(formatDate(match.finishedAt))}</span>
          </div>

          <div class="match-metrics">
            <div class="micro-pill">
              <span>Kills</span>
              <strong>${escapeHtml(String(match.playerStats.kills))}</strong>
            </div>
            <div class="micro-pill">
              <span>Deaths</span>
              <strong>${escapeHtml(String(match.playerStats.deaths))}</strong>
            </div>
            <div class="micro-pill">
              <span>Assists</span>
              <strong>${escapeHtml(String(match.playerStats.assists))}</strong>
            </div>
            <div class="micro-pill">
              <span>K/D</span>
              <strong>${escapeHtml(String(match.playerStats.kd))}</strong>
            </div>
          </div>

          <a class="match-link" href="${match.faceitMatchUrl}" target="_blank" rel="noreferrer">Open match room</a>
        </article>
      `
    )
    .join("");
}

function renderSettings(settings) {
  settingsForm.discordChannelId.value = settings.discordChannelId ?? "";
  settingsForm.gameId.value = settings.gameId ?? "cs2";
  settingsForm.pollIntervalSeconds.value = settings.pollIntervalSeconds ?? 90;
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

playerDeck.addEventListener("click", async (event) => {
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

backupDownloadButton.addEventListener("click", () => {
  window.location.href = "/api/backup";
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

function renderFormPills(results) {
  if (!results?.length) {
    return Array.from({ length: 5 }, () => "<span class='form-pill'>-</span>").join("");
  }

  const padded = [...results];
  while (padded.length < 5) {
    padded.unshift("-");
  }

  return padded
    .map((entry) => {
      if (entry === "W") {
        return "<span class='form-pill win'>W</span>";
      }

      if (entry === "L") {
        return "<span class='form-pill loss'>L</span>";
      }

      return "<span class='form-pill'>-</span>";
    })
    .join("");
}

function showFlash(message, isError = false) {
  flash.hidden = false;
  flash.textContent = message;
  flash.style.borderColor = isError ? "rgba(255, 109, 142, 0.55)" : "rgba(77, 226, 212, 0.32)";
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
