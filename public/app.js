const healthGrid = document.querySelector("#health-grid");
const storageGrid = document.querySelector("#storage-grid");
const globalKpis = document.querySelector("#global-kpis");
const playerDeck = document.querySelector("#player-deck");
const leaderboard = document.querySelector("#leaderboard");
const runtime = document.querySelector("#runtime");
const highlights = document.querySelector("#highlights");
const recentMatches = document.querySelector("#recent-matches");
const flash = document.querySelector("#flash");
const chartModeSelect = document.querySelector("#chart-mode");
const chartPlayerSelect = document.querySelector("#chart-player");
const chartMeta = document.querySelector("#chart-meta");
const performanceChart = document.querySelector("#performance-chart");
const trendStrip = document.querySelector("#trend-strip");

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
  renderChartControls(state.analytics);
  renderChart();
  renderTrendStrip(state.analytics.playerCards);
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
                : "Historical import in progress"}
            </div>
            <div class="player-actions">
              <button class="ghost" data-focus-player="${escapeAttribute(player.nickname)}">Focus chart</button>
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
            <span class="tiny">${escapeHtml(String(entry.metrics.matches))} matchs - ${escapeHtml(String(entry.metrics.winRate))}% WR - ${escapeHtml(String(entry.metrics.averageKd))} K/D</span>
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
    ["Best K/D", data.bestKd, (entry) => `${entry.metrics.averageKd} K/D moyen`],
    ["Best Win Rate", data.bestWinRate, (entry) => `${entry.metrics.winRate}% sur ${entry.metrics.matches} matchs`],
    ["Most Active", data.mostActive, (entry) => `${entry.metrics.matches} matchs joues`]
  ];

  highlights.innerHTML = items
    .map(([label, entry, formatter]) => {
      if (!entry) {
        return `
          <article class="highlight-card">
            <div class="tiny">${escapeHtml(label)}</div>
            <strong>Import en attente</strong>
            <p class="hint">Ajoute ou synchronise plus de matchs pour remplir cette carte.</p>
          </article>
        `;
      }

      return `
        <article class="highlight-card">
          <div class="tiny">${escapeHtml(label)}</div>
          <strong>${escapeHtml(entry.nickname)}</strong>
          <p class="hint">${escapeHtml(formatter(entry))}</p>
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

function renderChartControls(analytics) {
  const players = analytics.playerCards.filter((entry) => entry.metrics.matches > 0);
  const currentValue = chartPlayerSelect.value;
  chartPlayerSelect.innerHTML = players.length
    ? players
        .map(
          (player) => `
            <option value="${escapeAttribute(player.nickname)}">${escapeHtml(player.nickname)}</option>
          `
        )
        .join("")
    : "<option value=''>No data</option>";

  if (players.some((player) => player.nickname === currentValue)) {
    chartPlayerSelect.value = currentValue;
  } else if (players[0]) {
    chartPlayerSelect.value = players[0].nickname;
  }

  chartPlayerSelect.disabled = chartModeSelect.value !== "player" || !players.length;
}

function renderChart() {
  if (!currentState) {
    return;
  }

  const analytics = currentState.analytics;
  const isPlayerMode = chartModeSelect.value === "player";
  const activeSeries = isPlayerMode
    ? analytics.charts.players.find((entry) => entry.nickname === chartPlayerSelect.value)?.series ?? []
    : analytics.charts.overview;

  chartPlayerSelect.disabled = !isPlayerMode || !analytics.charts.players.length;

  if (!activeSeries.length) {
    chartMeta.innerHTML = "<span class='signal-pill'>Pas assez de donnees pour tracer un graphique.</span>";
    performanceChart.innerHTML = "<p class='hint'>Ajoute un joueur puis laisse le backfill importer ses anciens matchs.</p>";
    return;
  }

  const title = isPlayerMode ? `Vue joueur: ${chartPlayerSelect.value}` : "Vue equipe";
  const latest = activeSeries[activeSeries.length - 1];
  const metricLabel = isPlayerMode ? "points de forme" : "points cumules";

  chartMeta.innerHTML = [
    `<span class="signal-pill">${escapeHtml(title)}</span>`,
    `<span class="signal-pill">Samples: ${escapeHtml(String(activeSeries.length))}</span>`,
    `<span class="signal-pill">Latest ${escapeHtml(metricLabel)}: ${escapeHtml(String(latest.points ?? latest.value ?? 0))}</span>`
  ].join("");

  performanceChart.innerHTML = renderLineChart(activeSeries, isPlayerMode);
}

function renderTrendStrip(players) {
  const active = players.filter((entry) => entry.metrics.matches > 0).slice(0, 4);
  if (!active.length) {
    trendStrip.innerHTML = "<p class='hint'>Les tendances apparaitront apres import des matchs.</p>";
    return;
  }

  trendStrip.innerHTML = active
    .map(
      (player) => `
        <article class="trend-card">
          <div class="tiny">${escapeHtml(player.nickname)}</div>
          <strong>${escapeHtml(String(player.metrics.impactScore))} impact</strong>
          <div class="tiny">${escapeHtml(String(player.metrics.averageKills))} kills avg - ${escapeHtml(String(player.metrics.averageKd))} K/D</div>
        </article>
      `
    )
    .join("");
}

function renderLineChart(series, isPlayerMode) {
  const width = 760;
  const height = 280;
  const padding = 34;
  const values = series.map((entry) => entry.points ?? entry.value ?? 0);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const safeRange = Math.max(1, maxValue - minValue);

  const points = series.map((entry, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(1, series.length - 1);
    const value = entry.points ?? entry.value ?? 0;
    const y = height - padding - ((value - minValue) / safeRange) * (height - padding * 2);
    return {
      x,
      y,
      value,
      label: entry.label,
      className: entry.isWin === false || entry.result === "Defaite" ? "loss" : "win"
    };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  const gridValues = [minValue, minValue + safeRange / 2, maxValue];

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Performance chart">
      ${gridValues
        .map((gridValue) => {
          const y = height - padding - ((gridValue - minValue) / safeRange) * (height - padding * 2);
          return `
            <line class="chart-grid-line" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"></line>
            <text class="chart-axis-label" x="6" y="${y + 4}">${gridValue.toFixed(0)}</text>
          `;
        })
        .join("")}
      <path class="chart-area" d="${areaPath}"></path>
      <path class="chart-line" d="${linePath}"></path>
      ${points
        .map(
          (point, index) => `
            <circle class="chart-point ${point.className}" cx="${point.x}" cy="${point.y}" r="5"></circle>
            ${
              index === points.length - 1
                ? `<text class="chart-axis-label" x="${point.x - 10}" y="${point.y - 12}">${escapeHtml(String(point.value.toFixed(0)))}</text>`
                : ""
            }
          `
        )
        .join("")}
      <text class="chart-axis-label" x="${padding}" y="${height - 8}">1</text>
      <text class="chart-axis-label" x="${width - padding - 26}" y="${height - 8}">
        ${isPlayerMode ? "latest" : "team"}
      </text>
    </svg>
  `;
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
    const result = await fetchJson("/api/players", {
      method: "POST",
      body: JSON.stringify({
        nickname: playerForm.nickname.value
      })
    });

    playerForm.reset();
    const imported = result.player?.backfilledMatches ?? 0;
    showFlash(`Joueur ajoute au suivi. ${imported} ancien(s) match(s) importes.`);
    await loadState();
  } catch (error) {
    showFlash(error.message, true);
  }
});

playerDeck.addEventListener("click", async (event) => {
  const nicknameToRemove = event.target.getAttribute("data-remove");
  if (nicknameToRemove) {
    try {
      await fetchJson(`/api/players/${encodeURIComponent(nicknameToRemove)}`, {
        method: "DELETE"
      });

      showFlash("Joueur retire du suivi.");
      await loadState();
    } catch (error) {
      showFlash(error.message, true);
    }
    return;
  }

  const focusPlayer = event.target.getAttribute("data-focus-player");
  if (focusPlayer) {
    chartModeSelect.value = "player";
    chartPlayerSelect.value = focusPlayer;
    renderChart();
    document.querySelector("#analytics")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

chartModeSelect.addEventListener("change", () => {
  chartPlayerSelect.disabled = chartModeSelect.value !== "player";
  renderChart();
});

chartPlayerSelect.addEventListener("change", () => {
  renderChart();
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
