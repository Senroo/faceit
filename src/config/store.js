import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_STATE = {
  metadata: {
    schemaVersion: 3,
    createdAt: null,
    updatedAt: null
  },
  settings: {
    gameId: "cs2",
    pollIntervalSeconds: 90,
    discordChannelId: ""
  },
  trackedPlayers: [],
  processedMatches: {},
  eloSnapshots: {},
  recentMatches: [],
  matchHistory: [],
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

  getStorageInfo() {
    return {
      dataDir: this.dataDir,
      stateFile: this.stateFile,
      updatedAt: this.state.metadata.updatedAt,
      createdAt: this.state.metadata.createdAt,
      trackedPlayersCount: this.state.trackedPlayers.length,
      matchHistoryCount: this.state.matchHistory.length,
      snapshotCount: Object.values(this.state.eloSnapshots ?? {}).reduce(
        (count, entries) => count + (Array.isArray(entries) ? entries.length : 0),
        0
      )
    };
  }

  getBackupPayload() {
    return this.getState();
  }

  getState() {
    return structuredClone(this.state);
  }

  async save() {
    const now = new Date().toISOString();
    this.state.metadata = {
      ...this.state.metadata,
      schemaVersion: DEFAULT_STATE.metadata.schemaVersion,
      createdAt: this.state.metadata.createdAt ?? now,
      updatedAt: now
    };
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

  async addEloSnapshot(playerId, snapshot) {
    const existing = Array.isArray(this.state.eloSnapshots[playerId])
      ? this.state.eloSnapshots[playerId]
      : [];
    const normalized = {
      recordedAt: snapshot.recordedAt ?? new Date().toISOString(),
      elo: Number(snapshot.elo ?? 0),
      skillLevel: snapshot.skillLevel ?? null,
      nickname: snapshot.nickname ?? null
    };
    const last = existing[existing.length - 1];

    if (
      last &&
      last.elo === normalized.elo &&
      last.skillLevel === normalized.skillLevel &&
      last.nickname === normalized.nickname
    ) {
      return this.getState();
    }

    this.state.eloSnapshots[playerId] = [...existing, normalized].slice(-120);
    await this.save();
    return this.getState();
  }

  async addRecentMatch(matchSummary, options = {}) {
    const includeInRecent = options.includeInRecent !== false;
    const entry = {
      ...matchSummary,
      recordedAt: matchSummary.recordedAt ?? new Date().toISOString()
    };
    const dedupedRecent = this.state.recentMatches.filter(
      (item) => !isSameTrackedMatch(item, entry)
    );
    const dedupedHistory = this.state.matchHistory.filter(
      (item) => !isSameTrackedMatch(item, entry)
    );

    this.state.recentMatches = includeInRecent
      ? [entry, ...dedupedRecent].slice(0, 18)
      : dedupedRecent.slice(0, 18);
    this.state.matchHistory = [entry, ...dedupedHistory].slice(0, 300);
    await this.save();
    return this.getState();
  }
}

function mergeState(base, incoming) {
  return {
    metadata: {
      ...base.metadata,
      ...(incoming?.metadata ?? {})
    },
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
    eloSnapshots: {
      ...base.eloSnapshots,
      ...(incoming?.eloSnapshots ?? {})
    },
    recentMatches: Array.isArray(incoming?.recentMatches)
      ? incoming.recentMatches
      : base.recentMatches,
    matchHistory: Array.isArray(incoming?.matchHistory)
      ? incoming.matchHistory
      : base.matchHistory,
    runtime: {
      ...base.runtime,
      ...(incoming?.runtime ?? {})
    }
  };
}

function isSameTrackedMatch(left, right) {
  return left?.matchId === right?.matchId && left?.trackedNickname === right?.trackedNickname;
}
