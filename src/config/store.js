import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_STATE = {
  settings: {
    gameId: "cs2",
    pollIntervalSeconds: 90,
    discordChannelId: ""
  },
  trackedPlayers: [],
  processedMatches: {},
  recentMatches: [],
  runtime: {
    startedAt: null,
    lastPollAt: null,
    lastSuccessfulPollAt: null,
    lastError: null
  }
};

export class Store {
  constructor(options = {}) {
    this.dataDir = path.resolve(options.dataDir ?? path.join(process.cwd(), "data"));
    this.stateFile = path.join(this.dataDir, "state.json");
    this.tempFile = path.join(this.dataDir, "state.tmp.json");
    this.state = structuredClone(DEFAULT_STATE);
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });

    try {
      const raw = await readFile(this.stateFile, "utf8");
      const parsed = JSON.parse(raw);
      this.state = mergeState(DEFAULT_STATE, parsed);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      await this.save();
    }
  }

  getState() {
    return structuredClone(this.state);
  }

  async save() {
    await writeFile(this.tempFile, JSON.stringify(this.state, null, 2), "utf8");
    await rename(this.tempFile, this.stateFile);
  }

  async updateSettings(patch) {
    this.state.settings = {
      ...this.state.settings,
      ...patch
    };
    await this.save();
    return this.getState();
  }

  async setRuntime(patch) {
    this.state.runtime = {
      ...this.state.runtime,
      ...patch
    };
    await this.save();
    return this.getState();
  }

  async upsertTrackedPlayer(player) {
    const existingIndex = this.state.trackedPlayers.findIndex(
      (entry) => entry.playerId === player.playerId
    );

    if (existingIndex >= 0) {
      this.state.trackedPlayers[existingIndex] = {
        ...this.state.trackedPlayers[existingIndex],
        ...player
      };
    } else {
      this.state.trackedPlayers.push(player);
    }

    await this.save();
    return this.getState();
  }

  async removeTrackedPlayerByNickname(nickname) {
    const normalized = nickname.trim().toLowerCase();
    const player = this.state.trackedPlayers.find(
      (entry) => entry.nickname.toLowerCase() === normalized
    );

    if (!player) {
      return { removed: null, state: this.getState() };
    }

    this.state.trackedPlayers = this.state.trackedPlayers.filter(
      (entry) => entry.playerId !== player.playerId
    );
    delete this.state.processedMatches[player.playerId];

    await this.save();
    return { removed: player, state: this.getState() };
  }

  async setProcessedMatch(playerId, matchId) {
    this.state.processedMatches[playerId] = matchId;
    await this.save();
    return this.getState();
  }

  async addRecentMatch(matchSummary) {
    this.state.recentMatches = [matchSummary, ...this.state.recentMatches].slice(0, 25);
    await this.save();
    return this.getState();
  }
}

function mergeState(base, incoming) {
  return {
    settings: {
      ...base.settings,
      ...(incoming?.settings ?? {})
    },
    trackedPlayers: Array.isArray(incoming?.trackedPlayers)
      ? incoming.trackedPlayers
      : base.trackedPlayers,
    processedMatches: {
      ...base.processedMatches,
      ...(incoming?.processedMatches ?? {})
    },
    recentMatches: Array.isArray(incoming?.recentMatches)
      ? incoming.recentMatches
      : base.recentMatches,
    runtime: {
      ...base.runtime,
      ...(incoming?.runtime ?? {})
    }
  };
}
