const heroStrip = document.querySelector("#hero-strip");
const overviewKpis = document.querySelector("#overview-kpis");
const overviewPlayerGrid = document.querySelector("#overview-player-grid");
const overviewLeaderboard = document.querySelector("#overview-leaderboard");
const overallSummary = document.querySelector("#overall-summary");
const overviewFeed = document.querySelector("#overview-feed");
const playerPage = document.querySelector("#player-page");
const adminHealth = document.querySelector("#admin-health");
const adminStorage = document.querySelector("#admin-storage");
const adminRuntime = document.querySelector("#admin-runtime");
const adminDatabase = document.querySelector("#admin-database");
const flash = document.querySelector("#flash");

const overviewView = document.querySelector("#overview-view");
const playerView = document.querySelector("#player-view");
const adminView = document.querySelector("#admin-view");

const settingsForm = document.querySelector("#settings-form");
const playerForm = document.querySelector("#player-form");
const checkNowButton = document.querySelector("#check-now");
const testNotificationButton = document.querySelector("#test-notification");
const backupDownloadButton = document.querySelector("#backup-download");
const globalSearchForm = document.querySelector("#global-search-form");
const globalSearchInput = document.querySelector("#global-search-input");

let currentState = null;

async function loadState() {
  const response = await fetch("/api/state");
  currentState = await response.json();
  renderApp();
}

function renderApp() {
  if (!currentState) {
    return;
  }

  renderHero(currentState);
  renderOverview(currentState);
  renderAdmin(currentState);
  renderRoute();
  highlightActiveNav();
}

function renderHero(state) {
  heroStrip.innerHTML = `
    <div class="hero-stat">
      <span class="tiny">Joueurs suivis</span>
      <strong>${escapeHtml(String(state.analytics.hero.trackedPlayers))}</strong>
    </div>
    <div class="hero-stat">
      <span class="tiny">Matchs archives</span>
      <strong>${escapeHtml(String(state.analytics.hero.matchesTracked))}</strong>
    </div>
    <div class="hero-stat">
      <span class="tiny">Win rate global</span>
      <strong>${escapeHtml(String(state.analytics.hero.winRate))}%</strong>
    </div>
    <div class="hero-stat">
      <span class="tiny">Average ELO</span>
      <strong>${escapeHtml(String(state.analytics.overall.averageElo))}</strong>
    </div>
  `;
}

function renderOverview(state) {
  const hero = state.analytics.hero;
  const overall = state.analytics.overall;
  const players = state.analytics.playerCards;
  const leaderboard = state.analytics.leaderboard;

  overviewKpis.innerHTML = [
    ["Avg K/D", hero.averageKd, "Stabilite generale du roster"],
    ["Avg Kills", hero.averageKills, `${hero.totalKills} kills cumules`],
    ["Wins / Losses", `${state.analytics.totals.wins} / ${state.analytics.totals.losses}`, "Resultats tracks"],
    ["Total ELO", overall.totalElo, "Somme des ELO des joueurs suivis"],
    ["Top ELO", overall.bestElo ? `${overall.bestElo.nickname} - ${overall.bestElo.elo}` : "N/A", "Leader actuel"]
  ]
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

  overviewPlayerGrid.innerHTML = players.length
    ? players
        .map(
          (player) => `
            <article class="player-card clickable-card" data-open-player="${escapeAttribute(player.nickname)}">
              <div class="player-card-head">
                <img class="avatar" src="${player.avatar || ""}" alt="${escapeHtml(player.nickname)}" onerror="this.style.display='none'" />
                <div>
                  <h3>${escapeHtml(player.nickname)}</h3>
                  <div class="player-meta">${escapeHtml(String(player.elo ?? "?"))} ELO - lvl ${escapeHtml(String(player.skillLevel ?? "?"))}</div>
                </div>
              </div>
              <div class="metrics-inline">
                <span>K/D <strong>${escapeHtml(String(player.metrics.averageKd))}</strong></span>
                <span>WR <strong>${escapeHtml(String(player.metrics.winRate))}%</strong></span>
                <span>Matches <strong>${escapeHtml(String(player.metrics.matches))}</strong></span>
              </div>
              <p class="hint">${escapeHtml(player.objectiveReport.strengths[0])}</p>
            </article>
          `
        )
        .join("")
    : "<p class='hint'>Aucun joueur suivi pour le moment.</p>";

  overviewLeaderboard.innerHTML = leaderboard.length
    ? leaderboard
        .map(
          (player, index) => `
            <article class="leader-row clickable-card" data-open-player="${escapeAttribute(player.nickname)}">
              <span class="leader-rank">#${index + 1}</span>
              <div class="leader-copy">
                <strong>${escapeHtml(player.nickname)}</strong>
                <span class="tiny">${escapeHtml(String(player.elo ?? "?"))} ELO - ${escapeHtml(String(player.metrics.winRate))}% WR - ${escapeHtml(String(player.metrics.averageKd))} K/D</span>
              </div>
              <div class="leader-score">
                <strong>${escapeHtml(String(player.skillLevel ?? "?"))}</strong>
                <span class="tiny">lvl</span>
              </div>
            </article>
          `
        )
        .join("")
    : "<p class='hint'>Le classement apparaitra quand des joueurs seront suivis.</p>";

  overallSummary.innerHTML = [
    state.analytics.highlights.bestKd
      ? buildSummaryCard("Best K/D", state.analytics.highlights.bestKd.nickname, `${state.analytics.highlights.bestKd.metrics.averageKd} K/D`)
      : buildSummaryCard("Best K/D", "N/A", "Pas assez de data"),
    state.analytics.highlights.bestWinRate
      ? buildSummaryCard("Best WR", state.analytics.highlights.bestWinRate.nickname, `${state.analytics.highlights.bestWinRate.metrics.winRate}% WR`)
      : buildSummaryCard("Best WR", "N/A", "Pas assez de data"),
    state.analytics.highlights.mostActive
      ? buildSummaryCard("Most Active", state.analytics.highlights.mostActive.nickname, `${state.analytics.highlights.mostActive.metrics.matches} matchs`)
      : buildSummaryCard("Most Active", "N/A", "Pas assez de data"),
    buildSummaryCard("Storage", state.storage.dataDir, `${state.storage.snapshotCount} snapshots ELO`),
    buildSummaryCard("Bot", state.health.discordReady ? "Online" : "Offline", state.runtime.lastError || "Aucune erreur")
  ].join("");

  overviewFeed.innerHTML = state.analytics.recentMatches.length
    ? state.analytics.recentMatches
        .map(
          (match) => `
            <article class="feed-card">
              <div class="feed-head">
                <strong>${escapeHtml(match.trackedNickname)}</strong>
                <span class="pill ${match.isWin ? "win" : "loss"}">${escapeHtml(match.result)}</span>
              </div>
              <div class="tiny">${escapeHtml(match.map)} - ${escapeHtml(match.score)} - ${escapeHtml(formatDate(match.finishedAt))}</div>
              <div class="tiny">KDA ${escapeHtml(String(match.playerStats.kills))}/${escapeHtml(String(match.playerStats.deaths))}/${escapeHtml(String(match.playerStats.assists))}</div>
            </article>
          `
        )
        .join("")
    : "<p class='hint'>Aucun match detecte pour le moment.</p>";
}

function renderAdmin(state) {
  adminHealth.innerHTML = [
    buildSignal("FACEIT", state.health.faceitConfigured ? "Connected" : "Missing"),
    buildSignal("Discord", state.health.discordConfigured ? "Token ready" : "Missing"),
    buildSignal("Bot", state.health.discordReady ? "Online" : "Offline")
  ].join("");

  adminStorage.innerHTML = [
    buildSummaryCard("Data Dir", state.storage.dataDir, "Emplacement du stockage"),
    buildSummaryCard("State file", state.storage.stateFile, "Fichier principal"),
    buildSummaryCard("Match history", state.storage.matchHistoryCount, "Archives matchs"),
    buildSummaryCard("ELO snapshots", state.storage.snapshotCount, "Courbes ELO")
  ].join("");

  adminRuntime.innerHTML = [
    buildSummaryCard("Dernier check", formatDate(state.runtime.lastSuccessfulPollAt), "Derniere synchro reussie"),
    buildSummaryCard("Derniere tentative", formatDate(state.runtime.lastPollAt), "Derniere tentative de poll"),
    buildSummaryCard("Derniere erreur", state.runtime.lastError || "Aucune", "Erreur live"),
    buildSummaryCard("Started", formatDate(state.runtime.startedAt), "Demarrage du service")
  ].join("");

  adminDatabase.innerHTML = [
    buildSummaryCard("Players", state.storage.trackedPlayersCount, "Joueurs persistants"),
    buildSummaryCard("Schema", state.metadata.schemaVersion, "Version du storage"),
    buildSummaryCard("Created", formatDate(state.metadata.createdAt), "Creation etat"),
    buildSummaryCard("Updated", formatDate(state.metadata.updatedAt), "Derniere ecriture")
  ].join("");

  settingsForm.discordChannelId.value = state.settings.discordChannelId ?? "";
  settingsForm.gameId.value = state.settings.gameId ?? "cs2";
  settingsForm.pollIntervalSeconds.value = state.settings.pollIntervalSeconds ?? 90;
}

function renderPlayerPage(playerNickname) {
  const players = currentState.analytics.playerCards;
  const player = players.find(
    (entry) => entry.nickname.toLowerCase() === decodeURIComponent(playerNickname).toLowerCase()
  );

  if (!player) {
    playerPage.innerHTML = `
      <article class="card">
        <h2>Joueur introuvable</h2>
        <p class="hint">Ce joueur n'existe pas encore dans le tracker. Utilise la recherche ou ajoute-le depuis la vue generale.</p>
      </article>
    `;
    return;
  }

  const playerMatches = currentState.analytics.recentMatches.filter(
    (match) => match.trackedNickname.toLowerCase() === player.nickname.toLowerCase()
  );

  playerPage.innerHTML = `
    <section class="player-hero card">
      <div class="player-hero-head">
        <div class="player-hero-copy">
          <div class="player-card-head">
            <img class="avatar avatar-lg" src="${player.avatar || ""}" alt="${escapeHtml(player.nickname)}" onerror="this.style.display='none'" />
            <div>
              <p class="section-tag">Profil joueur</p>
              <h2>${escapeHtml(player.nickname)}</h2>
              <div class="player-meta">${escapeHtml(String(player.elo ?? "?"))} ELO - level ${escapeHtml(String(player.skillLevel ?? "?"))}</div>
            </div>
          </div>
          <div class="metrics-inline">
            <span>K/D <strong>${escapeHtml(String(player.metrics.averageKd))}</strong></span>
            <span>WR <strong>${escapeHtml(String(player.metrics.winRate))}%</strong></span>
            <span>Kills <strong>${escapeHtml(String(player.metrics.averageKills))}</strong></span>
            <span>HS <strong>${escapeHtml(String(player.metrics.averageHs))}%</strong></span>
          </div>
        </div>
        <a class="player-link" href="${player.faceitUrl}" target="_blank" rel="noreferrer">Ouvrir FACEIT</a>
      </div>
    </section>

    <section class="layout-two">
      <article class="card">
        <div class="section-head">
          <div>
            <p class="section-tag">Analyse objective</p>
            <h2>Forces, faiblesses, axes de travail</h2>
          </div>
        </div>
        <div class="analysis-grid">
          ${renderAnalysisColumn("Forces", player.objectiveReport.strengths)}
          ${renderAnalysisColumn("Faiblesses", player.objectiveReport.weaknesses)}
          ${renderAnalysisColumn("Focus", player.objectiveReport.focus)}
        </div>
      </article>

      <article class="card">
        <div class="section-head">
          <div>
            <p class="section-tag">Resume</p>
            <h2>Snapshot du profil</h2>
          </div>
        </div>
        <div class="summary-grid">
          ${buildSummaryCard("Matches", player.metrics.matches, "Taille de l'echantillon")}
          ${buildSummaryCard("Streak", player.metrics.streak.label, "Dynamique recente")}
          ${buildSummaryCard("MVPs avg", player.metrics.averageMvps, "Valeur moyenne")}
          ${buildSummaryCard("K/R", player.metrics.averageKr, "Rendement par round")}
        </div>
      </article>
    </section>

    <section class="player-charts-grid">
      <article class="card">
        <div class="section-head">
          <div>
            <p class="section-tag">ELO</p>
            <h2>Courbe d'evolution</h2>
          </div>
        </div>
        <div class="chart-stage compact">${renderSeriesLineChart(player.eloSeries, "elo", 860, 240, 0)}</div>
      </article>

      <article class="card">
        <div class="section-head">
          <div>
            <p class="section-tag">K/D</p>
            <h2>Regularite</h2>
          </div>
        </div>
        <div class="chart-stage small">${renderSeriesLineChart(player.chartSeries, "kd", 420, 200, 2)}</div>
      </article>

      <article class="card">
        <div class="section-head">
          <div>
            <p class="section-tag">Kills</p>
            <h2>Volume par match</h2>
          </div>
        </div>
        <div class="chart-stage small">${renderBarChart(player.chartSeries, "kills", 420, 200)}</div>
      </article>

      <article class="card">
        <div class="section-head">
          <div>
            <p class="section-tag">Heat</p>
            <h2>Forme recente</h2>
          </div>
        </div>
        <div class="heat-grid">${renderHeatCells(player.chartSeries)}</div>
      </article>
    </section>

    <section class="card">
      <div class="section-head">
        <div>
          <p class="section-tag">Recent feed</p>
          <h2>Derniers matchs du joueur</h2>
        </div>
      </div>
      <div class="match-list">
        ${playerMatches.length ? playerMatches.map(renderMatchCard).join("") : "<p class='hint'>Pas encore de match recent pour ce joueur.</p>"}
      </div>
    </section>
  `;
}

function renderRoute() {
  const path = window.location.pathname;
  overviewView.hidden = true;
  playerView.hidden = true;
  adminView.hidden = true;

  if (path === "/admin") {
    adminView.hidden = false;
    return;
  }

  if (path.startsWith("/players/")) {
    playerView.hidden = false;
    renderPlayerPage(path.replace("/players/", ""));
    return;
  }

  overviewView.hidden = false;
}

function highlightActiveNav() {
  const path = window.location.pathname;
  for (const link of document.querySelectorAll("[data-nav]")) {
    const href = link.getAttribute("href");
    link.classList.toggle("active", href === path || (href === "/" && !path.startsWith("/admin") && !path.startsWith("/players/")));
  }
}

function navigateTo(path) {
  history.pushState({}, "", path);
  renderRoute();
  highlightActiveNav();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildSignal(label, value) {
  return `
    <div class="signal-pill">
      <span class="tiny">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildSummaryCard(title, value, note) {
  return `
    <article class="summary-card">
      <span class="tiny">${escapeHtml(String(title))}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <p class="hint">${escapeHtml(String(note))}</p>
    </article>
  `;
}

function renderAnalysisColumn(title, items) {
  return `
    <article class="analysis-card">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderMatchCard(match) {
  return `
    <article class="feed-card">
      <div class="feed-head">
        <strong>${escapeHtml(match.map)}</strong>
        <span class="pill ${match.isWin ? "win" : "loss"}">${escapeHtml(match.result)}</span>
      </div>
      <div class="tiny">${escapeHtml(match.score)} - ${escapeHtml(formatDate(match.finishedAt))}</div>
      <div class="tiny">KDA ${escapeHtml(String(match.playerStats.kills))}/${escapeHtml(String(match.playerStats.deaths))}/${escapeHtml(String(match.playerStats.assists))}</div>
    </article>
  `;
}

function renderSeriesLineChart(series, key, width, height, digits) {
  if (!series?.length) {
    return "<p class='hint'>Pas assez de data.</p>";
  }

  const padding = 28;
  const values = series.map((entry) => Number(entry[key] ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const points = series.map((entry, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, series.length - 1);
    const value = Number(entry[key] ?? 0);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y, value };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="chart">
      <path class="chart-line" d="${path}"></path>
      ${points.map((point) => `<circle class="chart-point win" cx="${point.x}" cy="${point.y}" r="4"></circle>`).join("")}
      <text class="chart-axis-label" x="6" y="18">${max.toFixed(digits)}</text>
      <text class="chart-axis-label" x="6" y="${height - 12}">${min.toFixed(digits)}</text>
    </svg>
  `;
}

function renderBarChart(series, key, width, height) {
  if (!series?.length) {
    return "<p class='hint'>Pas assez de data.</p>";
  }
  const padding = 18;
  const values = series.map((entry) => Number(entry[key] ?? 0));
  const max = Math.max(1, ...values);
  const step = (width - padding * 2) / values.length;
  const barWidth = Math.max(12, step - 6);
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="bar chart">
      ${values
        .map((value, index) => {
          const x = padding + index * step;
          const barHeight = (value / max) * (height - padding * 2);
          const y = height - padding - barHeight;
          return `<rect class="bar" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="8"></rect>`;
        })
        .join("")}
      <text class="chart-axis-label" x="6" y="18">${max.toFixed(0)}</text>
    </svg>
  `;
}

function renderHeatCells(series) {
  if (!series?.length) {
    return "<p class='hint'>Pas encore de heat map.</p>";
  }

  return series
    .slice(-6)
    .map(
      (entry, index) => `
        <div class="heat-cell ${entry.isWin ? "win" : "loss"}">
          <span class="tiny">M${index + 1}</span>
          <strong>${entry.isWin ? "W" : "L"}</strong>
          <span class="tiny">${escapeHtml(String(entry.kd ?? entry.elo ?? ""))}</span>
        </div>
      `
    )
    .join("");
}

document.addEventListener("click", (event) => {
  const navTarget = event.target.closest("[data-nav]");
  if (navTarget) {
    event.preventDefault();
    navigateTo(navTarget.getAttribute("href"));
    return;
  }

  const playerTarget = event.target.closest("[data-open-player]");
  if (playerTarget) {
    event.preventDefault();
    navigateTo(`/players/${encodeURIComponent(playerTarget.getAttribute("data-open-player"))}`);
    return;
  }
});

globalSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = globalSearchInput.value.trim();
  if (!value) {
    return;
  }
  navigateTo(`/players/${encodeURIComponent(value)}`);
});

playerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await fetchJson("/api/players", {
      method: "POST",
      body: JSON.stringify({ nickname: playerForm.nickname.value })
    });
    playerForm.reset();
    showFlash(`Joueur ajoute. ${result.player?.backfilledMatches ?? 0} match(s) historiques importes.`);
    await loadState();
  } catch (error) {
    showFlash(error.message, true);
  }
});

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
    showFlash("Configuration admin enregistree.");
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

window.addEventListener("popstate", () => {
  renderRoute();
  highlightActiveNav();
});

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
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
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
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
