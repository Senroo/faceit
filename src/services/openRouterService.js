const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterService {
  constructor({ apiKey, model = "google/gemma-4-26b-a4b-it", appUrl, appTitle }) {
    this.apiKey = apiKey;
    this.model = model;
    this.appUrl = appUrl;
    this.appTitle = appTitle ?? "FACEIT Tracker";
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async analyzePlayerProfile({ player, summary, recentMatches, taggedUserLabel, mode = "analyze" }) {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY manquante.");
    }

    const systemPrompt = buildSystemPrompt(mode);

    const userPrompt = JSON.stringify(
      {
        target: taggedUserLabel ?? player.nickname,
        player: {
          nickname: player.nickname,
          elo: player.elo,
          skillLevel: player.skillLevel,
          matches: summary.metrics.matches,
          winRate: summary.metrics.winRate,
          averageKd: summary.metrics.averageKd,
          averageKills: summary.metrics.averageKills,
          averageDeaths: summary.metrics.averageDeaths,
          averageAssists: summary.metrics.averageAssists,
          averageHs: summary.metrics.averageHs,
          streak: summary.metrics.streak.label,
          recentForm: summary.metrics.recentForm
        },
        recentMatches: recentMatches.slice(0, 5).map((match) => ({
          map: match.map,
          result: match.result,
          score: match.score,
          kd: match.playerStats?.kd,
          kills: match.playerStats?.kills,
          deaths: match.playerStats?.deaths,
          assists: match.playerStats?.assists,
          hs: match.playerStats?.hs
        }))
      },
      null,
      2
    );

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(this.appUrl ? { "HTTP-Referer": this.appUrl } : {}),
        ...(this.appTitle ? { "X-Title": this.appTitle } : {})
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.9,
        max_tokens: 650,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;

      try {
        const payload = await response.json();
        detail = payload?.error?.message ?? payload?.message ?? detail;
      } catch {
        // Keep fallback detail.
      }

      throw new Error(`OpenRouter: ${detail}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenRouter n'a pas renvoye de contenu.");
    }

    return content;
  }
}

function buildSystemPrompt(mode) {
  if (mode === "roast") {
    return [
      "Tu es un analyste FACEIT francophone qui fait un roast amusant et joueur, jamais toxique.",
      "Tu dois te moquer gentiment du profil avec du style streamer Discord.",
      "Structure attendue:",
      "- 1 intro dramatique courte",
      "- 3 piques humoristiques basees sur les stats",
      "- 3 points de progression utiles",
      "- 1 conclusion qui relance la motivation",
      "Reste compact, lisible et adapte a Discord.",
      "Pas de markdown complexe, pas d'inventions."
    ].join(" ");
  }

  return [
    "Tu es un coach FACEIT francophone avec un ton fun, mordant mais jamais mechant.",
    "Tu fais une analyse humoristique d'un joueur avec:",
    "- 1 mini intro flashy",
    "- 3 forces",
    "- 3 faiblesses",
    "- 3 conseils concrets et actionnables",
    "- 1 punchline finale",
    "Reste compact, lisible et adapte a Discord.",
    "Pas de markdown complexe, pas de tableau.",
    "Evite d'inventer des donnees absentes."
  ].join(" ");
}
