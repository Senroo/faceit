import { setTimeout as delay } from "node:timers/promises";

export class MatchTracker {
  constructor({ store, faceitService, notificationService }) {
    this.store = store;
    this.faceitService = faceitService;
    this.notificationService = notificationService;
    this.running = false;
    this.loopPromise = null;
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.loopPromise = this.runLoop();
  }

  stop() {
    this.running = false;
  }

  async addPlayer(nickname) {
    const player = await this.faceitService.getPlayerByNickname(nickname);
    const state = this.store.getState();
    const existingPlayer = state.trackedPlayers.find(
      (entry) => entry.playerId === player.playerId
    );
    const gameId = player.gameId ?? state.settings.gameId;

    await this.store.upsertTrackedPlayer({
      ...player,
      gameId,
      addedAt: existingPlayer?.addedAt ?? new Date().toISOString()
    });
    await this.store.addEloSnapshot(player.playerId, {
      elo: player.elo,
      skillLevel: player.skillLevel,
      nickname: player.nickname
    });

    const backfilled = await this.backfillPlayerHistory({
      ...player,
      gameId
    });

    return {
      ...player,
      backfilledMatches: backfilled
    };
  }

  async checkNow() {
    return this.pollOnce();
  }

  async sendTestNotification() {
    const state = this.store.getState();
    await this.notificationService.sendTestMessage(state.settings.discordChannelId);
  }

  async runLoop() {
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (error) {
        await this.store.setRuntime({
          lastError: error.message
        });
        console.error("[tracker] poll failed:", error);
      }

      const waitSeconds = Math.max(
        30,
        Number(this.store.getState().settings.pollIntervalSeconds) || 90
      );

      await delay(waitSeconds * 1000);
    }
  }

  async pollOnce() {
    const state = this.store.getState();
    const startedAt = new Date().toISOString();

    await this.store.setRuntime({
      startedAt: state.runtime.startedAt ?? startedAt,
      lastPollAt: startedAt
    });

    if (!this.faceitService.isConfigured()) {
      await this.store.setRuntime({
        lastError: "Configuration FACEIT manquante."
      });
      return;
    }

    if (!this.notificationService.isReady()) {
      await this.store.setRuntime({
        lastError: "Bot Discord hors ligne."
      });
      return;
    }

    if (!state.settings.discordChannelId) {
      await this.store.setRuntime({
        lastError: "Aucun salon Discord configure pour les notifications."
      });
      return;
    }

    if (!state.trackedPlayers.length) {
      await this.store.setRuntime({
        lastSuccessfulPollAt: new Date().toISOString(),
        lastError: null
      });
      return;
    }

    for (const player of state.trackedPlayers) {
      await this.processPlayer(player, state.settings.gameId);
    }

    await this.store.setRuntime({
      lastSuccessfulPollAt: new Date().toISOString(),
      lastError: null
    });
  }

  async processPlayer(player, fallbackGameId) {
    const refreshedPlayer = await this.refreshPlayerProfile(player);
    const gameId = refreshedPlayer.gameId ?? fallbackGameId;
    const history = await this.faceitService.getPlayerHistory(refreshedPlayer.playerId, gameId, 20);
    const lastProcessedMatchId = this.store.getState().processedMatches[refreshedPlayer.playerId];

    const pendingMatches = [];
    for (const entry of history) {
      if (entry.match_id === lastProcessedMatchId) {
        break;
      }

      pendingMatches.push(entry);
    }

    for (const match of pendingMatches.reverse()) {
      const summary = await this.buildMatchSummary(refreshedPlayer, match);
      await this.notificationService.sendMatchFinished(summary);
      await this.store.addRecentMatch(summary, { includeInRecent: true });
    }

    if (history[0]?.match_id) {
      await this.store.setProcessedMatch(refreshedPlayer.playerId, history[0].match_id);
    }
  }

  async refreshPlayerProfile(player) {
    const latest = await this.faceitService.getPlayerByNickname(player.nickname);
    const merged = {
      ...player,
      ...latest,
      addedAt: player.addedAt
    };
    await this.store.upsertTrackedPlayer(merged);
    await this.store.addEloSnapshot(merged.playerId, {
      elo: merged.elo,
      skillLevel: merged.skillLevel,
      nickname: merged.nickname
    });
    return merged;
  }

  async buildMatchSummary(player, historyMatch) {
    const stats = await this.faceitService.getMatchStats(historyMatch.match_id);
    const firstRound = stats.rounds?.[0] ?? {};
    const teams = Array.isArray(firstRound.teams) ? firstRound.teams : [];
    const gameId = player.gameId ?? this.store.getState().settings.gameId;

    const playerTeam = teams.find((team) =>
      Array.isArray(team.players) &&
      team.players.some((entry) => entry.player_id === player.playerId)
    );

    const opponentTeam = teams.find((team) => team !== playerTeam);
    const playerStats = playerTeam?.players?.find((entry) => entry.player_id === player.playerId);
    const teamScore = readNumber(playerTeam?.team_stats?.["Final Score"]);
    const opponentScore = readNumber(opponentTeam?.team_stats?.["Final Score"]);
    const didWin = Number.isFinite(teamScore) && Number.isFinite(opponentScore)
      ? teamScore > opponentScore
      : playerStats?.player_stats?.Result === "1";

    return {
      matchId: historyMatch.match_id,
      trackedNickname: player.nickname,
      avatar: player.avatar ?? null,
      faceitProfileUrl: player.faceitUrl ?? null,
      competitionName:
        historyMatch.competition_name ??
        firstRound.round_stats?.Competition ??
        "Match FACEIT",
      map: firstRound.round_stats?.Map ?? historyMatch.i18n?.map ?? "Inconnue",
      gameMode: firstRound.round_stats?.["Game Mode"] ?? historyMatch.game_mode ?? "Standard",
      startedAt: toIsoOrNull(historyMatch.started_at),
      finishedAt: toIsoOrNull(historyMatch.finished_at),
      faceitMatchUrl: `https://www.faceit.com/en/${gameId}/room/${historyMatch.match_id}`,
      duration: formatDuration(historyMatch.started_at, historyMatch.finished_at),
      isWin: didWin,
      result: didWin ? "Victoire" : "Defaite",
      score: formatScore(teamScore, opponentScore),
      teamScore: Number.isFinite(teamScore) ? teamScore : null,
      opponentScore: Number.isFinite(opponentScore) ? opponentScore : null,
      elo: player.elo,
      skillLevel: player.skillLevel,
      playerStats: {
        kills: playerStats?.player_stats?.Kills ?? "N/A",
        deaths: playerStats?.player_stats?.Deaths ?? "N/A",
        assists: playerStats?.player_stats?.Assists ?? "N/A",
        kd: playerStats?.player_stats?.["K/D Ratio"] ?? "N/A",
        kr: playerStats?.player_stats?.["K/R Ratio"] ?? "N/A",
        hs: playerStats?.player_stats?.["Headshots %"] ?? "N/A",
        mvps: playerStats?.player_stats?.MVPs ?? "N/A"
      }
    };
  }

  async backfillPlayerHistory(player, options = {}) {
    const pageSize = options.pageSize ?? 20;
    const maxMatches = options.maxMatches ?? 25;
    const gameId = player.gameId ?? this.store.getState().settings.gameId;
    const state = this.store.getState();
    const existingIds = new Set(
      state.matchHistory
        .filter((entry) => entry.trackedNickname?.toLowerCase() === player.nickname.toLowerCase())
        .map((entry) => entry.matchId)
    );

    let offset = 0;
    let imported = 0;
    let newestMatchId = null;

    while (imported < maxMatches) {
      const history = await this.faceitService.getPlayerHistory(player.playerId, gameId, pageSize, offset);
      if (!history.length) {
        break;
      }

      if (!newestMatchId && history[0]?.match_id) {
        newestMatchId = history[0].match_id;
      }

      const unseen = history.filter((entry) => !existingIds.has(entry.match_id));
      if (!unseen.length) {
        if (history.length < pageSize) {
          break;
        }

        offset += pageSize;
        continue;
      }

      for (const match of unseen.reverse()) {
        if (imported >= maxMatches) {
          break;
        }

        const summary = await this.buildMatchSummary(player, match);
        await this.store.addRecentMatch(summary, { includeInRecent: false });
        existingIds.add(match.match_id);
        imported += 1;
      }

      if (history.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    if (newestMatchId) {
      await this.store.setProcessedMatch(player.playerId, newestMatchId);
    }

    return imported;
  }
}

function readNumber(value) {
  if (value === undefined || value === null || value === "") {
    return Number.NaN;
  }

  return Number.parseFloat(String(value).replace(",", "."));
}

function formatScore(teamScore, opponentScore) {
  if (!Number.isFinite(teamScore) || !Number.isFinite(opponentScore)) {
    return "N/A";
  }

  return `${teamScore} - ${opponentScore}`;
}

function toIsoOrNull(timestamp) {
  if (!timestamp) {
    return null;
  }

  const numeric = Number(timestamp);
  if (Number.isFinite(numeric) && numeric > 0) {
    const multiplier = numeric < 1000000000000 ? 1000 : 1;
    return new Date(numeric * multiplier).toISOString();
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function formatDuration(startedAt, finishedAt) {
  const start = toMillis(startedAt);
  const end = toMillis(finishedAt);

  if (!start || !end || end <= start) {
    return "N/A";
  }

  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h${String(minutes).padStart(2, "0")}`;
  }

  return `${minutes}m`;
}

function toMillis(timestamp) {
  if (!timestamp) {
    return 0;
  }

  const numeric = Number(timestamp);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 1000000000000 ? numeric * 1000 : numeric;
  }

  const parsed = new Date(timestamp).valueOf();
  return Number.isFinite(parsed) ? parsed : 0;
}
