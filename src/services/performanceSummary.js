export function buildDashboardSummary(state, storageInfo = {}) {
  const trackedPlayers = Array.isArray(state.trackedPlayers) ? state.trackedPlayers : [];
  const matchHistory = Array.isArray(state.matchHistory) ? state.matchHistory : [];
  const recentMatches = Array.isArray(state.recentMatches) ? state.recentMatches : [];
  const eloSnapshots = state.eloSnapshots ?? {};
  const groupedByPlayer = groupMatchesByPlayer(matchHistory);
  const playerCards = trackedPlayers.map((player) =>
    buildPlayerCard(
      player,
      groupedByPlayer.get(player.nickname.toLowerCase()) ?? [],
      eloSnapshots[player.playerId] ?? []
    )
  );
  const activePlayerCards = playerCards.filter((entry) => entry.metrics.matches > 0);

  const globalMatches = matchHistory.length;
  const globalWins = matchHistory.filter((entry) => entry.isWin === true).length;
  const globalLosses = matchHistory.filter((entry) => entry.isWin === false).length;
  const totalKills = sum(matchHistory, (entry) => toNumber(entry.playerStats?.kills));
  const totalDeaths = sum(matchHistory, (entry) => toNumber(entry.playerStats?.deaths));
  const totalAssists = sum(matchHistory, (entry) => toNumber(entry.playerStats?.assists));

  return {
    hero: {
      trackedPlayers: trackedPlayers.length,
      matchesTracked: globalMatches,
      winRate: percentage(globalWins, globalMatches),
      averageKd: average(matchHistory, (entry) => toNumber(entry.playerStats?.kd), 2),
      averageKills: average(matchHistory, (entry) => toNumber(entry.playerStats?.kills), 1),
      totalKills,
      totalDeaths,
      totalAssists,
      form: recentMatches
        .slice(0, 10)
        .reverse()
        .map((entry) => ({
          matchId: entry.matchId,
          trackedNickname: entry.trackedNickname,
          result: entry.result,
          isWin: entry.isWin === true
        }))
    },
    highlights: {
      bestKd: sortCards(activePlayerCards, (entry) => entry.metrics.averageKd)[0] ?? null,
      bestWinRate: sortCards(
        activePlayerCards.filter((entry) => entry.metrics.matches >= 3),
        (entry) => entry.metrics.winRate
      )[0] ?? null,
      mostActive: sortCards(activePlayerCards, (entry) => entry.metrics.matches)[0] ?? null
    },
    leaderboard: sortCards(
      activePlayerCards,
      (entry) => Number(entry.elo ?? 0)
    ).slice(0, 8),
    playerCards: sortCards(playerCards, (entry) => entry.metrics.matches),
    recentMatches: recentMatches.slice(0, 12),
    storage: {
      ...storageInfo,
      persistentHint:
        storageInfo.dataDir === "/data"
          ? "Volume Railway probable si /data est monte."
          : "Monte un volume Railway sur /data pour conserver les joueurs entre redeploiements."
    },
    totals: {
      wins: globalWins,
      losses: globalLosses
    },
    overall: {
      totalElo: sum(activePlayerCards, (entry) => Number(entry.elo ?? 0)),
      averageElo: average(activePlayerCards, (entry) => Number(entry.elo ?? 0), 0),
      bestElo: sortCards(activePlayerCards, (entry) => Number(entry.elo ?? 0))[0] ?? null
    },
    charts: {
      overview: buildOverviewChart(matchHistory),
      players: activePlayerCards.map((entry) => ({
        nickname: entry.nickname,
        series: buildPlayerTimeline(groupedByPlayer.get(entry.nickname.toLowerCase()) ?? []),
        eloSeries: entry.eloSeries
      }))
    }
  };
}

function buildPlayerCard(player, matches, eloSeries) {
  const wins = matches.filter((entry) => entry.isWin === true).length;
  const losses = matches.filter((entry) => entry.isWin === false).length;
  const recentForm = matches
    .slice(0, 5)
    .reverse()
    .map((entry) => (entry.isWin ? "W" : "L"));
  const streak = computeStreak(matches);
  const averageKd = average(matches, (entry) => toNumber(entry.playerStats?.kd), 2);
  const averageKills = average(matches, (entry) => toNumber(entry.playerStats?.kills), 1);
  const averageDeaths = average(matches, (entry) => toNumber(entry.playerStats?.deaths), 1);
  const averageAssists = average(matches, (entry) => toNumber(entry.playerStats?.assists), 1);
  const averageKr = average(matches, (entry) => toNumber(entry.playerStats?.kr), 2);
  const averageHs = average(matches, (entry) => toNumber(entry.playerStats?.hs), 1);
  const averageMvps = average(matches, (entry) => toNumber(entry.playerStats?.mvps), 1);
  const impactScore = round(
    averageKd * 40 +
      averageKills * 1.7 +
      percentage(wins, matches.length) * 0.45 +
      averageMvps * 6,
    1
  );

  return {
    playerId: player.playerId,
    nickname: player.nickname,
    avatar: player.avatar,
    faceitUrl: buildFaceitProfileUrl(player.nickname),
    gameId: player.gameId,
    skillLevel: player.skillLevel,
    elo: player.elo,
    addedAt: player.addedAt,
    metrics: {
      matches: matches.length,
      wins,
      losses,
      winRate: percentage(wins, matches.length),
      averageKd,
      averageKills,
      averageDeaths,
      averageAssists,
      averageKr,
      averageHs,
      averageMvps,
      streak,
      recentForm,
      impactScore
    },
    chartSeries: buildPlayerTimeline(matches),
    eloSeries: normalizeEloSeries(eloSeries),
    objectiveReport: buildObjectiveReport({
      matchesCount: matches.length,
      averageKd,
      averageHs,
      averageKills,
      averageDeaths,
      winRate: percentage(wins, matches.length),
      streak,
      elo: Number(player.elo ?? 0)
    }),
    lastMatch: matches[0]
      ? {
          result: matches[0].result,
          map: matches[0].map,
          score: matches[0].score,
          finishedAt: matches[0].finishedAt
        }
      : null
  };
}

function buildObjectiveReport(metrics) {
  const strengths = [];
  const weaknesses = [];
  const focus = [];

  if (metrics.averageKd >= 1.15) {
    strengths.push("Bonne stabilite au duel, le K/D montre une vraie constance.");
  }
  if (metrics.averageHs >= 45) {
    strengths.push("Precision correcte, le taux de headshots est un vrai point fort.");
  }
  if (metrics.winRate >= 55) {
    strengths.push("Impact positif sur les issues de matchs, le win rate suit.");
  }
  if (metrics.averageKills >= 20) {
    strengths.push("Capable de generer du volume de kills de facon reguliere.");
  }

  if (metrics.averageKd < 1) {
    weaknesses.push("Le ratio kill/death reste fragile et coute des rounds.");
  }
  if (metrics.averageDeaths > metrics.averageKills) {
    weaknesses.push("Trop d'exposition en round, les morts depassent le volume offensif.");
  }
  if (metrics.winRate < 45) {
    weaknesses.push("Les resultats d'equipe ne suivent pas encore les intentions.");
  }
  if (metrics.streak.positive === false && metrics.streak.count >= 3) {
    weaknesses.push("Serie negative en cours, il faut casser la dynamique.");
  }

  if (!strengths.length) {
    strengths.push("Profil encore en construction, les points forts apparaitront avec plus de matchs.");
  }
  if (!weaknesses.length) {
    weaknesses.push("Pas de faille majeure evidente sur l'echantillon actuel.");
  }

  focus.push("Prioriser les rounds a forte valeur plutot que forcer les fights neutres.");
  focus.push("Verifier la regularite du debut de match pour mieux lancer la dynamique.");

  if (metrics.averageKd < 1) {
    focus.push("Travailler le placement post-contact pour reduire les morts gratuites.");
  } else {
    focus.push("Transformer la bonne base individuelle en impact encore plus decisif en round cle.");
  }

  return { strengths, weaknesses, focus };
}

function normalizeEloSeries(series) {
  return [...series]
    .map((entry, index) => ({
      index: index + 1,
      recordedAt: entry.recordedAt,
      elo: Number(entry.elo ?? 0),
      skillLevel: entry.skillLevel ?? null
    }))
    .sort((left, right) => dateValue(left.recordedAt) - dateValue(right.recordedAt));
}

function buildOverviewChart(matches) {
  const sorted = [...matches].sort((left, right) => dateValue(left.finishedAt) - dateValue(right.finishedAt));
  let runningScore = 0;

  return sorted.map((match, index) => {
    runningScore += computePerformancePoints(match);

    return {
      index: index + 1,
      label: match.finishedAt ?? `Match ${index + 1}`,
      value: runningScore,
      result: match.result,
      trackedNickname: match.trackedNickname
    };
  });
}

function buildPlayerTimeline(matches) {
  const sorted = [...matches].sort((left, right) => dateValue(left.finishedAt) - dateValue(right.finishedAt));
  let runningPoints = 0;

  return sorted.map((match, index) => {
    runningPoints += computePerformancePoints(match);

    return {
      index: index + 1,
      label: match.finishedAt ?? `Match ${index + 1}`,
      points: runningPoints,
      kd: toNumber(match.playerStats?.kd),
      kills: toNumber(match.playerStats?.kills),
      result: match.result,
      isWin: match.isWin === true
    };
  });
}

function groupMatchesByPlayer(matches) {
  const grouped = new Map();

  for (const match of matches) {
    const key = String(match.trackedNickname ?? "").toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(match);
  }

  for (const [, entries] of grouped) {
    entries.sort((left, right) => dateValue(right.finishedAt) - dateValue(left.finishedAt));
  }

  return grouped;
}

function computeStreak(matches) {
  if (!matches.length) {
    return { label: "No data", count: 0, positive: null };
  }

  const first = matches[0].isWin === true;
  let count = 0;
  for (const match of matches) {
    if ((match.isWin === true) === first) {
      count += 1;
    } else {
      break;
    }
  }

  return {
    label: `${first ? "Win" : "Lose"} x${count}`,
    count,
    positive: first
  };
}

function computePerformancePoints(match) {
  return round(
    toNumber(match.playerStats?.kills) +
      toNumber(match.playerStats?.assists) * 0.6 +
      toNumber(match.playerStats?.mvps) * 2.2 +
      (match.isWin ? 8 : -2),
    1
  );
}

function buildFaceitProfileUrl(nickname) {
  return `https://www.faceit.com/fr/players/${encodeURIComponent(nickname)}`;
}

function sortCards(items, selector) {
  return [...items].sort((left, right) => selector(right) - selector(left));
}

function sum(items, selector) {
  return round(items.reduce((total, item) => total + selector(item), 0), 1);
}

function average(items, selector, digits) {
  if (!items.length) {
    return 0;
  }

  const total = items.reduce((sumValue, item) => sumValue + selector(item), 0);
  return round(total / items.length, digits);
}

function percentage(part, total) {
  if (!total) {
    return 0;
  }

  return round((part / total) * 100, 1);
}

function toNumber(value) {
  const numeric = Number.parseFloat(String(value ?? "0").replace("%", "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dateValue(value) {
  return value ? new Date(value).valueOf() : 0;
}
