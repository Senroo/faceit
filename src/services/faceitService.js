const FACEIT_BASE_URL = "https://open.faceit.com/data/v4";

export class FaceitService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async getPlayerByNickname(nickname) {
    const data = await this.request("/players", {
      nickname: nickname.trim()
    });

    const cs2 = data.games?.cs2 ?? data.games?.csgo ?? null;

    return {
      playerId: data.player_id,
      nickname: data.nickname,
      country: data.country,
      avatar: data.avatar,
      faceitUrl: data.faceit_url,
      gameId: cs2 ? (data.games.cs2 ? "cs2" : "csgo") : null,
      skillLevel: cs2?.skill_level ?? null,
      elo: cs2?.faceit_elo ?? null
    };
  }

  async getPlayerHistory(playerId, gameId, limit = 20) {
    const data = await this.request(`/players/${playerId}/history`, {
      game: gameId,
      offset: 0,
      limit
    });

    return Array.isArray(data.items) ? data.items : [];
  }

  async getMatchStats(matchId) {
    return this.request(`/matches/${matchId}/stats`);
  }

  async request(pathname, query = {}) {
    if (!this.apiKey) {
      throw new Error("FACEIT_API_KEY manquant.");
    }

    const url = new URL(`${FACEIT_BASE_URL}${pathname}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;

      try {
        const errorBody = await response.json();
        detail = errorBody?.errors?.[0]?.message ?? errorBody?.message ?? detail;
      } catch {
        // Keep the default detail string if the error body is not JSON.
      }

      throw new Error(`Erreur FACEIT: ${detail}`);
    }

    return response.json();
  }
}
